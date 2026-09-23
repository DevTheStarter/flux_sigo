import { NOMES_FASES, type Cartao } from "../dados/derivar";

/**
 * Transições que geram avisos (§10.1, §10.3). Compara o cartão derivado agora
 * com a linha guardada em `estado_notificacoes` na execução anterior.
 */
export type Evento = "prazo" | "bloqueio" | "concluido" | "falha_sync";

export interface Aviso {
  evento: Evento;
  corpo: string;
  acaoRef: string | null;
}

export interface EstadoRow {
  acao_ref: string;
  coluna: string;
  estado: string;
}

export const REF_SYNC = "__sync";

export const DEF_EVENTOS: Record<string, boolean> = { notificado: true, prazo: true, bloqueio: true, concluido: false, falha_sync: true };
export const DEF_CANAIS: Record<string, boolean> = { app: true, email: true };

export function avisoDoCartao(c: Cartao, anterior: EstadoRow | undefined): Aviso | null {
  const nome = c.acao.nome;
  const fase = `Flow ${c.col}`;
  if (!anterior) return null; // primeira execução para esta ação: regista sem avisar
  const colAnterior = Number(anterior.coluna);
  const estadoMudou = anterior.estado !== c.estado;

  if (c.estado === "done" && anterior.estado !== "done") {
    return { evento: "concluido", corpo: `A ação de formação "${nome}" foi concluída. Os seis flows estão feitos.`, acaoRef: c.id };
  }
  if (c.col > colAnterior && c.col <= 5 && Number.isFinite(colAnterior)) {
    return {
      evento: "concluido",
      corpo: `Flow ${colAnterior} (${NOMES_FASES[colAnterior] ?? ""}) da ação de formação "${nome}" concluído. Segue-se o ${fase}.`,
      acaoRef: c.id,
    };
  }
  if (estadoMudou && c.estado === "late") {
    const dias = c.dias ?? 0;
    return {
      evento: "prazo",
      corpo: `A ação de formação "${nome}" passou o prazo do ${fase}${dias > 0 ? ` há ${dias} ${dias === 1 ? "dia" : "dias"}` : ""}.`,
      acaoRef: c.id,
    };
  }
  if (estadoMudou && c.estado === "blocked") {
    return { evento: "bloqueio", corpo: `A ação de formação "${nome}" ficou bloqueada no ${fase}: ${c.motivo ?? "sem motivo registado"}.`, acaoRef: c.id };
  }
  if (estadoMudou && c.estado === "error") {
    return { evento: "bloqueio", corpo: `O ${fase} da ação de formação "${nome}" terminou com erro: ${c.motivo ?? "sem detalhe"}.`, acaoRef: c.id };
  }
  return null;
}
