import { NextResponse } from "next/server";
import { createClientService } from "../../../../lib/supabase/service";
import { cronAutorizado, respostaNaoAutorizado } from "../../../../lib/cron/autorizacao";
import { agoraEmLisboa, quadroDaEntidade } from "../../../../lib/cron/quadro";
import { corpoRelatorio } from "../../../../lib/cron/relatorio";
import { enviarEmail } from "../../../../lib/email";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Relatório semanal (§12). Corre de hora a hora. Para cada entidade cujo
 * `dia_semana` e `hora` (Europe/Lisbon) coincidem com o momento atual, deriva
 * o quadro e envia um email a cada destinatário. Sem dados pessoais.
 * `?forcar=<entidade_id>` envia já, ignorando dia e hora (para testes).
 */

interface Config {
  entidade_id: string;
  ativo: boolean | null;
  dia_semana: string | null;
  hora: string | null;
  destinatarios: string[] | null;
}

function normalizarDia(d: string | null | undefined): string {
  return (d ?? "segunda").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/-feira$/, "").trim();
}

async function handler(req: Request) {
  if (!cronAutorizado(req)) return respostaNaoAutorizado();
  const forcar = new URL(req.url).searchParams.get("forcar");
  const agora = agoraEmLisboa();

  const sb = createClientService();
  let q = sb.from("config_relatorio").select("entidade_id, ativo, dia_semana, hora, destinatarios");
  if (forcar) q = q.eq("entidade_id", forcar);
  const cfgRes = await q;
  if (cfgRes.error) {
    log.error("cron/relatorio config", { err: cfgRes.error.message });
    return NextResponse.json({ erro: "Falha ao carregar configuração." }, { status: 500 });
  }
  const configs = ((cfgRes.data ?? []) as Config[]).filter((c) => {
    if (forcar) return true;
    if (c.ativo === false) return false;
    if (!c.destinatarios?.length) return false;
    const hora = Number((c.hora ?? "09:00").split(":")[0]);
    return normalizarDia(c.dia_semana) === normalizarDia(agora.diaSemana) && hora === agora.hora;
  });

  const stats = { candidatas: configs.length, enviados: 0, semFonte: 0, falhas: 0 };
  if (!configs.length) return NextResponse.json({ ok: true, stats, agora });

  const entRes = await sb.from("entidades").select("id, nome, ativa").in("id", configs.map((c) => c.entidade_id));
  const entidades = new Map(((entRes.data ?? []) as { id: string; nome: string; ativa: boolean }[]).map((e) => [e.id, e]));

  for (const cfg of configs) {
    const ent = entidades.get(cfg.entidade_id);
    if (!ent || !ent.ativa) continue;
    try {
      const quadro = await quadroDaEntidade(sb, ent.id);
      if (!quadro.ok) {
        if (quadro.motivo === "sem_fonte") stats.semFonte += 1;
        else {
          stats.falhas += 1;
          log.warn("cron/relatorio leitura falhou", { entidade_id: ent.id, motivo: quadro.motivo, err: quadro.erro });
        }
        continue;
      }
      const dataPt = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
      const { assunto, html, texto } = corpoRelatorio(ent.nome, quadro.cartoes, dataPt);
      for (const para of cfg.destinatarios ?? []) {
        const r = await enviarEmail({ para, assunto, html, texto });
        if (r.ok) stats.enviados += 1;
        else stats.falhas += 1;
      }
    } catch (e) {
      stats.falhas += 1;
      log.error("cron/relatorio entidade", { entidade_id: cfg.entidade_id, err: (e as Error).message });
    }
  }

  log.info("cron/relatorio concluído", stats);
  return NextResponse.json({ ok: true, stats, agora });
}

export const GET = handler;
export const POST = handler;
