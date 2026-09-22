"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { relativo, diasDesde, mesAno } from "../../lib/cliente/datas";
import { Modal } from "../ui/Modal";
import { Toggle } from "../ui/Toggle";
import { useToast } from "../ui/Toast";
import type { EntidadeLinha } from "./Entidades";

interface Problema { id: string; flow: number; acao_nome: string | null; descricao: string; estado: "aberto" | "resolvido"; criado_em: string }

const NOME_FONTE: Record<string, string> = { airtable: "Airtable", sheets: "Google Sheets", notion: "Notion", outro: "Outro" };

export function DetalheEntidade({ e, onClose, onMudou }: { e: EntidadeLinha; onClose: () => void; onMudou: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [apagar, setApagar] = useState(false);
  const [aTrabalhar, setATrabalhar] = useState(false);
  const dias = diasDesde(e.setup_em);

  const carregarProblemas = useCallback(async () => {
    const r = await supabase.from("problemas_reportados").select("id, flow, acao_nome, descricao, estado, criado_em").eq("entidade_id", e.id).order("criado_em", { ascending: false }).limit(20);
    setProblemas((r.data ?? []) as Problema[]);
  }, [supabase, e.id]);

  useEffect(() => { void carregarProblemas(); }, [carregarProblemas]);

  async function patch(campos: Record<string, unknown>, msg: string) {
    setATrabalhar(true);
    const r = await (supabase as any).from("entidades").update(campos).eq("id", e.id);
    setATrabalhar(false);
    if (r.error) { toast("Não foi possível alterar"); return; }
    toast(msg);
    await onMudou();
  }

  async function convidar() {
    const v = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast("Email inválido"); return; }
    setATrabalhar(true);
    try {
      const r = await fetch("/api/admin/convites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: v, funcao: "admin", entidade_id: e.id }) });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      setEmail("");
      toast(`Convite criado para ${v}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setATrabalhar(false);
    }
  }

  async function resolver(p: Problema) {
    const r = await (supabase as any).from("problemas_reportados").update({ estado: "resolvido" }).eq("id", p.id);
    if (r.error) { toast("Não foi possível marcar"); return; }
    await carregarProblemas();
    await onMudou();
    toast("Marcado como resolvido");
  }

  async function apagarAgora() {
    setATrabalhar(true);
    try {
      const r = await fetch("/api/admin/entidades", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id }) });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      toast(`${e.nome} apagada`);
      onClose();
      await onMudou();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setATrabalhar(false);
    }
  }

  if (apagar) {
    return (
      <Modal open onClose={() => setApagar(false)} title={`Apagar ${e.nome}`}>
        <div className="m-sec">
          <p className="confirm">Apaga <b>{e.utilizadores} conta{e.utilizadores === 1 ? "" : "s"}</b>, as vistas guardadas, os prazos e a credencial de acesso.</p>
          <p className="confirm">As ações de formação, os registos e os formandos <b>não são afetados</b>. Sempre estiveram na base de dados da entidade.</p>
          <p className="confirm muted">Não pode ser desfeito. Se for temporário, desativa em vez de apagar.</p>
        </div>
        <div className="m-f">
          <button type="button" className="btn" disabled={aTrabalhar} onClick={() => void apagarAgora()}>Apagar definitivamente</button>
          <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setApagar(false)}>Cancelar</button>
        </div>
      </Modal>
    );
  }

  const abertos = problemas.filter((p) => p.estado === "aberto");

  return (
    <Modal open onClose={onClose} title={e.nome} subtitle={`NIPC ${e.nipc || "—"} · desde ${mesAno(e.setup_em ?? e.criada_em)}`}>
      <div className="m-sec">
        <table className="kv"><tbody>
          <tr><td>Estado</td><td>{e.ativa ? "Ativa" : "Inativa"}</td></tr>
          <tr><td>Utilizadores</td><td>{e.utilizadores}</td></tr>
          <tr><td>Ações acompanhadas</td><td>{e.acoes ?? "—"}</td></tr>
          <tr><td>Fonte de dados</td><td>{e.fonteConfigurada ? NOME_FONTE[(e.fonteTipo ?? "airtable").toLowerCase()] ?? e.fonteTipo : "por ligar"}</td></tr>
          <tr><td>Última atividade</td><td>{e.ultimaAtividade ? relativo(e.ultimaAtividade) : "nunca"}</td></tr>
          <tr><td>Contrato</td><td>{e.contrato_assinado ? "Assinado" : <span style={{ color: "var(--red)" }}>Em falta</span>}</td></tr>
          <tr><td>Setup</td><td>{dias === null ? "—" : `há ${dias} dias`}</td></tr>
        </tbody></table>
        {!e.contrato_assinado ? (
          <div className="note" style={{ marginTop: 14 }}>
            <span className="note-t">Contrato em falta</span>
            <span className="note-s">Está a usar o Fluxo sem contrato de subcontratação assinado. Resolver antes de continuar.</span>
            <div className="row2"><button type="button" className="btn sec sm" disabled={aTrabalhar} onClick={() => void patch({ contrato_assinado: true }, "Contrato marcado como assinado")}>Marcar como assinado</button></div>
          </div>
        ) : null}
      </div>
      <div className="m-sec">
        <div className="note neutro" style={{ marginBottom: 0 }}>
          <span className="note-t2">Não tens acesso ao quadro desta entidade</span>
          <span className="note-s">Vês quem tem acesso, o estado da ligação e a atividade. O conteúdo das ações e dos registos fica na base deles e só lhes é mostrado a eles.</span>
        </div>
      </div>
      <div className="m-sec">
        <div className="m-lbl">Plano de suporte mensal</div>
        <div className="lrow sem-topo">
          <span className="lrow-b">
            <span className="lrow-t">Suporte ativo</span>
            <span className="lrow-s">{e.suporte ? "Recebe atualizações da documentação e pode reportar problemas." : dias !== null && dias <= 30 ? `Sem plano, mas ainda dentro dos 30 dias de setup. Faltam ${30 - dias} dias.` : "Sem plano. Não recebe atualizações nem pode reportar problemas."}</span>
          </span>
          <Toggle on={e.suporte} label="Suporte ativo" onChange={(v) => void patch({ suporte: v }, v ? `Suporte ativado para ${e.nome}` : `Suporte desativado para ${e.nome}`)} />
        </div>
        <p className="fld-h">Nos primeiros 30 dias após o setup o suporte está incluído. Depois disso, sem plano mensal a entidade deixa de receber documentação atualizada e o botão de reportar problemas desaparece.</p>
      </div>
      <div className="m-sec">
        <div className="fld" style={{ marginBottom: 0 }}>
          <label className="fld-l" htmlFor="ent-conv">Convidar utilizador</label>
          <div className="inline">
            <input id="ent-conv" placeholder="email@entidade.pt" value={email} onChange={(ev) => setEmail(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") void convidar(); }} />
            <button type="button" className="btn sm" disabled={aTrabalhar} onClick={() => void convidar()}>Convidar</button>
          </div>
          <p className="fld-h">Recebe um link para definir palavra-passe, válido 7 dias. Entra como administrador da entidade.</p>
        </div>
      </div>
      {problemas.length ? (
        <div className="m-sec">
          <div className="m-lbl">Problemas reportados{abertos.length ? ` · ${abertos.length} em aberto` : ""}</div>
          {problemas.map((p) => (
            <div className="lrow" key={p.id} style={{ borderTop: "none" }}>
              <span className="lrow-b">
                <span className="lrow-t">Flow {p.flow}{p.acao_nome ? ` · ${p.acao_nome}` : ""}</span>
                <span className="lrow-s">{p.descricao.length > 140 ? p.descricao.slice(0, 140) + "…" : p.descricao} · {relativo(p.criado_em)}</span>
              </span>
              {p.estado === "aberto" ? (
                <button type="button" className="btn sec sm" onClick={() => void resolver(p)}>Marcar resolvido</button>
              ) : (
                <span className="pill">resolvido</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <div className="m-f">
        <button type="button" className="btn sec" disabled={aTrabalhar} onClick={() => void patch({ ativa: !e.ativa }, e.ativa ? `${e.nome} desativada` : `${e.nome} reativada`)}>{e.ativa ? "Desativar acesso" : "Reativar acesso"}</button>
        <p className="hint">{e.ativa ? "Bloqueia o acesso de todos de imediato. Os dados nunca estiveram do nosso lado, por isso não se perde nada." : "Repõe o acesso com a configuração anterior."}</p>
        <button type="button" className="btn sec perigo" style={{ marginTop: 12 }} onClick={() => setApagar(true)}>Apagar definitivamente</button>
      </div>
    </Modal>
  );
}
