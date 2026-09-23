import { NextResponse } from "next/server";
import { createClientService } from "../../../../lib/supabase/service";
import { cronAutorizado, respostaNaoAutorizado } from "../../../../lib/cron/autorizacao";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "problemas-anexos";

/**
 * Purga de anexos (§11). Diário. Apaga do Storage e da tabela os anexos de
 * problemas reportados com `apagar_em` no passado (90 dias após o envio).
 * Os anexos podem conter dados pessoais de formandos; esta é a garantia de
 * retenção que consta do separador Privacidade e do contrato.
 */
async function handler(req: Request) {
  if (!cronAutorizado(req)) return respostaNaoAutorizado();
  const sb = createClientService();
  const hoje = new Date().toISOString().slice(0, 10);

  const res = await sb.from("problemas_anexos").select("id, caminho").lte("apagar_em", hoje).limit(500);
  if (res.error) {
    log.error("cron/anexos listar", { err: res.error.message });
    return NextResponse.json({ erro: "Falha ao listar anexos." }, { status: 500 });
  }
  const anexos = (res.data ?? []) as { id: string; caminho: string }[];
  const stats = { encontrados: anexos.length, apagados: 0, falhas: 0 };
  if (!anexos.length) return NextResponse.json({ ok: true, stats });

  // Em lotes: o Storage aceita várias chaves por chamada.
  for (let i = 0; i < anexos.length; i += 100) {
    const lote = anexos.slice(i, i + 100);
    const rm = await sb.storage.from(BUCKET).remove(lote.map((a) => a.caminho));
    if (rm.error) {
      stats.falhas += lote.length;
      log.error("cron/anexos storage remove", { err: rm.error.message, n: lote.length });
      continue;
    }
    const del = await sb.from("problemas_anexos").delete().in("id", lote.map((a) => a.id));
    if (del.error) {
      stats.falhas += lote.length;
      log.error("cron/anexos apagar linhas", { err: del.error.message, n: lote.length });
      continue;
    }
    stats.apagados += lote.length;
  }

  log.info("cron/anexos concluído", stats);
  return NextResponse.json({ ok: true, stats });
}

export const GET = handler;
export const POST = handler;
