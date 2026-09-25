"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import type { CartaoQuadro, RespostaQuadro } from "../../app/api/quadro/route";
import { COLUNAS_FLOWS } from "../../lib/cliente/flows";
import { cumpre, cumpreFiltroRapido, lerCondicoes, textoCondicao, type FiltroRapido, type Vista } from "../../lib/cliente/vistas";
import { useToast } from "../ui/Toast";
import { Cartao } from "./Cartao";
import { DetalheCartao } from "./DetalheCartao";
import { VistaModal } from "./VistaModal";
import { Modal } from "../ui/Modal";

const LS_VISTA = "fluxo-vista";
/** atrasadas há mais de dois meses ficam escondidas por defeito (§4.4, mesma lógica das concluídas) */
const DIAS_ATRASO_ANTIGO = 61;
const CHAVE_CACHE = "fluxo-quadro";

function lerCache(entidadeId: string): RespostaQuadro | null {
  try {
    const raw = sessionStorage.getItem(`${CHAVE_CACHE}:${entidadeId}`);
    return raw ? (JSON.parse(raw) as RespostaQuadro) : null;
  } catch {
    return null;
  }
}

export function Quadro() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const [dados, setDados] = useState<RespostaQuadro | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [vistaId, setVistaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroRapido | null>(null);
  const [pesquisa, setPesquisa] = useState("");
  const [verFuturas, setVerFuturas] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  /** mostrar também as atrasadas há mais de dois meses */
  const [verAntigas, setVerAntigas] = useState(false);
  const [aberto, setAberto] = useState<CartaoQuadro | null>(null);
  const [editarVista, setEditarVista] = useState<{ vista: Vista | null } | null>(null);
  const [apagarVista, setApagarVista] = useState<Vista | null>(null);

  const carregarQuadro = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetch("/api/quadro", { cache: "no-store" });
      const json = (await r.json()) as RespostaQuadro & { erro?: string };
      if (!r.ok) throw new Error(json.erro || `Erro ${r.status}`);
      setDados(json);
      try { sessionStorage.setItem(`${CHAVE_CACHE}:${s.entidadeId}`, JSON.stringify(json)); } catch { /* ignorar */ }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setACarregar(false);
    }
  }, [s.entidadeId]);

  const carregarVistas = useCallback(async () => {
    const r = await supabase.from("vistas").select("id, nome, condicoes, fixa").eq("entidade_id", s.entidadeId).order("criada_em", { ascending: true });
    const lista: Vista[] = ((r.data ?? []) as { id: string; nome: string; condicoes: unknown; fixa: boolean }[]).map((v) => ({
      id: v.id,
      nome: v.nome,
      condicoes: lerCondicoes(v.condicoes),
      fixa: !!v.fixa,
    }));
    lista.sort((a, b) => Number(b.fixa) - Number(a.fixa));
    setVistas(lista);
    setVistaId((atual) => {
      if (atual && lista.some((v) => v.id === atual)) return atual;
      let guardada: string | null = null;
      try { guardada = localStorage.getItem(LS_VISTA); } catch { /* ignorar */ }
      if (guardada && lista.some((v) => v.id === guardada)) return guardada;
      return lista[0]?.id ?? null;
    });
  }, [supabase, s.entidadeId]);

  useEffect(() => {
    const cache = lerCache(s.entidadeId);
    if (cache) { setDados(cache); setACarregar(false); }
    void carregarQuadro();
    void carregarVistas();
  }, [carregarQuadro, carregarVistas, s.entidadeId]);

  useEffect(() => {
    if (vistaId) { try { localStorage.setItem(LS_VISTA, vistaId); } catch { /* ignorar */ } }
  }, [vistaId]);

  // se o cartão aberto foi atualizado por uma nova leitura, refletir
  useEffect(() => {
    if (!aberto || !dados) return;
    const novo = dados.cartoes.find((c) => c.id === aberto.id);
    if (novo && novo !== aberto) setAberto(novo);
  }, [dados, aberto]);

  const vista = vistas.find((v) => v.id === vistaId) ?? null;
  const cartoes = useMemo(() => dados?.cartoes ?? [], [dados]);

  const daVista = useMemo(() => cartoes.filter((c) => cumpre(c, vista?.condicoes ?? [])), [cartoes, vista]);
  // Atrasadas há mais de dois meses: fora do quadro e dos contadores até se pedir para as ver.
  const ehAntiga = (c: CartaoQuadro) => c.estado === "late" && (c.dias ?? 0) > DIAS_ATRASO_ANTIGO;
  const consideradas = useMemo(() => (verAntigas ? daVista : daVista.filter((c) => !ehAntiga(c))), [daVista, verAntigas]);
  const contadores = {
    atrasadas: consideradas.filter((c) => c.estado === "late" || c.estado === "error").length,
    hoje: consideradas.filter((c) => c.estado === "today").length,
    bloqueadas: consideradas.filter((c) => c.estado === "blocked").length,
  };
  const q = pesquisa.trim().toLowerCase();
  const visiveis = useMemo(
    () =>
      consideradas
        .filter((c) => cumpreFiltroRapido(c, filtro))
        .filter((c) => !q || c.acao.nome.toLowerCase().includes(q) || c.acao.codigoCurso.toLowerCase().includes(q)),
    [consideradas, filtro, q]
  );

  function colunas() {
    return COLUNAS_FLOWS.map((nome, i) => {
      let items = visiveis.filter((c) => c.col === i || (i === 5 && c.col === 6));
      let escondidas = 0;
      let futuras = 0;
      // Quantas atrasadas antigas há nesta coluna (na vista, antes de esconder), para a ligação no fundo.
      const antigas = daVista.filter((c) => ehAntiga(c) && (c.col === i || (i === 5 && c.col === 6))).length;
      if (i === 5 && !verTodas) {
        escondidas = items.filter((c) => c.estado === "done" && (c.concluidaHa ?? 0) > 7).length;
        items = items.filter((c) => !(c.estado === "done" && (c.concluidaHa ?? 0) > 7));
      }
      if (i === 0) {
        futuras = items.filter((c) => c.estado === "futura").length;
        if (!verFuturas) items = items.filter((c) => c.estado !== "futura");
      }
      // ativas primeiro (o que está travado ou é para hoje à cabeça), depois concluídas, depois futuras
      const ordem = (e: string) => (e === "futura" ? 2 : e === "done" ? 1 : 0);
      const urgencia = (c: CartaoQuadro) =>
        c.estado === "late" ? -1000 - (c.dias ?? 0) : c.estado === "error" || c.estado === "blocked" ? -500 : c.estado === "today" ? 0 : c.dias ?? 999;
      items = [...items].sort((a, b) => ordem(a.estado) - ordem(b.estado) || urgencia(a) - urgencia(b));
      return { nome, i, items, escondidas, futuras, antigas };
    });
  }

  async function guardarVista(nome: string, condicoes: Vista["condicoes"], id: string | null) {
    if (id) {
      const r = await (supabase as any).from("vistas").update({ nome, condicoes }).eq("id", id);
      if (r.error) { toast("Não foi possível guardar a vista"); return; }
      toast("Vista guardada");
    } else {
      const r = await (supabase as any).from("vistas").insert({ entidade_id: s.entidadeId, criada_por: s.id, nome, condicoes }).select("id").single();
      if (r.error) { toast(r.error.code === "23505" ? "Já existe uma vista com esse nome" : "Não foi possível criar a vista"); return; }
      setVistaId(r.data.id as string);
      toast("Vista criada");
    }
    setEditarVista(null);
    await carregarVistas();
  }

  async function apagarVistaAgora(v: Vista) {
    const r = await (supabase as any).from("vistas").delete().eq("id", v.id);
    if (r.error) { toast("Não foi possível apagar a vista"); return; }
    setApagarVista(null);
    if (vistaId === v.id) setVistaId(vistas.find((x) => x.fixa)?.id ?? vistas[0]?.id ?? null);
    await carregarVistas();
    toast("Vista apagada");
  }

  const nVis = visiveis.length;
  const semLigacao = !!dados?.semLigacao;

  return (
    <section className="page">
      <div className="ph">
        <div>
          <h1>Ações de formação</h1>
          <p className="sub">{q ? `${nVis} resultado${nVis === 1 ? "" : "s"} para "${pesquisa.trim()}"` : aCarregar ? "A ler dados..." : ""}</p>
        </div>
        <div className="stats">
          {([
            ["late", contadores.atrasadas, "atrasadas", contadores.atrasadas > 0],
            ["today", contadores.hoje, "hoje", false],
            ["blocked", contadores.bloqueadas, "bloqueadas", contadores.bloqueadas > 0],
          ] as [FiltroRapido, number, string, boolean][]).map(([k, n, rotulo, vermelho]) => (
            <button key={k} type="button" className={"stat" + (filtro === k ? " act" : "")} onClick={() => setFiltro(filtro === k ? null : k)}>
              <div className={"stat-n" + (vermelho ? " red" : "")}>{aCarregar && !dados ? "—" : n}</div>
              <div className="stat-l">{rotulo}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="vbar">
        {vistas.map((v) => (
          <button key={v.id} type="button" className={"vtab" + (vistaId === v.id ? " on" : "")} onClick={() => { setVistaId(v.id); setFiltro(null); }}>
            {v.nome}
            {!v.fixa && vistaId === v.id ? (
              <span className="x" role="button" aria-label="Apagar vista" onClick={(e) => { e.stopPropagation(); setApagarVista(v); }}>×</span>
            ) : null}
          </button>
        ))}
        <button type="button" className="vadd" onClick={() => setEditarVista({ vista: null })}>+ Nova vista</button>
      </div>

      <div className="srow">
        <input className="bsearch" placeholder="Pesquisar ação por nome ou código..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} aria-label="Pesquisar ação" />
        {pesquisa ? <button type="button" className="sclear" onClick={() => setPesquisa("")}>limpar</button> : null}
      </div>

      <div className="vinfo">
        {vista && vista.condicoes.length ? (
          <>
            <span>Condições:</span>
            {vista.condicoes.map((c, i) => <span key={i} className="cond">{textoCondicao(c)}</span>)}
            {!vista.fixa ? <button type="button" className="link" onClick={() => setEditarVista({ vista })}>editar</button> : null}
          </>
        ) : !filtro ? (
          <span>Sem condições. Mostra todas as ações.</span>
        ) : null}
        {filtro ? (
          <>
            <span className="cond">Estado: {filtro === "late" ? "atrasadas" : filtro === "today" ? "hoje" : "bloqueadas"}</span>
            <button type="button" className="link" onClick={() => setFiltro(null)}>limpar</button>
          </>
        ) : null}
      </div>

      {aCarregar && !dados ? (
        <div className="board" aria-busy="true">
          {COLUNAS_FLOWS.map((nome, i) => (
            <div className="col" key={nome}>
              <div className="col-h"><span className="col-t">{nome}</span></div>
              {Array.from({ length: [2, 1, 2, 1, 2, 1][i] }).map((_, k) => (
                <div className="sk-card" key={k}>
                  <div className="sk" style={{ height: 11, width: "82%", marginBottom: 8 }} />
                  <div className="sk" style={{ height: 9, width: "56%", marginBottom: 11 }} />
                  <div className="sk" style={{ height: 14, width: 42, borderRadius: 3, marginBottom: 9 }} />
                  <div className="sk" style={{ height: 9, width: "48%" }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="board">
          {colunas().map(({ nome, i, items, escondidas, futuras, antigas }) => (
            <div className="col" key={nome}>
              <div className="col-h"><span className="col-t">{nome}</span><span className="col-n">{items.length}</span></div>
              {items.length === 0 ? <div className="empty">{q ? "Sem resultados" : "Vazio"}</div> : null}
              {items.map((c) => <Cartao key={c.id} c={c} onClick={() => setAberto(c)} />)}
              {antigas > 0 ? (
                <button type="button" className="more" onClick={() => setVerAntigas(!verAntigas)}>
                  {verAntigas ? `Esconder as ${antigas} atrasadas há mais de dois meses` : `Ver ${antigas} atrasada${antigas > 1 ? "s" : ""} há mais de dois meses`}
                </button>
              ) : null}
              {i === 0 && futuras > 0 ? (
                <button type="button" className="more" onClick={() => setVerFuturas(!verFuturas)}>
                  {verFuturas ? `Esconder as ${futuras} futuras` : `Ver ${futuras} futura${futuras > 1 ? "s" : ""}`}
                </button>
              ) : null}
              {i === 5 && escondidas > 0 ? (
                <button type="button" className="more" onClick={() => setVerTodas(true)}>Ver {escondidas} concluída{escondidas > 1 ? "s" : ""} há mais de uma semana</button>
              ) : i === 5 && verTodas ? (
                <button type="button" className="more" onClick={() => setVerTodas(false)}>Mostrar só as da última semana</button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {erro ? (
        <div className="aviso-quadro">
          <span style={{ color: "var(--red)" }}>Não foi possível ler o quadro: {erro}.</span>{" "}
          <button type="button" className="link" onClick={() => { setACarregar(true); void carregarQuadro(); }}>Tentar novamente</button>
        </div>
      ) : semLigacao && !aCarregar ? (
        <div className="aviso-quadro">
          Ainda não existe ligação à vossa base de dados. Configura-a em <b>Definições → Ligação de dados</b> para o quadro aparecer.
        </div>
      ) : null}

      {aberto ? <DetalheCartao c={aberto} onClose={() => setAberto(null)} /> : null}
      {editarVista ? (
        <VistaModal vista={editarVista.vista} cartoes={cartoes} onClose={() => setEditarVista(null)} onGuardar={guardarVista} />
      ) : null}
      <Modal open={!!apagarVista} onClose={() => setApagarVista(null)} title="Apagar vista">
        {apagarVista ? (
          <>
            <div className="m-sec">
              <p className="confirm">
                A vista <b>{apagarVista.nome}</b> e as suas {apagarVista.condicoes.length} condiç{apagarVista.condicoes.length === 1 ? "ão" : "ões"} serão removidas. Nenhuma ação de formação é afetada.
              </p>
              <p className="confirm muted">Esta operação não pode ser desfeita.</p>
            </div>
            <div className="m-f">
              <button type="button" className="btn" onClick={() => void apagarVistaAgora(apagarVista)}>Apagar vista</button>
              <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setApagarVista(null)}>Cancelar</button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}
