/**
 * Mapa de campos (§7.2): o nosso nome → nome do campo na base de dados da entidade.
 * Partilhado pelo adaptador e pela interface (Definições → Ligação de dados),
 * sem nada específico do Airtable além dos nomes por defeito da base TheStarter.
 */
export interface CampoMapeavel {
  k: string;
  rotulo: string;
  tabela: "acoes" | "registos";
  /** nome por defeito (base TheStarter, §7.3) */
  padrao: string;
  nota?: string;
}

export const CAMPOS_MAPEAVEIS: CampoMapeavel[] = [
  { k: "nome", rotulo: "Nome da ação", tabela: "acoes", padrao: "Name" },
  { k: "codigoCurso", rotulo: "Código do curso", tabela: "acoes", padrao: "Código Curso" },
  { k: "dataInicio", rotulo: "Data de início", tabela: "acoes", padrao: "Start date" },
  { k: "dataFim", rotulo: "Data de fim", tabela: "acoes", padrao: "End Date" },
  { k: "tipo", rotulo: "Tipo de formação", tabela: "acoes", padrao: "Tipo Formação" },
  { k: "formato", rotulo: "Formato", tabela: "acoes", padrao: "Formato" },
  { k: "diasSemana", rotulo: "Dias da semana", tabela: "acoes", padrao: "Dias Semana" },
  { k: "estado", rotulo: "Estado", tabela: "acoes", padrao: "Estado" },
  { k: "ano", rotulo: "Ano", tabela: "acoes", padrao: "Ano" },
  { k: "formandos", rotulo: "Nº de formandos", tabela: "acoes", padrao: "Nº Formandos", nota: "campo calculado, só o número" },
  { k: "temAvaliacoes", rotulo: "Tem avaliações", tabela: "acoes", padrao: "Tem Avaliações", nota: "campo calculado, 1 ou 0" },
  { k: "r_acaoId", rotulo: "Ação de formação (ligação)", tabela: "registos", padrao: "Ação de Formação" },
  { k: "r_flow", rotulo: "Flow", tabela: "registos", padrao: "Flow" },
  { k: "r_estado", rotulo: "Estado do registo", tabela: "registos", padrao: "Status" },
  { k: "r_detalhe", rotulo: "Detalhe", tabela: "registos", padrao: "Details" },
];

export const MAPA_PADRAO: Record<string, string> = Object.fromEntries(CAMPOS_MAPEAVEIS.map((c) => [c.k, c.padrao]));

/** Nome do campo na fonte para a nossa chave, com o mapa da entidade por cima do padrão. */
export function nomeNaFonte(mapa: Record<string, string> | undefined, k: string): string {
  const v = mapa?.[k];
  return typeof v === "string" && v.trim() ? v.trim() : MAPA_PADRAO[k] ?? k;
}

/** Limpa um mapa vindo do cliente: só chaves conhecidas, só valores não vazios. */
export function limparMapa(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const c of CAMPOS_MAPEAVEIS) {
    const v = (raw as Record<string, unknown>)[c.k];
    if (typeof v === "string" && v.trim() && v.trim() !== c.padrao) out[c.k] = v.trim().slice(0, 120);
  }
  return out;
}

/**
 * Filtros (§7.3) num formato simples para a interface: valores vazios não filtram.
 * Guardados em config_entidade.filtros com as nossas chaves; o adaptador traduz.
 */
export interface FiltrosSimples {
  formatoIgual: string;
  estadoDiferente: string;
}

export const FILTROS_PADRAO: FiltrosSimples = { formatoIgual: "PT", estadoDiferente: "Descontinuado" };

export function filtrosParaSimples(raw: unknown): FiltrosSimples {
  const out: FiltrosSimples = { formatoIgual: "", estadoDiferente: "" };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  if (typeof o.formato === "string") out.formatoIgual = o.formato;
  const e = o.estado;
  if (e && typeof e === "object" && typeof (e as Record<string, unknown>).$neq === "string") out.estadoDiferente = String((e as Record<string, unknown>).$neq);
  return out;
}

export function simplesParaFiltros(s: Partial<FiltrosSimples>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const f = (s.formatoIgual ?? "").trim();
  const e = (s.estadoDiferente ?? "").trim();
  if (f) out.formato = f.slice(0, 60);
  if (e) out.estado = { $neq: e.slice(0, 60) };
  return out;
}
