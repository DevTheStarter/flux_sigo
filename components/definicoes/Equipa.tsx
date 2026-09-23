"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { iniciais, ROTULO_FUNCAO, useSessao, type Funcao } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { useToast } from "../ui/Toast";

interface Membro { id: string; nome: string; email: string; funcao: Funcao; ultimo_acesso: string | null }

export function Equipa() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [email, setEmail] = useState("");
  const [funcao, setFuncao] = useState<"admin" | "gestor" | "leitura">("gestor");
  const [aEnviar, setAEnviar] = useState(false);
  const [ligacao, setLigacao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await supabase.from("utilizadores").select("id, nome, email, funcao, ultimo_acesso").eq("entidade_id", s.entidadeId).order("criado_em");
    setMembros((r.data ?? []) as Membro[]);
  }, [supabase, s.entidadeId]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function convidar() {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast("Email inválido"); return; }
    setAEnviar(true);
    setLigacao(null);
    try {
      const r = await fetch("/api/admin/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, funcao, entidade_id: s.entidadeId }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; emailEnviado?: boolean; ligacao?: string | null };
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      setEmail("");
      toast(j.emailEnviado ? `Convite enviado a ${e}` : `Convite criado para ${e}. Partilha o link.`);
      setLigacao(j.emailEnviado ? null : j.ligacao ?? null);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="sblock">
      <h2>Equipa</h2>
      <p className="sdesc">Quem tem acesso ao quadro. Administradores podem convidar pessoas.</p>
      {membros.map((m) => (
        <div className="lrow" key={m.id}>
          <span className="ava sm">{iniciais(m.nome, m.email)}</span>
          <span className="lrow-b">
            <span className="lrow-t">{m.nome || m.email}{m.id === s.id ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> (tu)</span> : null}</span>
            <span className="lrow-s">{m.email} · {m.ultimo_acesso ? `último acesso ${relativo(m.ultimo_acesso)}` : "ainda não entrou"}</span>
          </span>
          <span className={"pill" + (m.funcao === "admin" || m.funcao === "staff" ? " fill" : "")}>{ROTULO_FUNCAO[m.funcao]}</span>
        </div>
      ))}
      <div className="inline" style={{ marginTop: 18 }}>
        <input placeholder="email@entidade.pt" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void convidar(); }} aria-label="Email a convidar" />
        <select value={funcao} onChange={(e) => setFuncao(e.target.value as typeof funcao)} className="sel-s" aria-label="Função">
          <option value="admin">Administrador</option>
          <option value="gestor">Gestor</option>
          <option value="leitura">Só leitura</option>
        </select>
        <button type="button" className="btn sm" disabled={aEnviar} onClick={() => void convidar()}>Convidar</button>
      </div>
      <p className="fld-h">A pessoa recebe um email com o link de acesso, válido 7 dias.</p>
      {ligacao ? (
        <div className="note neutro" style={{ marginTop: 14 }}>
          <span className="note-t2">Envio de email não configurado</span>
          <span className="note-s">Partilha este link com a pessoa. Válido 7 dias, uso único.</span>
          <input readOnly value={ligacao} onFocus={(ev) => ev.currentTarget.select()} aria-label="Link do convite" style={{ marginTop: 8 }} />
        </div>
      ) : null}
    </div>
  );
}
