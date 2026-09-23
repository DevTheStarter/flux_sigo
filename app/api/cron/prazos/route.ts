import { NextResponse } from "next/server";
import { createClientService } from "../../../../lib/supabase/service";
import { cronAutorizado, respostaNaoAutorizado } from "../../../../lib/cron/autorizacao";
import { escaparHtml, quadroDaEntidade } from "../../../../lib/cron/quadro";
import { avisoDoCartao, DEF_CANAIS, DEF_EVENTOS, REF_SYNC, type Aviso, type EstadoRow } from "../../../../lib/cron/avisos";
import { enviarEmail } from "../../../../lib/email";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Cron de prazos (§10.3). De hora a hora. Para cada entidade ativa deriva o
 * quadro e emite `prazo`, `bloqueio`, `concluido` e `falha_sync` para os cartões
 * cujo estado mudou desde a última execução. O estado anterior vive na tabela
 * `estado_notificacoes` (nunca em memória: na Vercel cada execução pode correr
 * numa instância nova). É o único sítio onde um `acao_ref` é escrito por nós.
 */

async function handler(req: Request) {
  if (!cronAutorizado(req)) return respostaNaoAutorizado();
  if (!process.env.CHAVE_CIFRA) {
    log.error("cron/prazos CHAVE_CIFRA vazia");
    return NextResponse.json({ erro: "CHAVE_CIFRA não definida" }, { status: 500 });
  }

  const sb = createClientService();
  const entRes = await sb.from("entidades").select("id, nome").eq("ativa", true);
  if (entRes.error) {
    log.error("cron/prazos entidades", { err: entRes.error.message });
    return NextResponse.json({ erro: "Falha ao carregar entidades." }, { status: 500 });
  }
  const entidades = (entRes.data ?? []) as { id: string; nome: string }[];
  const stats = { entidades: entidades.length, semFonte: 0, falhas: 0, avisos: 0, notificacoesApp: 0, emails: 0 };

  for (const ent of entidades) {
    try {
      const antRes = await sb.from("estado_notificacoes").select("acao_ref, coluna, estado").eq("entidade_id", ent.id);
      const anteriores = new Map<string, EstadoRow>(((antRes.data ?? []) as EstadoRow[]).map((r) => [r.acao_ref, r]));
      const syncAnterior = anteriores.get(REF_SYNC);

      const quadro = await quadroDaEntidade(sb, ent.id);
      const avisos: Aviso[] = [];
      const agora = new Date().toISOString();
      const upserts: { entidade_id: string; acao_ref: string; coluna: string; estado: string; updated_at: string }[] = [];

      if (!quadro.ok) {
        if (quadro.motivo === "sem_fonte") {
          stats.semFonte += 1;
          continue;
        }
        stats.falhas += 1;
        log.warn("cron/prazos leitura falhou", { entidade_id: ent.id, motivo: quadro.motivo, err: quadro.erro });
        // §10.1 falha_sync: só na transição ok → falha, para não repetir de hora a hora.
        if (syncAnterior?.estado !== "falha") {
          avisos.push({
            evento: "falha_sync",
            corpo:
              quadro.motivo === "credencial"
                ? "A credencial da base de dados está ilegível. Volta a introduzi-la em Definições, Ligação de dados."
                : "A leitura da base de dados falhou. O quadro pode estar desatualizado até a ligação ser reposta.",
            acaoRef: null,
          });
        }
        upserts.push({ entidade_id: ent.id, acao_ref: REF_SYNC, coluna: "-", estado: "falha", updated_at: agora });
      } else {
        upserts.push({ entidade_id: ent.id, acao_ref: REF_SYNC, coluna: "-", estado: "ok", updated_at: agora });
        const vistos = new Set<string>([REF_SYNC]);
        for (const c of quadro.cartoes) {
          vistos.add(c.id);
          const aviso = avisoDoCartao(c, anteriores.get(c.id));
          if (aviso) avisos.push(aviso);
          upserts.push({ entidade_id: ent.id, acao_ref: c.id, coluna: String(c.col), estado: c.estado, updated_at: agora });
        }
        // Linhas de ações que já não existem na fonte (§10.3).
        const desaparecidas = [...anteriores.keys()].filter((ref) => !vistos.has(ref));
        if (desaparecidas.length) {
          const del = await sb.from("estado_notificacoes").delete().eq("entidade_id", ent.id).in("acao_ref", desaparecidas);
          if (del.error) log.warn("cron/prazos limpar estado", { entidade_id: ent.id, err: del.error.message });
        }
      }

      const up = await (sb as any).from("estado_notificacoes").upsert(upserts, { onConflict: "entidade_id,acao_ref" });
      if (up.error) log.error("cron/prazos guardar estado", { entidade_id: ent.id, err: up.error.message });

      if (!avisos.length) continue;
      stats.avisos += avisos.length;

      const usersRes = await sb.from("utilizadores").select("id, nome, email").eq("entidade_id", ent.id);
      const users = (usersRes.data ?? []) as { id: string; nome: string; email: string }[];
      if (!users.length) continue;
      const prefsRes = await sb
        .from("preferencias_notificacao")
        .select("utilizador_id, eventos, canais")
        .in("utilizador_id", users.map((u) => u.id));
      const prefs = new Map<string, { eventos: Record<string, boolean>; canais: Record<string, boolean> }>();
      for (const p of (prefsRes.data ?? []) as { utilizador_id: string; eventos: unknown; canais: unknown }[]) {
        prefs.set(p.utilizador_id, {
          eventos: { ...DEF_EVENTOS, ...((p.eventos as Record<string, boolean>) ?? {}) },
          canais: { ...DEF_CANAIS, ...((p.canais as Record<string, boolean>) ?? {}) },
        });
      }

      const linhasApp: { entidade_id: string; destinatario_id: string; tipo: string; corpo: string; acao_ref: string | null }[] = [];
      for (const u of users) {
        const p = prefs.get(u.id) ?? { eventos: DEF_EVENTOS, canais: DEF_CANAIS };
        const meus = avisos.filter((a) => p.eventos[a.evento]);
        if (!meus.length) continue;
        if (p.canais.app) {
          for (const a of meus) linhasApp.push({ entidade_id: ent.id, destinatario_id: u.id, tipo: a.evento, corpo: a.corpo, acao_ref: a.acaoRef });
        }
        if (p.canais.email && u.email) {
          const itens = meus.map((a) => `<li style="margin:0 0 8px">${escaparHtml(a.corpo)}</li>`).join("");
          const html =
            `<p>Olá ${escaparHtml(u.nome || "")},</p>` +
            `<p>Há novidades no quadro de ${escaparHtml(ent.nome)}:</p>` +
            `<ul style="padding-left:18px">${itens}</ul>` +
            `<p>Vê o detalhe no Quadro do Fluxo.</p>` +
            `<p style="color:#8d8d8d;font-size:12px;margin-top:24px">Enviado por Fluxo. Podes mudar o que recebes em Definições, Notificações.</p>`;
          const r = await enviarEmail({
            para: u.email,
            assunto: `Fluxo · ${meus.length === 1 ? "1 novidade" : `${meus.length} novidades`} no quadro de ${ent.nome}`,
            html,
          });
          if (r.ok) stats.emails += 1;
        }
      }
      if (linhasApp.length) {
        const ins = await (sb as any).from("notificacoes").insert(linhasApp);
        if (ins.error) log.error("cron/prazos notificacoes", { entidade_id: ent.id, err: ins.error.message });
        else stats.notificacoesApp += linhasApp.length;
      }
    } catch (e) {
      stats.falhas += 1;
      log.error("cron/prazos entidade", { entidade_id: ent.id, err: (e as Error).message });
    }
  }

  log.info("cron/prazos concluído", stats);
  return NextResponse.json({ ok: true, stats });
}

export const GET = handler;
export const POST = handler;
