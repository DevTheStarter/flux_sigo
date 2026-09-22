"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import type { RespostaQuadro } from "../../app/api/quadro/route";
import { Toggle } from "../ui/Toggle";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

const DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const HORAS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "16:00", "18:00"];

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function Relatorio() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [ativo, setAtivo] = useState(true);
  const [dia, setDia] = useState("segunda");
  const [hora, setHora] = useState("09:00");
  const [emails, setEmails] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [remover, setRemover] = useState<number | null>(null);
  const [preview, setPreview] = useState<RespostaQuadro | null | "a-ler">(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await supabase.from("config_relatorio").select("ativo, dia_semana, hora, destinatarios").eq("entidade_id", s.entidadeId).maybeSingle();
      const d = r.data as { ativo?: boolean; dia_semana?: string; hora?: string; destinatarios?: string[] } | null;
      if (!d) return;
      if (typeof d.ativo === "boolean") setAtivo(d.ativo);
      if (d.dia_semana) setDia(d.dia_semana.toLowerCase());
      if (d.hora) setHora(d.hora);
      if (Array.isArray(d.destinatarios)) setEmails(d.destinatarios);
    })();
  }, [supabase, s.entidadeId]);

  function adicionar() {
    const e = novo.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast("Email inválido"); return; }
    if (emails.includes(e)) { toast("Já está na lista"); return; }
    setEmails([...emails, e]);
    setNovo("");
  }

  async function guardar() {
    setAGuardar(true);
    const r = await (supabase as any).from("config_relatorio").upsert({ entidade_id: s.entidadeId, ativo, dia_semana: dia, hora, destinatarios: emails }, { onConflict: "entidade_id" });
    setAGuardar(false);
    toast(r.error ? "Não foi possível guardar" : "Relatório guardado");
  }

  async function verPreview() {
    setPreview("a-ler");
    try {
      const r = await fetch("/api/quadro", { cache: "no-store" });
      setPreview((await r.json()) as RespostaQuadro);
    } catch {
      setPreview(null);
      toast("Não foi possível ler o quadro");
    }
  }

  const q = preview && preview !== "a-ler" ? preview : null;
  const late = q?.cartoes.filter((c) => c.estado === "late") ?? [];
  const bl = q?.cartoes.filter((c) => c.estado === "blocked" || c.estado === "error") ?? [];
  const semana = q?.cartoes.filter((c) => c.estado === "today" || (c.estado === "ok" && (c.dias ?? 99) <= 7)) ?? [];
  const concl = q?.cartoes.filter((c) => c.estado === "done" && (c.concluidaHa ?? 99) <= 7) ?? [];

  return (
    <div className="sblock">
      <h2>Relatório semanal</h2>
      <p className="sdesc">Um email com o estado de todas as ações de formação: atrasadas, bloqueadas, para esta semana e concluídas. Enviado para os endereços abaixo, mesmo que não tenham conta no Fluxo.</p>
      <div className="lrow">
        <span className="lrow-b">
          <span className="lrow-t">Enviar relatório semanal</span>
          <span className="lrow-s">{ativo ? `${cap(dia)} às ${hora} · ${emails.length} destinatário${emails.length === 1 ? "" : "s"}` : "Desativado"}</span>
        </span>
        <Toggle on={ativo} label="Enviar relatório semanal" onChange={setAtivo} />
      </div>
      <div style={{ display: "flex", gap: 10, margin: "18px 0 20px" }}>
        <div style={{ flex: 1 }}><label className="fld-l" htmlFor="rel-dia">Dia</label><select id="rel-dia" value={dia} onChange={(e) => setDia(e.target.value)}>{DIAS.map((d) => <option key={d} value={d}>{cap(d)}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="fld-l" htmlFor="rel-hora">Hora</label><select id="rel-hora" value={hora} onChange={(e) => setHora(e.target.value)}>{HORAS.map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
      </div>
      <span className="fld-l">Destinatários</span>
      <div className="emails">
        {emails.length === 0 ? <span className="fld-h" style={{ margin: 0 }}>Sem destinatários.</span> : null}
        {emails.map((e, i) => (
          <span className="etag" key={e}>{e}<button type="button" className="x" aria-label={`Remover ${e}`} onClick={() => setRemover(i)}>×</button></span>
        ))}
      </div>
      <div className="inline">
        <input placeholder="email@entidade.pt" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} aria-label="Novo destinatário" />
        <button type="button" className="btn sm" onClick={adicionar}>Adicionar</button>
      </div>
      <p className="fld-h">Podes adicionar qualquer email, incluindo direção ou contabilidade.</p>
      <div className="row2" style={{ marginTop: 20 }}>
        <button type="button" className="btn sm" disabled={aGuardar} onClick={() => void guardar()}>Guardar</button>
        <button type="button" className="btn sec sm" onClick={() => void verPreview()}>Ver pré-visualização</button>
      </div>

      <Modal open={remover !== null} onClose={() => setRemover(null)} title="Remover destinatário">
        <div className="m-sec"><p className="confirm"><b>{remover !== null ? emails[remover] : ""}</b> deixa de receber o relatório semanal depois de guardares.</p></div>
        <div className="m-f">
          <button type="button" className="btn" onClick={() => { setEmails(emails.filter((_, i) => i !== remover)); setRemover(null); }}>Remover</button>
          <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setRemover(null)}>Cancelar</button>
        </div>
      </Modal>

      <Modal open={preview !== null} onClose={() => setPreview(null)} title="Relatório semanal" subtitle="Pré-visualização do email" lg>
        <div className="m-sec" style={{ borderBottom: "none" }}>
          {preview === "a-ler" ? <p className="sub">A ler o quadro...</p> : q ? (
            <>
              <p style={{ fontSize: 13, marginBottom: 6 }}><b>Estado das ações de formação</b></p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>{s.entidadeNome} · {new Date().toLocaleDateString("pt-PT")}</p>
              <p className="m-lbl">Atrasadas ({late.length})</p>
              {late.map((c) => <p key={c.id} style={{ fontSize: 12, marginBottom: 7 }}>{c.acao.nome} — Flow {c.col}, atrasada {c.dias} dias</p>)}
              <p className="m-lbl" style={{ marginTop: 22 }}>Bloqueadas ({bl.length})</p>
              {bl.map((c) => <p key={c.id} style={{ fontSize: 12, marginBottom: 7 }}>{c.acao.nome} — {c.motivo}</p>)}
              <p className="m-lbl" style={{ marginTop: 22 }}>Para esta semana ({semana.length})</p>
              {semana.map((c) => <p key={c.id} style={{ fontSize: 12, marginBottom: 7 }}>{c.acao.nome} — Flow {c.col}</p>)}
              <p className="m-lbl" style={{ marginTop: 22 }}>Concluídas esta semana ({concl.length})</p>
              {concl.map((c) => <p key={c.id} style={{ fontSize: 12, marginBottom: 7 }}>{c.acao.nome}</p>)}
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 26, paddingTop: 16, borderTop: "0.5px solid var(--line)" }}>Enviado por Fluxo · para deixares de receber, fala com o administrador da tua entidade.</p>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
