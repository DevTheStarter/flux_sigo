"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessao } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { useToast } from "../ui/Toast";
import type { EstadoLigacaoResposta } from "../../app/api/ligacao/route";
import { CAMPOS_MAPEAVEIS, FILTROS_PADRAO, type FiltrosSimples } from "../../lib/dados/mapa";

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
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [filtros, setFiltros] = useState<FiltrosSimples>({ formatoIgual: "", estadoDiferente: "" });
  const [aGuardar, setAGuardar] = useState(false);
  const [aGuardarCampos, setAGuardarCampos] = useState(false);
  const [aSincronizar, setASincronizar] = useState(false);

  const ler = useCallback(async (verificar = false) => {
    const r = await fetch(`/api/ligacao${verificar ? "?verificar=1" : ""}`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as EstadoLigacaoResposta;
      setEstado(j);
      setBase((b) => b || j.fonteBase || "");
      setTblAcoes((v) => v || j.tabelas?.acoes || "");
      setTblLogs((v) => v || j.tabelas?.registos || "");
      setTblForm((v) => v || j.tabelas?.formandos || "");
      setMapa(j.mapaCampos ?? {});
      setFiltros(j.filtros ?? { formatoIgual: "", estadoDiferente: "" });
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
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      toast(j.erro || `Não foi possível guardar a ligação (${r.status})`);
      return;
    }
    setToken("");
    const m = /app[A-Za-z0-9]{14}/.exec(base);
    if (m) setBase(m[0]);
    toast("Ligação guardada");
    await ler(true);
  }

  /** Campos e filtros: guardados à parte da credencial, sem tocar no token. */
  async function guardarCampos() {
    setAGuardarCampos(true);
    const r = await fetch("/api/ligacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapaCampos: mapa, filtros }),
    });
    setAGuardarCampos(false);
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      toast(j.erro || `Não foi possível guardar os campos (${r.status})`);
      return;
    }
    toast("Campos e filtros guardados");
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
          <div className="fld"><label className="fld-l" htmlFor="lig-base">Identificador da base</label><input id="lig-base" value={base} onChange={(e) => setBase(e.target.value)} placeholder="appXXXXXXXXXXXXXX" /><p className="fld-h">Só o id da base, que começa por app. Podes colar o URL do Airtable inteiro: fica só o id.</p></div>
          <div className="fld"><label className="fld-l" htmlFor="lig-token">Token só de leitura</label><input id="lig-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={estado?.configurada ? "•••••••• (guardado; escreve para substituir)" : "pat…"} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label className="fld-l" htmlFor="lig-ta">Tabela de ações</label><input id="lig-ta" value={tblAcoes} onChange={(e) => setTblAcoes(e.target.value)} placeholder="Ações de formação" /></div>
            <div className="fld" style={{ flex: 1 }}><label className="fld-l" htmlFor="lig-tl">Tabela de registos</label><input id="lig-tl" value={tblLogs} onChange={(e) => setTblLogs(e.target.value)} placeholder="Logs de execução" /><p className="fld-h">Nome exato da tabela no Airtable, por exemplo SIGO Logs.</p></div>
          </div>
          <div className="fld"><label className="fld-l" htmlFor="lig-tf">Tabela de formandos (só para verificar que não está acessível)</label><input id="lig-tf" value={tblForm} onChange={(e) => setTblForm(e.target.value)} placeholder="Formandos" /><p className="fld-h">Nunca é lida. Serve para confirmar que a credencial não lhe chega.</p></div>
          <button type="button" className="btn sm" disabled={aGuardar || !base.trim()} onClick={() => void guardar()}>Guardar ligação</button>
        </>
      ) : null}

      {admin ? (
        <>
          <h2 style={{ marginTop: 34 }}>Campos e filtros</h2>
          <p className="sdesc">Se as vossas colunas têm nomes diferentes dos da base de referência, indiquem aqui o nome de cada uma. Vazio usa o nome por defeito. Só estes campos são lidos.</p>
          <p className="fld-l">Tabela de ações de formação</p>
          {CAMPOS_MAPEAVEIS.filter((c) => c.tabela === "acoes").map((c) => (
            <div className="lrow" key={c.k}>
              <span className="lrow-b"><span className="lrow-t">{c.rotulo}</span>{c.nota ? <span className="lrow-s">{c.nota}</span> : null}</span>
              <input
                aria-label={`Nome do campo ${c.rotulo}`}
                value={mapa[c.k] ?? ""}
                onChange={(e) => setMapa({ ...mapa, [c.k]: e.target.value })}
                placeholder={c.padrao}
                style={{ maxWidth: 220 }}
              />
            </div>
          ))}
          <p className="fld-l" style={{ marginTop: 18 }}>Tabela de registos de execução</p>
          {CAMPOS_MAPEAVEIS.filter((c) => c.tabela === "registos").map((c) => (
            <div className="lrow" key={c.k}>
              <span className="lrow-b"><span className="lrow-t">{c.rotulo}</span>{c.nota ? <span className="lrow-s">{c.nota}</span> : null}</span>
              <input
                aria-label={`Nome do campo ${c.rotulo}`}
                value={mapa[c.k] ?? ""}
                onChange={(e) => setMapa({ ...mapa, [c.k]: e.target.value })}
                placeholder={c.padrao}
                style={{ maxWidth: 220 }}
              />
            </div>
          ))}
          <p className="fld-l" style={{ marginTop: 18 }}>Filtros</p>
          <p className="fld-h" style={{ marginTop: 0 }}>Que ações de formação entram no quadro. Vazio não filtra. Recomendado: Estado diferente de {FILTROS_PADRAO.estadoDiferente}.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="fld" style={{ flex: 1 }}><label className="fld-l" htmlFor="lig-f-formato">Formato igual a</label><input id="lig-f-formato" value={filtros.formatoIgual} onChange={(e) => setFiltros({ ...filtros, formatoIgual: e.target.value })} placeholder="sem filtro" /></div>
            <div className="fld" style={{ flex: 1 }}><label className="fld-l" htmlFor="lig-f-estado">Estado diferente de</label><input id="lig-f-estado" value={filtros.estadoDiferente} onChange={(e) => setFiltros({ ...filtros, estadoDiferente: e.target.value })} placeholder="sem filtro" /></div>
          </div>
          <button type="button" className="btn sm" disabled={aGuardarCampos} onClick={() => void guardarCampos()}>Guardar campos e filtros</button>
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
