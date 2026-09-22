import type { CartaoQuadro } from "../../app/api/quadro/route";
import { NOMES_FLOWS } from "./flows";
import { substituir } from "./variaveis";
import { dataCurta } from "./datas";

/**
 * Instrução curta (§4.9). Nunca inclui SIGO_PALAVRA nem CRM_TOKEN.
 * As variáveis são substituídas no cliente; as desconhecidas ficam como estão.
 */
export function instrucaoCurta(c: CartaoQuadro, valores: Record<string, string>): { texto: string; faltam: string[] } {
  const a = c.acao;
  const fase = c.col;
  const modelo =
    `Corre o Flow ${fase} (${NOMES_FLOWS[fase]}) para a ação de formação "${a.nome}".\n\n` +
    `Código do curso: ${a.codigoCurso}\n` +
    `Datas: ${dataCurta(a.dataInicio)} a ${dataCurta(a.dataFim)}\n` +
    `Formandos: ${a.formandos}\n\n` +
    `SIGO: {{SIGO_URL}} · utilizador {{SIGO_UTILIZADOR}}\n` +
    `Base de dados: {{CRM_TIPO}} · {{CRM_BASE}}\n\n` +
    `Segue as instruções de flow-${fase}.md.`;
  return substituir(modelo, valores, false);
}
