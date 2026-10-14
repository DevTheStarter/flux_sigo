import type { CartaoQuadro } from "../../app/api/quadro/route";
import { NOMES_FLOWS } from "./flows";
import { substituir } from "./variaveis";
import { dataCurta } from "./datas";

/**
 * Instrução curta (§4.9). Nunca inclui SIGO_PALAVRA nem CRM_TOKEN.
 * As variáveis são substituídas no cliente; as desconhecidas ficam como estão.
 *
 * O Flow 0 corre no Claude (só precisa do link da ação). Os Flows 1 a 5 correm
 * no Claude in Chrome e chamam-se pelo atalho /flow-N.
 */
export function atalhoFlow(fase: number): string {
  return `/flow-${fase}`;
}

/**
 * Link da ação para a instrução: só serve se apontar para o registo da ação.
 * Sem id da tabela, `urlOrigem` fica com o link geral da base (abre no cartão,
 * mas não identifica a ação), e aí a instrução usa o nome entre aspas.
 */
export function linkDaAcao(a: CartaoQuadro["acao"]): string | null {
  if (!a.urlOrigem) return null;
  return a.urlOrigem.endsWith(`/${a.id}`) ? a.urlOrigem : null;
}

export function instrucaoCurta(c: CartaoQuadro, valores: Record<string, string>): { texto: string; faltam: string[] } {
  const a = c.acao;
  const fase = c.col;
  const referencia = linkDaAcao(a) ?? `"${a.nome}"`;
  const ultimaLinha = fase === 0 ? `Segue as instruções do Flow 0` : `Segue as instruções do ${atalhoFlow(fase)}`;
  const modelo =
    `Executa o Flow ${fase} (${NOMES_FLOWS[fase]}) para a ação de formação ${referencia}\n\n` +
    `Código do curso: ${a.codigoCurso}\n` +
    `Datas: ${dataCurta(a.dataInicio)} a ${dataCurta(a.dataFim)}\n` +
    `Formandos: ${a.formandos}\n\n` +
    `SIGO: {{SIGO_URL}} · utilizador {{SIGO_UTILIZADOR}}\n` +
    `Base de dados: {{CRM_TIPO}} · {{CRM_BASE}}\n\n` +
    ultimaLinha;
  return substituir(modelo, valores, false);
}
