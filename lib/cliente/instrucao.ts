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

const RX_BASE = /app[A-Za-z0-9]{14}/;
const RX_TBL = /^tbl[A-Za-z0-9]{14}$/;

/**
 * Link da ação para a instrução: aponta sempre para o registo da ação, nunca
 * para a base inteira. Usa o link da fonte quando já traz o registo; senão
 * (sem id da tabela, `urlOrigem` fica com o link geral da base) constrói-o
 * com a base, o id da tabela se estiver nas variáveis, e o id do registo.
 */
export function linkDaAcao(a: CartaoQuadro["acao"], valores: Record<string, string> = {}): string | null {
  const url = a.urlOrigem ?? "";
  if (url && url.endsWith(`/${a.id}`)) return url;
  const base = RX_BASE.exec(url)?.[0] ?? (RX_BASE.test(valores.CRM_BASE ?? "") ? RX_BASE.exec(valores.CRM_BASE!)![0] : null);
  if (!base) return null;
  const tbl = (valores.TBL_ACOES ?? "").trim();
  return RX_TBL.test(tbl) ? `https://airtable.com/${base}/${tbl}/${a.id}` : `https://airtable.com/${base}/${a.id}`;
}

export function instrucaoCurta(c: CartaoQuadro, valores: Record<string, string>): { texto: string; faltam: string[] } {
  const a = c.acao;
  const fase = c.col;
  const referencia = linkDaAcao(a, valores) ?? `"${a.nome}"`;
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
