"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessao } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { useToast } from "../ui/Toast";
import type { EstadoLigacaoResposta } from "../../app/api/ligacao/route";

const FONTES: [string, string, string][] = [
  ["airtable", "Airtable", "Base com as tabelas de ações e de registos de execução"],
  ["sheets", "Google Sheets", "Duas folhas: ações e registos de execução"],
  ["notion", "Notion", "Duas bases de dados"],
  ["outro", "Outro sistema", "Qualquer fonte que exponha os campos necessários. Falem connosco."],
];

/** Ligação de dados (§17): estado, permissões da credencial, credencial só de leitura, mudar de fonte. */
export function Ligacao() {
  const s = useSessao();
  const toast = useToast();
  const admin = s.funcao === "admin" || s.funcao === "staff";
  const [estado, setEstado] = useState<EstadoLigacaoResposta | null>(null);
  const [base, setBase] = useState("");
  const [token, setToken] = useState("");
  const [tblAcoes, setTblAcoes] = useState("");
  const [tblLogs, setTblLogs] = useState("");
  const [tblForm, setTblForm] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [aSincronizar, setASincronizar] = useState(false);

  const ler = useCallback(async (verificar = false) => {
    const r = await fetch(`/api/ligacao${verificar ? "?verificar=1" : ""}`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as EstadoLigacaoResposta;
      setEstado(j);
      setBase((b) => b || j.fonteBase || "");
    }
  }, []);

  useEffect(() => { void ler(); }, [ler]);

  async function guardar() {
    setAGuardar(true);
    const body: Record<string, string> = { fonteTipo: estado?.fonteTipo ?? "airtable", fonteBase: base.trim() };
    if (token.trim()) body.token = token.trim();
    if (tblAcoes.trim()) body.tabelaAcoes = tblAcoes.trim();
    if (tblLogs.trim()) body.tabelaRegistos = tblLogs.trim();
    if (tblForm.trim()) body.tabelaFormandos = tblForm.trim();
    const r = await fetch("/api/ligacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setAGuardar(false);
    if (!r.ok) { toast("Não foi possível guardar a ligação"); return; }
    setToken("");
    toast("Ligação guardada");
    await ler(true);
  }

  async function sincronizar() {
    setASincronizar(true);
    await fetch("/api/ligacao/sincronizar", { method: "POST" });
    await ler(true);
    setASincronizar(false);
    toast("Sincronizado");
  }

  const idade = estado?.credencialAtualizadaEm ? relativo(estado.credencialAtualizadaEm) : null;
  const meses = estado?.credencialAtualizadaEm ? Math.floor((Date.now() - new Date(estado.credencialAtualizadaEm).getTime()) / (30 * 86400000)) : null;
  const tipoNome = FONTES.find((f) => f[0] === (estado?.fonteTipo ?? "airtable")?.toLowerCase())?.[1] ?? estado?.fonteTipo ?? "Airtable";

  return (
    <div className="sblock">
      <h2>Ligação de dados</h2>
      <p className="sdesc">O quadro lê a vossa base de dados em tempo real. Nada é copiado nem guardado do nosso lado.</p>
      <div className="lrow">
        <span className="lrow-b">
          <span className="lrow-t">Fonte de dados</span>
          <span className="lrow-s">{estado ? (estado.configurada ? `${tipoNome} · ${estado.fonteBase ?? ""} · última leitura ${estado.ultimaLeitura ? relativo(estado.ultimaLeitura) : "por fazer"}` : "Por configurar") : "A ler..."}</span>
        </span>
        <span className={"pill" + (estado?.configurada && estado.ok ? " fill" : estado?.configurada && estado.erro ? " red" : "")}>
          {!estado ? "…" : !estado.configurada ? "por configurar" : estado.ok ? "ativa" : "com falha"}
        </span>
      </div>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Ações de formação</span><span className="lrow-s">{estado?.contagens ? `Leitura · ${estado.contagens.acoes} registos` : "Leitura"}</span></span>
        <span className="pill">{estado?.contagens ? "ok" : "—"}</span>
      </div>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Registos de execução</span><span className="lrow-s">{estado?.contagens ? `Leitura · ${estado.contagens.registos} registos` : "Leitura"}</span></span>
        <span className="pill">{estado?.contagens ? "ok" : "—"}</span>
      </div>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Formandos</span><span className="lrow-s">Sem acesso, por configuração da credencial</span></span>
        <span className="pill">bloqueada</span>
      </div>
      {estado?.erro ? (
        <div className="note" style={{ marginTop: 14 }}><span className="note-t">Falha na leitura</span><span className="note-s">{estado.erro}</span></div>
      ) : null}

      <h2 style={{ marginTop: 34 }}>Permissões da credencial</h2>
      <p className="sdesc">Verificadas na última leitura. Se alguma linha mudar, a ligação está mal configurada e deve ser corrigida.</p>
      <div className="lrow"><span className="lrow-b"><span className="lrow-t">Escrita</span><span className="lrow-s">O Fluxo nunca escreve na vossa base de dados. O adaptador não tem método de escrita.</span></span><span className="pill">sem permissão</span></div>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Acesso a formandos</span><span className="lrow-s">Não é pedido. {estado?.aviso ? "Na última verificação a credencial conseguia ler a tabela de formandos." : "Testado a cada verificação."}</span></span>
        <span className={"pill" + (estado?.aviso ? " red" : "")}>{estado?.aviso ? "acessível" : "não pedida"}</span>
      </div>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Idade da credencial</span><span className="lrow-s">{idade ? `Atualizada ${idade}. Recomendamos renovar ao fim de 12 meses.` : "Sem credencial."}</span></span>
        <span className={"pill" + (meses !== null && meses >= 12 ? " red" : "")}>{meses === null ? "—" : meses >= 12 ? "renovar" : "ok"}</span>
      </div>
      <div className="row2" style={{ marginTop: 20 }}>
        <button type="button" className="btn sec sm" disabled={aSincronizar} onClick={() => void sincronizar()}>Sincronizar agora</button>
      </div>
      <p className="fld-h">A sincronização corre automaticamente a cada 15 minutos.</p>

      {admin ? (
        <>
          <h2 style={{ marginTop: 34 }}>Credencial do Fluxo</h2>
          <p className="sdesc">Token só de leitura, restrito às tabelas de ações e de registos. É cifrado nos nossos servidores e nunca volta a ser mostrado. É diferente do token dos flows, que fica em Credenciais e só neste navegador.</p>
          <div className="fld"><label className="fld-l" htmlFor="lig-base">Identificador da base</label><input id="lig-base" value={base} onChange={(e) => setBase(e.target.value)} placeholder="appXXXXXXXXXXXXXX" /></div>
          <div className="fld"><label className="fld-l" htmlFor="lig-token">Token só de leitura</label><input id="lig-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={estado?.configurada ? "•••••••• (guardado; escreve para substituir)" : "pat…"} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label className="fld-l" htmlFor="lig-ta">Tabela de ações</label><input id="lig-ta" value={tblAcoes} onChange={(e) => setTblAcoes(e.target.value)} placeholder="Ações de formação" /></div>
            <div className="fld" style={{ flex: 1 }}><label className="fld-l" htmlFor="lig-tl">Tabela de registos</label><input id="lig-tl" value={tblLogs} onChange={(e) => setTblLogs(e.target.value)} placeholder="Logs de execução" /></div>
          </div>
          <div className="fld"><label className="fld-l" htmlFor="lig-tf">Tabela de formandos (só para verificar que não está acessível)</label><input id="lig-tf" value={tblForm} onChange={(e) => setTblForm(e.target.value)} placeholder="Formandos" /><p className="fld-h">Nunca é lida. Serve para confirmar que a credencial não lhe chega.</p></div>
          <button type="button" className="btn sm" disabled={aGuardar || !base.trim()} onClick={() => void guardar()}>Guardar ligação</button>
        </>
      ) : null}

      <h2 style={{ marginTop: 34 }}>Mudar de fonte</h2>
      <p className="sdesc">O Fluxo lê a vossa base de dados através de um adaptador. Podem mudar de sistema sem perder vistas, prazos nem configuração.</p>
      {FONTES.map(([k, nome, desc]) => {
        const emUso = (estado?.fonteTipo ?? "airtable").toLowerCase() === k;
        return (
          <div className="lrow" key={k}>
            <span className="lrow-b"><span className="lrow-t">{nome}</span><span className="lrow-s">{emUso ? "Em uso" : desc}</span></span>
            <span className={"pill" + (emUso ? " fill" : "")}>{emUso ? "ativa" : k === "outro" ? "sob pedido" : k === "airtable" ? "disponível" : "em breve"}</span>
          </div>
        );
      })}
      <p className="fld-h">Mudar de fonte implica remapear os campos. Fazemos isso convosco.</p>
    </div>
  );
}
