import type { Acao, Flow, Registo } from "./interface";
import { calcularPrazo, diasAte, diasDesde, mergePrazos, type PrazosCfg } from "./prazos";

export type EstadoCartao =
  | "ok"
  | "today"
  | "late"
  | "error"
  | "blocked"
  | "done"
  | "futura";

export interface Cartao {
  id: string;
  acao: Acao;
  col: number;
  estado: EstadoCartao;
  dias?: number;
  entraEm?: number;
  concluidaHa?: number;
  motivo?: string;
  prazo?: string;
}

type PartialPrazosCfg = Partial<PrazosCfg>;

const byDataDesc = (a: { data: string }, b: { data: string }) =>
  a.data < b.data ? 1 : -1;

/**
 * Algoritmo §4.2 exato da spec.
 * Coluna = primeira fase sem success log.
 * Estado = ordem de prioridade futura → ok → today → late → error → blocked → done.
 *
 * @param hoje Data de referência para testes (default: new Date())
 */
export function derivar(
  a: Acao,
  logs: Registo[],
  cfg: PartialPrazosCfg = PRAZOS_DEFAULTS_PARCIAL,
  hoje: Date = new Date()
): Cartao {
  const meus = logs.filter((l) => l.acaoId === a.id);
  const ok = (f: number) => meus.some((l) => l.flow === f && l.estado === "success");

  const c: PrazosCfg = mergePrazos(cfg);

  let col: Flow = 0;
  while (col <= 5 && ok(col)) col = (col + 1) as Flow;

  if (col > 5) {
    const ultimo = meus
      .filter((l) => l.flow === 5 && l.estado === "success")
      .sort(byDataDesc)[0];
    return {
      id: a.id,
      acao: a,
      col: 6,
      estado: "done",
      concluidaHa: ultimo ? diasDesde(ultimo.data, hoje) : 0,
    };
  }

  if (diasAte(a.dataFim, hoje) > c.entrada) {
    return {
      id: a.id,
      acao: a,
      col,
      estado: "futura",
      entraEm: diasAte(a.dataFim, hoje) - c.entrada,
    };
  }

  if (col === 4 && !a.temAvaliacoes) {
    return {
      id: a.id,
      acao: a,
      col,
      estado: "blocked",
      motivo: "Falta tabela de avaliações",
    };
  }

  const ultimo = meus.filter((l) => l.flow === col).sort(byDataDesc)[0];
  if (ultimo?.estado === "error") {
    return {
      id: a.id,
      acao: a,
      col,
      estado: "error",
      motivo: ultimo.detalhe,
    };
  }
  if (ultimo?.estado === "missing_data") {
    return {
      id: a.id,
      acao: a,
      col,
      estado: "blocked",
      motivo: ultimo.detalhe,
    };
  }

  const prazo = calcularPrazo(a, col, meus, c);
  if (!prazo) {
    return { id: a.id, acao: a, col, estado: "ok" };
  }
  const d = diasAte(prazo, hoje);
  if (d < 0) return { id: a.id, acao: a, col, estado: "late", dias: -d, prazo };
  if (d === 0) return { id: a.id, acao: a, col, estado: "today", prazo };
  return { id: a.id, acao: a, col, estado: "ok", dias: d, prazo };
}

const PRAZOS_DEFAULTS_PARCIAL: PartialPrazosCfg = {};

export const NOMES_FASES: Record<number, string> = {
  0: "Dados",
  1: "Perfis",
  2: "Curso",
  3: "Ação",
  4: "Certificação",
  5: "Conclusão",
};
