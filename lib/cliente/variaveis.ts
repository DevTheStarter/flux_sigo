/**
 * Variáveis das entidades (spec §8). Definições, leitura e substituição no cliente.
 * Os valores não secretos vivem em config_entidade.variaveis (com fallback às
 * colunas antigas). Os secretos vivem só no navegador (ver segredos.ts).
 */
import { ehSegredo, lerSegredos } from "./segredos";

export interface DefVariavel {
  k: string;
  rotulo: string;
  grupo: "SIGO" | "Base de dados" | "Regras fixas";
  secreta: boolean;
  /** só neste navegador */
  local: boolean;
}

export const VARIAVEIS: DefVariavel[] = [
  { k: "SIGO_URL", rotulo: "URL de login do SIGO", grupo: "SIGO", secreta: false, local: false },
  { k: "SIGO_UTILIZADOR", rotulo: "Utilizador do SIGO", grupo: "SIGO", secreta: false, local: false },
  { k: "SIGO_PALAVRA", rotulo: "Palavra-passe do SIGO", grupo: "SIGO", secreta: true, local: true },
  { k: "CRM_TIPO", rotulo: "Sistema de dados", grupo: "Base de dados", secreta: false, local: false },
  { k: "CRM_BASE", rotulo: "Identificador da base", grupo: "Base de dados", secreta: false, local: false },
  { k: "CRM_TOKEN", rotulo: "Token dos flows (leitura e escrita)", grupo: "Base de dados", secreta: true, local: true },
  { k: "TBL_ACOES", rotulo: "Tabela de ações de formação", grupo: "Base de dados", secreta: false, local: false },
  { k: "TBL_FORMANDOS", rotulo: "Tabela de formandos", grupo: "Base de dados", secreta: false, local: false },
  { k: "TBL_LOGS", rotulo: "Tabela de registos", grupo: "Base de dados", secreta: false, local: false },
  { k: "AREA_FORMACAO", rotulo: "Área de formação", grupo: "Regras fixas", secreta: false, local: false },
  { k: "REGIME", rotulo: "Regime", grupo: "Regras fixas", secreta: false, local: false },
];

export const GRUPOS_VARIAVEIS = ["SIGO", "Base de dados", "Regras fixas"] as const;

/** colunas antigas de config_entidade que ainda podem ter o valor */
const COLUNAS_LEGADO: Record<string, string> = {
  SIGO_URL: "sigo_url",
  SIGO_UTILIZADOR: "sigo_utilizador",
  CRM_TIPO: "fonte_tipo",
  CRM_BASE: "fonte_base",
  TBL_ACOES: "fonte_tabela_acoes",
  TBL_FORMANDOS: "fonte_tabela_formandos",
  TBL_LOGS: "fonte_tabela_registos",
  AREA_FORMACAO: "area_formacao_default",
  REGIME: "regime_default",
};

export const COLUNAS_CONFIG_VARIAVEIS =
  "variaveis, sigo_url, sigo_utilizador, fonte_tipo, fonte_base, fonte_tabela_acoes, fonte_tabela_formandos, fonte_tabela_registos, area_formacao_default, regime_default";

/** Extrai os valores não secretos de uma linha de config_entidade. */
export function variaveisDaConfig(cfg: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cfg) return out;
  const json = (cfg.variaveis && typeof cfg.variaveis === "object" ? cfg.variaveis : {}) as Record<string, unknown>;
  for (const v of VARIAVEIS) {
    if (v.local) continue;
    const j = json[v.k];
    if (typeof j === "string" && j.trim()) {
      out[v.k] = j;
      continue;
    }
    const col = COLUNAS_LEGADO[v.k];
    const c = col ? cfg[col] : undefined;
    if (typeof c === "string" && c.trim()) out[v.k] = c;
  }
  return out;
}

/** Linha de update para config_entidade: JSON da spec + colunas antigas em sincronia. */
export function updateDaConfig(valores: Record<string, string>): Record<string, unknown> {
  const variaveis: Record<string, string> = {};
  const row: Record<string, unknown> = {};
  for (const v of VARIAVEIS) {
    if (v.local) continue;
    const val = (valores[v.k] ?? "").trim();
    if (val) variaveis[v.k] = val;
    const col = COLUNAS_LEGADO[v.k];
    if (col) row[col] = val || null;
  }
  row.variaveis = variaveis;
  return row;
}

const RX = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

/**
 * Substitui {{CHAVE}} pelos valores. Desconhecidas ficam como estão (§8.3).
 * `incluirSegredos` só é verdadeiro na cópia de um documento completo.
 */
export function substituir(
  texto: string,
  valores: Record<string, string>,
  incluirSegredos: boolean
): { texto: string; faltam: string[] } {
  const segredos = incluirSegredos ? lerSegredos() : {};
  const faltam = new Set<string>();
  const out = texto.replace(RX, (m, k: string) => {
    const def = VARIAVEIS.find((v) => v.k === k);
    if (!def) return m;
    if (def.local) {
      if (!incluirSegredos) return m;
      const s = (segredos as Record<string, string>)[k];
      if (!s) { faltam.add(k); return m; }
      return s;
    }
    const v = valores[k];
    if (!v) { faltam.add(k); return m; }
    return v;
  });
  return { texto: out, faltam: [...faltam] };
}

/** Chaves com valor em falta (não secretas via valores, secretas via localStorage). */
export function chavesEmFalta(valores: Record<string, string>): string[] {
  const seg = lerSegredos() as Record<string, string>;
  return VARIAVEIS.filter((v) => (v.local ? !seg[v.k] : !(valores[v.k] ?? "").trim())).map((v) => v.k);
}

export function ehChaveLocal(k: string): boolean {
  return ehSegredo(k);
}

/** Todas as chaves que a instrução curta usa (§4.9). Nunca as secretas. */
export const CHAVES_INSTRUCAO = ["SIGO_URL", "SIGO_UTILIZADOR", "CRM_TIPO", "CRM_BASE"] as const;
