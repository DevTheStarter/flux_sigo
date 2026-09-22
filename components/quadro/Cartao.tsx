"use client";

import type { CartaoQuadro } from "../../app/api/quadro/route";
import { dataCurta, plural } from "../../lib/cliente/datas";

export function classeEstado(estado: CartaoQuadro["estado"]): string {
  switch (estado) {
    case "late":
    case "error": return "stuck";
    case "today": return "urgent";
    case "blocked": return "blocked";
    case "done": return "done";
    case "futura": return "futura";
    default: return "";
  }
}

export function textoEstado(c: CartaoQuadro): { texto: string; cls: string } {
  switch (c.estado) {
    case "futura": return { texto: `Entra daqui a ${plural(c.entraEm ?? 0, "dia", "dias")}`, cls: "due" };
    case "done": return { texto: `Concluída há ${plural(c.concluidaHa ?? 0, "dia", "dias")}`, cls: "due" };
    case "blocked": return { texto: `↯ ${c.motivo || "Bloqueada"}`, cls: "due red" };
    case "error": return { texto: `↯ ${c.motivo || "Erro"}`, cls: "due red" };
    case "late": return { texto: `Atrasado ${c.dias ?? 0}d`, cls: "due red" };
    case "today": return { texto: "Hoje", cls: "due hot" };
    default:
      return { texto: c.dias != null ? `Em ${plural(c.dias, "dia", "dias")}` : "Sem prazo definido", cls: "due" };
  }
}

export function Cartao({ c, onClick }: { c: CartaoQuadro; onClick: () => void }) {
  const d = textoEstado(c);
  return (
    <button type="button" className={"card " + classeEstado(c.estado)} onClick={onClick}>
      <div className="card-top"><span className="card-t">{c.acao.nome}</span></div>
      <div className="card-d">{dataCurta(c.acao.dataInicio)} → {dataCurta(c.acao.dataFim)}</div>
      {c.estado !== "done" && c.estado !== "futura" && c.acao.tipo ? (
        <div className="tags"><span className="tag">{c.acao.tipo}</span></div>
      ) : null}
      <div className={d.cls}>{d.texto}</div>
    </button>
  );
}
