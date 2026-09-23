import type { Cartao } from "../dados/derivar";
import { escaparHtml } from "./quadro";

/** Conteúdo do relatório semanal (§12), em PT-PT, sem dados pessoais. */
export function corpoRelatorio(entidade: string, cartoes: Cartao[], data: string): { assunto: string; html: string; texto: string } {
  const late = cartoes.filter((c) => c.estado === "late");
  const bloq = cartoes.filter((c) => c.estado === "blocked" || c.estado === "error");
  const semana = cartoes.filter((c) => c.estado === "today" || (c.estado === "ok" && (c.dias ?? 99) <= 7));
  const concl = cartoes.filter((c) => c.estado === "done" && (c.concluidaHa ?? 99) <= 7);

  const seccao = (titulo: string, linhas: string[]) =>
    `<p style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#8d8d8d;margin:22px 0 8px">${titulo} (${linhas.length})</p>` +
    (linhas.length ? linhas.map((l) => `<p style="margin:0 0 7px;font-size:13px">${l}</p>`).join("") : `<p style="margin:0;font-size:13px;color:#8d8d8d">Nenhuma.</p>`);

  const html =
    `<div style="font-family:Inter,Arial,sans-serif;color:#111;max-width:560px">` +
    `<p style="font-size:14px;margin:0 0 4px"><b>Estado das ações de formação</b></p>` +
    `<p style="font-size:12px;color:#8d8d8d;margin:0 0 12px">${escaparHtml(entidade)} · ${data}</p>` +
    seccao("Atrasadas", late.map((c) => `${escaparHtml(c.acao.nome)}: Flow ${c.col}, atrasada ${c.dias ?? 0} ${c.dias === 1 ? "dia" : "dias"}`)) +
    seccao("Bloqueadas", bloq.map((c) => `${escaparHtml(c.acao.nome)}: ${escaparHtml(c.motivo ?? (c.estado === "error" ? "erro no flow" : "bloqueada"))}`)) +
    seccao("Para esta semana", semana.map((c) => `${escaparHtml(c.acao.nome)}: Flow ${c.col}${c.estado === "today" ? ", hoje" : c.dias !== undefined ? `, em ${c.dias} ${c.dias === 1 ? "dia" : "dias"}` : ""}`)) +
    seccao("Concluídas esta semana", concl.map((c) => escaparHtml(c.acao.nome))) +
    `<p style="font-size:11px;color:#8d8d8d;margin-top:26px;padding-top:16px;border-top:1px solid #e8e8e8">Enviado por Fluxo · para deixares de receber, fala com o administrador da tua entidade.</p>` +
    `</div>`;

  const linhaTxt = (t: string, xs: string[]) => `${t} (${xs.length})\n${xs.length ? xs.map((x) => `- ${x}`).join("\n") : "Nenhuma."}`;
  const texto = [
    `Estado das ações de formação`,
    `${entidade} · ${data}`,
    "",
    linhaTxt("Atrasadas", late.map((c) => `${c.acao.nome}: Flow ${c.col}, atrasada ${c.dias ?? 0} dias`)),
    "",
    linhaTxt("Bloqueadas", bloq.map((c) => `${c.acao.nome}: ${c.motivo ?? "bloqueada"}`)),
    "",
    linhaTxt("Para esta semana", semana.map((c) => `${c.acao.nome}: Flow ${c.col}`)),
    "",
    linhaTxt("Concluídas esta semana", concl.map((c) => c.acao.nome)),
    "",
    "Enviado por Fluxo · para deixares de receber, fala com o administrador da tua entidade.",
  ].join("\n");

  const resumo = [
    late.length ? `${late.length} atrasada${late.length === 1 ? "" : "s"}` : null,
    bloq.length ? `${bloq.length} bloqueada${bloq.length === 1 ? "" : "s"}` : null,
    `${semana.length} para esta semana`,
  ]
    .filter(Boolean)
    .join(", ");
  return { assunto: `Fluxo · relatório semanal de ${entidade}: ${resumo}`, html, texto };
}
