"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSessao, recebeAtualizacoes } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { nomeFicheiro, textoDocumento, useDocumentos, type EntidadeResumo } from "../../lib/cliente/docs";
import { documentoEfetivo, type DocumentoBase } from "../../lib/docs/resolver";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

interface Resultado { nome: string; linha: number; excerto: string }

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lista de documentação (§13.2 entidade, §13.4 staff). */
export function Documentacao({ ambitoInicial }: { ambitoInicial?: string | null }) {
  const s = useSessao();
  const staff = s.funcao === "staff";
  const router = useRouter();
  const toast = useToast();
  const { supabase, documentos, variacoes, entidades, carregado, recarregar } = useDocumentos(staff);
  const [ambito, setAmbito] = useState<string>(ambitoInicial || "base");
  const [q, setQ] = useState("");
  const [confirmar, setConfirmar] = useState<{ tipo: "apagar"; doc: DocumentoBase } | { tipo: "voltar"; doc: DocumentoBase; entidade: EntidadeResumo } | null>(null);

  const entidadeAtual: string | null = staff ? (ambito === "base" ? null : ambito) : s.entidadeId;
  const entidadeObj = staff ? entidades.find((e) => e.id === ambito) ?? null : null;
  const ativas = entidades.filter((e) => e.ativa);

  const efetivos = useMemo(
    () => documentos.map((d) => documentoEfetivo(d.nome, entidadeAtual, documentos, variacoes)!).filter(Boolean),
    [documentos, variacoes, entidadeAtual]
  );

  const resultados = useMemo<Resultado[] | null>(() => {
    const termo = q.trim();
    if (termo.length < 2) return null;
    const out: Resultado[] = [];
    for (const d of efetivos) {
      const linhas = textoDocumento(d.corpo).split("\n");
      linhas.forEach((l, i) => {
        if (l.toLowerCase().includes(termo.toLowerCase())) out.push({ nome: d.nome, linha: i + 1, excerto: l.trim() });
      });
    }
    return out;
  }, [q, efetivos]);

  function destacar(texto: string) {
    const termo = q.trim();
    const partes = texto.split(new RegExp(`(${escapeRx(termo)})`, "gi"));
    return partes.map((p, i) => (p.toLowerCase() === termo.toLowerCase() ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
  }

  async function personalizar(doc: DocumentoBase, entidadeId: string) {
    const r = await (supabase as any)
      .from("documentos_variacao")
      .insert({ documento_id: doc.id, entidade_id: entidadeId, corpo: doc.corpo, nota: "", versao_base: doc.versao })
      .select("id")
      .single();
    if (r.error) { toast("Não foi possível criar a variação"); return; }
    toast("Cópia da base criada. Edita só o que difere.");
    router.push(`/documentacao/editar?doc=${encodeURIComponent(doc.nome)}&entidade=${entidadeId}`);
  }

  async function voltarBase(doc: DocumentoBase, entidade: EntidadeResumo) {
    const r = await (supabase as any).from("documentos_variacao").delete().eq("documento_id", doc.id).eq("entidade_id", entidade.id);
    if (r.error) { toast("Não foi possível apagar a variação"); return; }
    setConfirmar(null);
    await recarregar();
    toast("A usar a base");
  }

  async function apagarDoc(doc: DocumentoBase) {
    const r = await (supabase as any).from("documentos").delete().eq("id", doc.id);
    if (r.error) { toast("Não foi possível apagar o documento"); return; }
    setConfirmar(null);
    await recarregar();
    toast("Documento apagado");
  }

  const nFicheiros = documentos.length;
  const semAtualizacoes = !staff && !recebeAtualizacoes(s);

  return (
    <section className="page">
      <div className="ph"><div><h1>Documentação</h1></div></div>

      {semAtualizacoes ? (
        <div className="note neutro" style={{ maxWidth: 640, marginBottom: 18 }}>
          <span className="note-t2">Documentação sem atualizações</span>
          <span className="note-s">Sem plano de suporte mensal, esta documentação deixa de ser atualizada. Quando o SIGO muda, as instruções aqui podem deixar de corresponder ao que veem no ecrã. Falem connosco em people@thestarter.io.</span>
        </div>
      ) : null}

      <input className="search" placeholder="Pesquisar nos documentos..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar nos documentos" />
      <p className="res-n">
        {resultados
          ? resultados.length
            ? `${resultados.length} resultado${resultados.length > 1 ? "s" : ""} em ${new Set(resultados.map((r) => r.nome)).size} ficheiro${new Set(resultados.map((r) => r.nome)).size > 1 ? "s" : ""}`
            : "Sem resultados"
          : carregado ? `${nFicheiros} ficheiro${nFicheiros === 1 ? "" : "s"}` : "A ler..."}
      </p>

      {staff && !resultados ? (
        <div className="dscope">
          <button type="button" className={"dsc" + (ambito === "base" ? " on" : "")} onClick={() => setAmbito("base")}>
            Base<span className="dsc-n">{documentos.length}</span>
          </button>
          {ativas.map((e) => {
            const minhas = variacoes.filter((v) => v.entidade_id === e.id);
            const velha = minhas.some((v) => documentos.find((d) => d.id === v.documento_id)?.versao !== v.versao_base);
            return (
              <button key={e.id} type="button" className={"dsc" + (ambito === e.id ? " on" : "")} onClick={() => setAmbito(e.id)}>
                {e.nome}
                {minhas.length ? <span className={"dsc-n" + (velha ? " red" : "")}>{minhas.length}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {resultados ? (
        <div>
          {resultados.map((r, i) => (
            <Link key={i} href={`/documentacao/${encodeURIComponent(r.nome)}${staff && entidadeAtual ? `?entidade=${entidadeAtual}` : ""}`} className="res" style={{ textDecoration: "none" }}>
              <div className="res-h"><span className="res-f">{nomeFicheiro(r.nome)}</span><span className="res-l">linha {r.linha}</span></div>
              <div className="res-x">{destacar(r.excerto)}</div>
            </Link>
          ))}
        </div>
      ) : staff && entidadeAtual === null ? (
        <div>
          <p className="dsc-desc">Documentação base. Todas as entidades a herdam, exceto nos ficheiros que tiverem variação própria.</p>
          {documentos.map((d) => {
            const quem = variacoes.filter((v) => v.documento_id === d.id).length;
            return (
              <div className="drow" key={d.id}>
                <Link href={`/documentacao/${encodeURIComponent(d.nome)}`} className="dn">
                  {nomeFicheiro(d.nome)}
                  {!d.publicado ? <span className="pill" style={{ marginLeft: 6 }}>rascunho</span> : null}
                  {quem ? <span className="dvar">{quem} entidade{quem > 1 ? "s" : ""} com variação</span> : null}
                </Link>
                <span className="dm">{d.versao} · {relativo(d.atualizado_em)}</span>
                <Link href={`/documentacao/editar?doc=${encodeURIComponent(d.nome)}`} className="btn sec sm">Editar</Link>
                <button type="button" className="btn sec sm perigo" onClick={() => setConfirmar({ tipo: "apagar", doc: d })}>Apagar</button>
              </div>
            );
          })}
          <Link href="/documentacao/editar" className="btn sec sm" style={{ marginTop: 20 }}>Novo documento</Link>
        </div>
      ) : staff && entidadeObj ? (
        <div>
          <p className="dsc-desc">O que a <b>{entidadeObj.nome}</b> vê. Ficheiros sem variação usam a base e recebem as atualizações dela.</p>
          {efetivos.map((d) => {
            const varia = d.origem === "variacao";
            return (
              <div className={"drow" + (varia ? " dvrow" : "")} key={d.id}>
                <Link href={`/documentacao/${encodeURIComponent(d.nome)}?entidade=${entidadeObj.id}`} className="dn">
                  {nomeFicheiro(d.nome)}
                  {varia ? <span className="dvar on">variação</span> : <span className="dvar">base</span>}
                  {d.desatualizada ? <span className="dvar red">base mudou para {documentos.find((b) => b.id === d.id)?.versao}</span> : null}
                  {varia && d.nota ? <span className="dnota">{d.nota}</span> : null}
                </Link>
                <span className="dm">{varia ? `${d.versaoBase} · ${entidadeObj.nome}` : d.versao}</span>
                {varia ? (
                  <>
                    <Link href={`/documentacao/editar?doc=${encodeURIComponent(d.nome)}&entidade=${entidadeObj.id}`} className="btn sec sm">Editar</Link>
                    <button type="button" className="btn sec sm" onClick={() => setConfirmar({ tipo: "voltar", doc: d, entidade: entidadeObj })}>Voltar à base</button>
                  </>
                ) : (
                  <button type="button" className="btn sec sm" onClick={() => void personalizar(d, entidadeObj.id)}>Personalizar</button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {efetivos.map((d) => (
            <div className="drow" key={d.id}>
              <Link href={`/documentacao/${encodeURIComponent(d.nome)}`} className="dn">
                {nomeFicheiro(d.nome)}
                {d.origem === "variacao" ? <span className="dvar on">adaptado à vossa entidade</span> : null}
              </Link>
              <span className="dm">{d.versao} · {relativo(d.atualizado_em)}</span>
              <Link href={`/documentacao/${encodeURIComponent(d.nome)}`} className="dm link-doc">ler →</Link>
            </div>
          ))}
          {carregado && !efetivos.length ? <p className="empty">Ainda não há documentos publicados.</p> : null}
        </div>
      )}

      <Modal open={!!confirmar} onClose={() => setConfirmar(null)} title={confirmar?.tipo === "apagar" ? "Apagar documento" : "Voltar à base"}>
        {confirmar?.tipo === "apagar" ? (
          <>
            <div className="m-sec">
              <p className="confirm"><b>{nomeFicheiro(confirmar.doc.nome)}</b> deixa de estar disponível para todas as entidades, incluindo quem estiver a meio de um flow.</p>
              <p className="confirm muted">Não pode ser desfeito.</p>
            </div>
            <div className="m-f">
              <button type="button" className="btn" onClick={() => void apagarDoc(confirmar.doc)}>Apagar</button>
              <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setConfirmar(null)}>Cancelar</button>
            </div>
          </>
        ) : confirmar?.tipo === "voltar" ? (
          <>
            <div className="m-sec">
              <p className="confirm">A <b>{confirmar.entidade.nome}</b> passa a usar a versão base de <b>{nomeFicheiro(confirmar.doc.nome)}</b> e volta a receber as atualizações dela.</p>
              <p className="confirm muted">A variação é apagada e não pode ser recuperada.</p>
            </div>
            <div className="m-f">
              <button type="button" className="btn" onClick={() => void voltarBase(confirmar.doc, confirmar.entidade)}>Apagar variação</button>
              <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setConfirmar(null)}>Cancelar</button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}
