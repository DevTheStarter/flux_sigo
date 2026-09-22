import { NextResponse } from "next/server";
import { createClientService } from "../../../../lib/supabase/service";
import { tokenDaCredencial } from "../../../../lib/dados/credencial";
import { criarAirtable, type AirtableCfg } from "../../../../lib/dados/airtable";
import { derivar, type Cartao } from "../../../../lib/dados/derivar";
import type { Acao, Registo } from "../../../../lib/dados/interface";
import { enviarEmail } from "../../../../lib/email";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function bearerValido(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const parts = header.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return false;
  return parts[1] === expected;
}

type EstadoRow = {
  acao_ref: string;
  estado_anterior: string | null;
};

async function upsertEstado(
  sb: ReturnType<typeof createClientService>,
  entId: string,
  ref: string,
  estado: string,
): Promise<void> {
  try {
    await sb
      .from("estado_notificacoes")
      .upsert(
        {
          entidade_id: entId,
          acao_ref: ref,
          estado_anterior: estado,
          atualizado_em: new Date().toISOString(),
        } as any,
        { onConflict: "entidade_id,acao_ref" as any },
      );
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json(
      { erro: "Autorização inválida" },
      { status: 401 },
    );
  }

  const chaveCifra = process.env.CHAVE_CIFRA;
  if (!chaveCifra) {
    log.error("cron/prazos CHAVE_CIFRA vazia");
    return NextResponse.json(
      { erro: "CHAVE_CIFRA não definida" },
      { status: 500 },
    );
  }

  try {
    const sb = createClientService();

    let entidades: any[] = [];
    try {
      const res = await sb
        .from("entidades")
        .select("id, nome, ativa")
        .eq("ativa", true);
      entidades = ((res as any).data as any[]) ?? [];
    } catch (e) {
      log.error("cron/prazos entidades load falhou", {
        err: (e as Error).message,
      });
      return NextResponse.json(
        { erro: "Falha ao carregar entidades." },
        { status: 500 },
      );
    }

    const stats = {
      entidades: entidades.length,
      notificadas: 0,
      erros: 0,
      acoesVerificadas: 0,
    };

    for (const ent of entidades) {
      try {
        const entId = ent.id as string;
        const entNome = ent.nome as string;

        let cfg: {
          fonte_tipo?: string;
          fonte_credencial?: unknown;
          fonte_base?: string | null;
          mapa_campos?: unknown;
          filtros?: unknown;
          prazos?: unknown;
        } | null = null;
        try {
          const res = await sb
            .from("config_entidade")
            .select(
              "fonte_tipo,fonte_credencial,fonte_base,mapa_campos,filtros,prazos",
            )
            .eq("entidade_id", entId)
            .maybeSingle();
          cfg = (res as any).data as any ?? null;
        } catch {
          cfg = null;
        }
        if (!cfg || !cfg.fonte_base) continue;

        let token: string;
        try {
          const maybeToken = await tokenDaCredencial(cfg.fonte_credencial);
          if (!maybeToken) continue;
          token = maybeToken;
        } catch {
          continue;
        }
        const airCfg: AirtableCfg = {
          baseId: cfg.fonte_base,
          token,
          mapaCampos:
            (cfg.mapa_campos as Record<string, string> | null) ?? undefined,
          filtros:
            (cfg.filtros as Record<string, unknown> | null) ?? undefined,
        };
        const fonte = criarAirtable(airCfg);

        let acoes: Acao[];
        let registos: Registo[];
        try {
          [acoes, registos] = await Promise.all([
            fonte.obterAcoes(),
            fonte.obterRegistos(),
          ]);
        } catch (e) {
          log.error("cron/prazos airtable entidade falhou", {
            err: (e as Error).message,
            entidade_id: entId,
          });
          stats.erros += 1;
          continue;
        }

        const prazosCfg = cfg.prazos as Record<string, number> | null;
        const derivado: Cartao[] = [];
        for (const a of acoes) {
          try {
            derivado.push(derivar(a, registos, prazosCfg ?? undefined));
          } catch {
            // skip
          }
        }
        stats.acoesVerificadas += derivado.length;

        let users: any[] = [];
        try {
          const res = await sb
            .from("utilizadores")
            .select("id,nome,email,funcao")
            .eq("entidade_id", entId);
          users = ((res as any).data as any[]) ?? [];
        } catch {
          users = [];
        }
        if (!users.length) continue;

        const userIds = users.map((u) => u.id);
        let prefs: any[] = [];
        try {
          const res = await sb
            .from("preferencias_notificacao")
            .select("utilizador_id,eventos,canais")
            .in("utilizador_id", userIds);
          prefs = ((res as any).data as any[]) ?? [];
        } catch {
          prefs = [];
        }
        const prefsPorId = new Map<string, any>(
          prefs.map((p) => [p.utilizador_id, p]),
        );

        const destinatarios = users.filter((u: any) => {
          const p = prefsPorId.get(u.id);
          const canais = (p?.canais as Record<string, unknown>) ?? {};
          return canais.email === true;
        });
        if (!destinatarios.length) continue;

        let anteriores: EstadoRow[] = [];
        try {
          const res = await sb
            .from("estado_notificacoes")
            .select("acao_ref,estado_anterior")
            .eq("entidade_id", entId);
          anteriores = ((res as any).data as EstadoRow[]) ?? [];
        } catch {
          anteriores = [];
        }
        const anteriorMap = new Map<string, string | null>(
          anteriores.map((r) => [r.acao_ref, r.estado_anterior]),
        );

        const transicoes: {
          acao: Cartao;
          evento: "late" | "bloqueada" | "today";
        }[] = [];

        for (const c of derivado) {
          const ref = `${c.id}` as string;
          let estadoNovo: string;
          if (c.prazo === "bloqueada") estadoNovo = "bloqueada";
          else if (c.prazo === "late") estadoNovo = "late";
          else if (c.prazo === "today") estadoNovo = "today";
          else estadoNovo = c.prazo ?? "ok";

          const anterior = anteriorMap.get(ref);
          if (anterior === estadoNovo) {
            void upsertEstado(sb, entId, ref, estadoNovo);
            continue;
          }

          if (
            estadoNovo === "late" ||
            estadoNovo === "bloqueada" ||
            estadoNovo === "today"
          ) {
            transicoes.push({
              acao: c,
              evento: estadoNovo as "late" | "bloqueada" | "today",
            });
          }

          void upsertEstado(sb, entId, ref, estadoNovo);
        }

        if (!transicoes.length) continue;

        const totalLate = transicoes.filter(
          (t) => t.evento === "late",
        ).length;
        const totalBloq = transicoes.filter(
          (t) => t.evento === "bloqueada",
        ).length;
        const totalToday = transicoes.filter(
          (t) => t.evento === "today",
        ).length;

        const linhas = transicoes
          .slice(0, 20)
          .map((t) => {
            const emoji =
              t.evento === "bloqueada"
                ? "🔒"
                : t.evento === "late"
                ? "⚠️"
                : "📍";
            const faseNome =
              t.evento === "bloqueada"
                ? "Bloqueada"
                : t.evento === "late"
                ? "Atrasada"
                : "Hoje";
            const acaoNome = (t.acao.acao as any)?.nome ?? t.acao.id;
            const formador = (t.acao.acao as any)?.formadorNome;
            return `<li><strong>${emoji} ${faseNome}</strong>: ${acaoNome}${
              formador ? " · " + String(formador) : ""
            }</li>`;
          })
          .join("\n");

        const html = `
          <h1>Prazos — ${entNome}</h1>
          <p>Novidades desde o último envio:</p>
          <ul>
            <li><strong>${totalLate}</strong> ações em atraso</li>
            <li><strong>${totalBloq}</strong> ações bloqueadas</li>
            <li><strong>${totalToday}</strong> ações com prazo hoje</li>
          </ul>
          <h2>Detalhe</h2>
          <ul>${linhas}</ul>
          ${
            transicoes.length > 20
              ? `<p>… e mais ${
                  transicoes.length - 20
                } ações. Ver no Quadro.</p>`
              : ""
          }
          <p style="color:#888;font-size:12px">Enviado automaticamente pelo cron de prazos.</p>
        `.trim();

        for (const u of destinatarios) {
          const para = (u as any).email as string;
          try {
            await enviarEmail({
              para,
              assunto: `Fluxo · prazos (${entNome}) — ${totalLate} atraso, ${totalBloq} bloqueio, ${totalToday} hoje`,
              html,
            });
          } catch (e) {
            log.error("cron/prazos enviar email falhou", {
              err: (e as any)?.message,
              para,
              entidade_id: entId,
            });
          }
          stats.notificadas += 1;
        }
      } catch (e) {
        log.error("cron/prazos entidade loop erro", {
          err: (e as Error).message,
          entidade_id: (ent as any)?.id,
          entidade_nome: (ent as any)?.nome,
        });
        stats.erros += 1;
      }
    }

    log.info("cron/prazos concluído", stats);
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    log.error("cron/prazos erro inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
