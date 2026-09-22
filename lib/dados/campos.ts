import type { Acao, Registo } from "./interface";

/**
 * Lista de campos acedidos, gerada a partir das interfaces (§7.1, §17 Privacidade).
 * `satisfies` garante que qualquer campo novo nas interfaces obriga a atualizar esta lista.
 */
export const CAMPOS_ACAO = {
  id: "identificador do registo na base de dados",
  nome: "nome da ação de formação",
  codigoCurso: "código do curso",
  dataInicio: "data de início",
  dataFim: "data de fim",
  tipo: "tipo de formação",
  formato: "formato (PT, BR)",
  diasSemana: "dias da semana",
  estado: "estado da ação na base de dados",
  ano: "ano",
  formandos: "número de formandos (campo calculado na base de dados; só o número)",
  temAvaliacoes: "se existe tabela de avaliações (campo calculado; sim ou não)",
  urlOrigem: "ligação para o registo na base de dados",
} satisfies Record<keyof Acao, string>;

export const CAMPOS_REGISTO = {
  acaoId: "ação de formação a que o registo pertence",
  flow: "flow (0 a 5)",
  estado: "estado do registo (Success, Missing Data, Error)",
  data: "data do registo",
  detalhe: "resumo escrito pelos vossos flows, mostrado tal como está na base de dados",
} satisfies Record<keyof Registo, string>;

export function listaCamposTexto(): string {
  const linhas: string[] = [];
  linhas.push("Fluxo · campos lidos na base de dados da entidade");
  linhas.push("Gerado a partir da definição do adaptador (FonteDeDados). Nada fora desta lista é pedido.");
  linhas.push("");
  linhas.push("Tabela de ações de formação");
  for (const [k, v] of Object.entries(CAMPOS_ACAO)) linhas.push(`  - ${k}: ${v}`);
  linhas.push("");
  linhas.push("Tabela de registos de execução");
  for (const [k, v] of Object.entries(CAMPOS_REGISTO)) linhas.push(`  - ${k}: ${v}`);
  linhas.push("");
  linhas.push("Nunca lido: tabela de formandos (NIF, documento, morada, data de nascimento, nacionalidade), anexos, contratos, tabelas de avaliação.");
  linhas.push("Nunca escrito: o adaptador não tem método de escrita.");
  return linhas.join("\n");
}
