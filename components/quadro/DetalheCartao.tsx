"use client";

import { useState } from "react";
import type { CartaoQuadro } from "../../app/api/quadro/route";
import { NOMES_FLOWS } from "../../lib/cliente/flows";
import { dataCurta } from "../../lib/cliente/datas";
import { estimar, formatarDuracao } from "../../lib/dados/estimar";
import { podeReportar, useSessao } from "../../lib/cliente/sessao";
import { useVariaveisEntidade } from "../../lib/cliente/config";
import { instrucaoCurta } from "../../lib/cliente/instrucao";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { NotificarModal } from "./NotificarModal";
import { ReportarModal } from "./ReportarModal";

/** Detalhe do cartão (§4.7). Modal no desktop, ecrã inteiro no mobile. */
export function DetalheCartao({ c, onClose }: { c: CartaoQuadro; onClose: () => void }) {
  const s = useSessao();
  const toast = useToast();
  const { valores } = useVariaveisEntidade(s.entidadeId);
  const [copiado, setCopiado] = useState(false);
  const [sub, setSub] = useState<"notificar" | "reportar" | null>(null);
  const a = c.acao;
  const fase = Math.min(c.col, 5);
  const feito = c.estado === "done";
  const travado = c.estado === "late" || c.estado === "error" || c.estado === "blocked";
  const dur = !feito ? formatarDuracao(estimar(fase, a.formandos)) : null;
  const longo = fase === 4 && a.formandos >= 8 && !feito;

  function estadoAtual(): string {
    switch (c.estado) {
      case "blocked": return "Bloqueado";
      case "error": return "Erro";
      case "late": return `Atrasado ${c.dias ?? 0}d`;
      case "today": return "Hoje";
      case "futura": return `Entra daqui a ${c.entraEm ?? 0} dias`;
      default: return c.dias != null ? `Em ${c.dias} dias` : "Sem prazo";
    }
  }

  async function copiar() {
    const { texto, faltam } = instrucaoCurta(c, valores);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
      if (faltam.length) toast(`Copiado · ${faltam.length} ${faltam.length === 1 ? "variável" : "variáveis"} por preencher em Credenciais`);
    } catch {
      toast("Não foi possível copiar. Seleciona e copia à mão.");
    }
  }

  if (sub === "notificar") return <NotificarModal c={c} onClose={() => setSub(null)} onFechado={onClose} />;
  if (sub === "reportar") return <ReportarModal c={c} onClose={() => setSub(null)} onFechado={onClose} />;

  return (
    <Modal open onClose={onClose} title={a.nome} subtitle={`${a.codigoCurso} · ${a.tipo}`}>
      <div className="m-sec">
        <div className="m-lbl">Progresso</div>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const done = feito || i < c.col;
          const now = !feito && i === c.col;
          const m = done ? dataCurta(c.feitas?.[i]) : now ? estadoAtual() : "";
          return (
            <div key={i} className={"step " + (now ? "now" : done ? "" : "todo")}>
              <div className={"dot " + (done ? "done" : now ? (travado ? "now red" : "now") : "")} />
              <span className="step-t">Flow {i} · {NOMES_FLOWS[i]}</span>
              <span className={"step-m" + (now && travado ? " red" : "")}>{m}</span>
            </div>
          );
        })}
      </div>

      <div className="m-sec">
        <table className="kv">
          <tbody>
            <tr><td>Datas</td><td>{dataCurta(a.dataInicio)} → {dataCurta(a.dataFim)}</td></tr>
            <tr><td>Dias</td><td>{a.diasSemana || "—"}</td></tr>
            <tr><td>Formandos</td><td>{a.formandos}</td></tr>
            {dur ? (
              <tr>
                <td>Duração estimada</td>
                <td>{dur}<span className="calc" title={`Estimativa para o Flow ${fase} com ${a.formandos} formandos. Depende da resposta do SIGO.`}>Flow {fase}</span></td>
              </tr>
            ) : null}
            <tr><td>Formato</td><td>{a.formato || "—"}</td></tr>
          </tbody>
        </table>
        <button type="button" className="btn sec" style={{ marginTop: 14 }} onClick={() => setSub("notificar")}>Notificar</button>
      </div>

      <div className="m-f">
        {feito ? (
          <button type="button" className="btn" disabled>Ação concluída</button>
        ) : c.estado === "blocked" ? (
          <>
            <div className="note">
              <span className="note-t">{c.motivo || "Bloqueada"}</span>
              <span className="note-s">Resolve na base de dados para desbloquear este flow.</span>
            </div>
            <button type="button" className="btn" disabled>Bloqueado</button>
          </>
        ) : c.estado === "futura" ? (
          <>
            <div className="note neutro">
              <span className="note-t2">Ainda não entrou no quadro</span>
              <span className="note-s">Entra daqui a {c.entraEm ?? 0} dias. Podes copiar a instrução na mesma.</span>
            </div>
            <button type="button" className="btn" onClick={copiar}>{copiado ? "✓ Copiado" : `⧉ Copiar instrução do Flow ${fase}`}</button>
            <p className="hint">Cola no assistente de IA. O prompt completo está na documentação.</p>
          </>
        ) : (
          <>
            {c.estado === "error" ? (
              <div className="note">
                <span className="note-t">{c.motivo || "Erro"}</span>
                <span className="note-s">
                  {fase === 5
                    ? "Repetir é seguro. Os certificados já foram emitidos no SIGO, o Flow 5 só trata dos PDFs e da base de dados. Voltar a correr não duplica nada."
                    : "Volta a correr depois de resolveres a causa. O registo de erro é atualizado, não duplicado."}
                </span>
              </div>
            ) : longo ? (
              <div className="note neutro">
                <span className="note-t2">Execução longa</span>
                <span className="note-s">Com {a.formandos} formandos, o Flow 4 demora cerca de {dur}. É o único flow longo. Usa o computador designado e confirma que não adormece a meio.</span>
              </div>
            ) : null}
            <button type="button" className="btn" onClick={copiar}>{copiado ? "✓ Copiado" : `⧉ Copiar instrução do Flow ${fase}`}</button>
            <p className="hint">Cola no assistente de IA. O prompt completo está na documentação.</p>
          </>
        )}

        {c.estado === "error" || c.estado === "blocked" ? (
          podeReportar(s) ? (
            <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setSub("reportar")}>Reportar problema à TheStarter</button>
          ) : (
            <p className="hint" style={{ marginTop: 14 }}>Reportar problemas exige plano de suporte mensal.<br />Fala connosco em people@thestarter.io.</p>
          )
        ) : null}

        <div style={{ textAlign: "center", marginTop: 12 }}>
          {a.urlOrigem ? (
            <a className="link" href={a.urlOrigem} target="_blank" rel="noopener noreferrer">Abrir na fonte de dados</a>
          ) : (
            <span className="link" style={{ textDecoration: "none" }}>Sem ligação à fonte de dados</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
