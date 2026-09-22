/**
 * Leitura da configuração da fonte de dados no servidor.
 * `config_entidade.fonte_credencial` é a credencial do Fluxo, só leitura,
 * AES-256-GCM (§8.1). Nunca é devolvida ao cliente.
 */
import { decifrarCredencial } from "../cifra";
import type { AirtableCfg } from "./airtable";

export interface ConfigFonteRow {
  fonte_tipo?: string | null;
  fonte_credencial?: unknown;
  fonte_base?: string | null;
  mapa_campos?: unknown;
  filtros?: unknown;
  prazos?: unknown;
  variaveis?: unknown;
  fonte_tabela_acoes?: string | null;
  fonte_tabela_registos?: string | null;
  fonte_tabela_formandos?: string | null;
  atualizado_em?: string | null;
}

export const COLUNAS_CONFIG_FONTE =
  "fonte_tipo,fonte_credencial,fonte_base,mapa_campos,filtros,prazos,variaveis,fonte_tabela_acoes,fonte_tabela_registos,fonte_tabela_formandos,atualizado_em";

/** Aceita o blob cifrado como texto simples (token) ou JSON com `token` / `crm_token`. */
export async function tokenDaCredencial(blob: unknown): Promise<string | null> {
  if (!blob) return null;
  if (typeof blob === "object") {
    const o = blob as Record<string, unknown>;
    const inner = (o.crm_token ?? o.token) as string | undefined;
    if (!inner) return null;
    return tokenDaCredencial(inner);
  }
  if (typeof blob !== "string") return null;
  const dec = await decifrarCredencial(blob);
  if (!dec) return null;
  return dec.token ?? dec.crm_token ?? null;
}

function varTexto(vars: unknown, k: string): string | undefined {
  if (!vars || typeof vars !== "object") return undefined;
  const v = (vars as Record<string, unknown>)[k];
  return typeof v === "string" && v.trim() ? v : undefined;
}

/** Monta a configuração do adaptador (sem token) a partir da linha de config_entidade. */
export function configFonte(cfg: ConfigFonteRow): Omit<AirtableCfg, "token"> | null {
  if (!cfg.fonte_base) return null;
  return {
    baseId: cfg.fonte_base,
    tabelaAcoes: cfg.fonte_tabela_acoes ?? varTexto(cfg.variaveis, "TBL_ACOES"),
    tabelaRegistos: cfg.fonte_tabela_registos ?? varTexto(cfg.variaveis, "TBL_LOGS"),
    tabelaFormandos: cfg.fonte_tabela_formandos ?? varTexto(cfg.variaveis, "TBL_FORMANDOS"),
    mapaCampos: (cfg.mapa_campos as Record<string, string> | null) ?? undefined,
    filtros: (cfg.filtros as Record<string, unknown> | null) ?? undefined,
  };
}
