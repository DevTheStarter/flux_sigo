import type { SupabaseClient } from "@supabase/supabase-js";
import { criarAirtable } from "../dados/airtable";
import { COLUNAS_CONFIG_FONTE, configFonte, tokenDaCredencial, type ConfigFonteRow } from "../dados/credencial";
import { derivar, type Cartao } from "../dados/derivar";
import type { FonteDeDados } from "../dados/interface";
import { log } from "../log";

/**
 * Leitura do quadro de uma entidade com o service role, para os crons e para a
 * contagem de ações da página Entidades. O resultado vive só em memória durante
 * o pedido (§2.1). Nunca é devolvido a um cliente do staff (§2.4).
 */
export type ResultadoQuadro =
  | { ok: true; cartoes: Cartao[] }
  | { ok: false; motivo: "sem_fonte" | "credencial" | "leitura"; erro?: string };

export async function fonteDaEntidade(
  sb: SupabaseClient<any, any, any>,
  entidadeId: string,
): Promise<{ fonte: FonteDeDados; prazos: Record<string, number> | undefined } | { erro: "sem_fonte" | "credencial"; detalhe?: string }> {
  const res = await sb.from("config_entidade").select(COLUNAS_CONFIG_FONTE).eq("entidade_id", entidadeId).maybeSingle();
  const cfg = (res.data as unknown as ConfigFonteRow | null) ?? null;
  const fonteCfg = cfg ? configFonte(cfg) : null;
  if (!cfg || !fonteCfg) return { erro: "sem_fonte" };
  let token: string | null;
  try {
    token = await tokenDaCredencial(cfg.fonte_credencial);
  } catch (e) {
    return { erro: "credencial", detalhe: (e as Error).message };
  }
  if (!token) return { erro: "sem_fonte" };
  return {
    fonte: criarAirtable({ ...fonteCfg, token }),
    prazos: (cfg.prazos as Record<string, number> | null) ?? undefined,
  };
}

export async function quadroDaEntidade(sb: SupabaseClient<any, any, any>, entidadeId: string): Promise<ResultadoQuadro> {
  const f = await fonteDaEntidade(sb, entidadeId);
  if ("erro" in f) return { ok: false, motivo: f.erro, erro: f.detalhe };
  try {
    const [acoes, registos] = await Promise.all([f.fonte.obterAcoes(), f.fonte.obterRegistos()]);
    const cartoes: Cartao[] = [];
    for (const a of acoes) {
      try {
        cartoes.push(derivar(a, registos, f.prazos));
      } catch (e) {
        log.warn("cron derivar falhou", { acao: a.id, err: (e as Error).message });
      }
    }
    return { ok: true, cartoes };
  } catch (e) {
    return { ok: false, motivo: "leitura", erro: (e as Error).message };
  }
}

export function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Data de hoje em Lisboa, YYYY-MM-DD, e a hora inteira e o dia da semana em PT. */
export function agoraEmLisboa(agora: Date = new Date()): { data: string; hora: number; diaSemana: string } {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(agora);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const DIAS: Record<string, string> = {
    monday: "segunda",
    tuesday: "terça",
    wednesday: "quarta",
    thursday: "quinta",
    friday: "sexta",
    saturday: "sábado",
    sunday: "domingo",
  };
  return {
    data: `${v("year")}-${v("month")}-${v("day")}`,
    hora: Number(v("hour")) % 24,
    diaSemana: DIAS[v("weekday").toLowerCase()] ?? v("weekday").toLowerCase(),
  };
}
