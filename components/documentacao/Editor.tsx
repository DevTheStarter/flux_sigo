"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSessao, recebeAtualizacoes } from "../../lib/cliente/sessao";
import { nomeFicheiro, useDocumentos } from "../../lib/cliente/docs";
import { mdParaHtml } from "../../lib/docs/markdown";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

const MAX_MD = 512 * 1024;

/** Editor staff (§13.4): documento base novo ou existente, ou variação de uma entidade. */
export function Editor({ nomeDoc, entidadeId }: { nomeDoc: string | null; entidadeId: string | null }) {
  const s = useSessao();
  const staff = s.funcao === "staff";
  const router = useRouter();
  const toast = useToast();
  const { supabase, documentos, variacoes, entidades, carregado, recarregar } = useDocumentos(staff);

  const base = useMemo(() => (nomeDoc ? documentos.find((d) => d.nome === nomeDoc) ?? null : null), [documentos, nomeDoc]);
  const variacao = useMemo(() => (base && entidadeId ? variacoes.find((v) => v.documento_id === base.id && v.entidade_id === entidadeId) ?? null : null), [base, entidadeId, variacoes]);
  const entidade = entidadeId ? entidades.find((e) => e.id === entidadeId) ?? null : null;

  const [nome, setNome] = useState("");
  const [versao, setVersao] = useState("v1.0");
  const [corpo, setCorpo] = useState("");
  const [nota, setNota] = useState("");
  const [pronto, setPronto] = useState(false);
  const [publicar, setPublicar] = useState(false);
  const [mudou, setMudou] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (!carregado || pronto) return;
    if (entidadeId) {
      if (variacao) { setNome(base?.nome ?? ""); setVersao(base?.versao ?? ""); setCorpo(variacao.corpo); setNota(variacao.nota ?? ""); setPronto(true); }
      return;
    }
    if (base) { setNome(base.nome); setVersao(base.versao); setCorpo(base.corpo); }
    setPronto(true);
  }, [carregado, base, variacao, entidadeId, pronto]);

  if (!staff) {
    return <section className="page"><p className="empty">Só a TheStarter edita a documentação.</p></section>;
  }

  function carregarMd(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    if (f.size > MAX_MD) { toast("Ficheiro demasiado grande (máx 512 KB)"); return; }
    const r = new FileReader();
    r.onload = () => {
      if (!nome.trim()) setNome(f.name.replace(/\.(md|markdown|txt)$/i, ""));
      setCorpo(mdParaHtml(String(r.result ?? "")));
      toast(`${f.name} carregado`);
    };
    r.onerror = () => toast("Não foi possível ler o ficheiro");
    r.readAsText(f, "UTF-8");
  }

  async function guardarVariacao() {
    if (!base || !entidadeId) return;
    setAGuardar(true);
    const r = await (supabase as any)
      .from("documentos_variacao")
      .upsert({ documento_id: base.id, entidade_id: entidadeId, corpo, nota: nota.trim(), versao_base: variacao?.versao_base ?? base.versao, atualizado_em: new Date().toISOString() }, { onConflict: "documento_id,entidade_id" });
    setAGuardar(false);
    if (r.error) { toast("Não foi possível guardar a variação"); return; }
    toast("Variação guardada");
    router.push(`/documentacao?entidade=${entidadeId}`);
  }

  async function guardarBase(publicado: boolean, oQueMudou?: string) {
    const n = nome.trim();
    if (!n) { toast("Falta o nome do ficheiro"); return; }
    setAGuardar(true);
    const row = { nome: n.replace(/\.md$/i, ""), versao: versao.trim() || "v1.0", corpo, publicado: publicado || (base?.publicado ?? false), atualizado_em: new Date().toISOString(), flow: base?.flow ?? flowDoNome(n) };
    const r = base
      ? await (supabase as any).from("documentos").update(row).eq("id", base.id)
      : await (supabase as any).from("documentos").insert(row);
    if (r.error) { setAGuardar(false); toast(r.error.code === "23505" ? "Já existe um documento com esse nome" : "Não foi possível guardar"); return; }

    if (publicado) {
      // notifica só quem usa a versão base e recebe atualizações (§13.1, §14)
      const recebem = destinatariosPublicacao();
      if (recebem.length) {
        const users = await supabase.from("utilizadores").select("id, entidade_id").in("entidade_id", recebem.map((e) => e.id));
        const linhas = ((users.data ?? []) as { id: string; entidade_id: string }[]).map((u) => ({
          entidade_id: u.entidade_id,
          destinatario_id: u.id,
          remetente_id: s.id,
          tipo: "publicacao",
          corpo: `Documentação atualizada: ${nomeFicheiro(row.nome)} ${row.versao}${oQueMudou ? ` — ${oQueMudou}` : ""}`,
        }));
        if (linhas.length) await (supabase as any).from("notificacoes").insert(linhas);
      }
    }
    setAGuardar(false);
    await recarregar();
    toast(publicado ? "Publicado e notificado" : "Rascunho guardado");
    router.push("/documentacao");
  }

  function destinatariosPublicacao() {
    const comVariacao = new Set(base ? variacoes.filter((v) => v.documento_id === base.id).map((v) => v.entidade_id) : []);
    return entidades.filter((e) => e.ativa && recebeAtualizacoes({ suporte: e.suporte, setupEm: e.setup_em }) && !comVariacao.has(e.id));
  }
  function excluidasPublicacao() {
    return entidades.filter((e) => e.ativa).length - destinatariosPublicacao().length;
  }

  if (!carregado || !pronto) {
    return <section className="page"><div className="ph"><div><h1>Documentação</h1></div></div><p className="sub">A ler...</p></section>;
  }

  if (entidadeId) {
    if (!base || !variacao || !entidade) {
      return <section className="page"><p className="empty">Variação não encontrada.</p></section>;
    }
    return (
      <section className="page">
        <div className="ph"><div><h1>Documentação</h1></div></div>
        <div className="reader larga">
          <Link href={`/documentacao?entidade=${entidadeId}`} className="rback">← {entidade.nome}</Link>
          <div className="rhead">
            <div>
              <div className="rname">{nomeFicheiro(base.nome)}</div>
              <div className="rmeta">
                Variação da {entidade.nome} · baseada na {variacao.versao_base}
                {variacao.versao_base !== base.versao ? <> · <span style={{ color: "var(--red)" }}>a base está na {base.versao}</span></> : null}
              </div>
            </div>
          </div>
          <div className="fld">
            <label className="fld-l" htmlFor="var-nota">O que difere da base</label>
            <input id="var-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ex: lançam notas numa escala de 0 a 5" />
            <p className="fld-h">Uma linha. Aparece na lista e serve para lembrar porque é que esta entidade tem uma versão própria.</p>
          </div>
          <textarea className="ed" value={corpo} onChange={(e) => setCorpo(e.target.value)} aria-label="Conteúdo" />
          <div className="row2" style={{ marginTop: 14 }}>
            <button type="button" className="btn" style={{ width: "auto", padding: "11px 18px" }} disabled={aGuardar} onClick={() => void guardarVariacao()}>Guardar variação</button>
          </div>
          <p className="fld-h">Só a {entidade.nome} vê esta versão. As atualizações da base deixam de lhe chegar para este ficheiro.</p>
        </div>
      </section>
    );
  }

  const n = destinatariosPublicacao().length;
  const fora = excluidasPublicacao();

  return (
    <section className="page">
      <div className="ph"><div><h1>Documentação</h1></div></div>
      <div className="reader larga">
        <Link href="/documentacao" className="rback">← Todos os documentos</Link>
        <div className="toolbar">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="flow-6-novo" style={{ maxWidth: 290 }} aria-label="Nome do ficheiro" />
          <input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="v1.0" style={{ maxWidth: 88 }} aria-label="Versão" />
          <label className="btn sec sm" style={{ cursor: "pointer" }}>
            Carregar .md
            <input type="file" accept=".md,.markdown,text/markdown,text/plain" style={{ display: "none" }} onChange={carregarMd} />
          </label>
        </div>
        <p className="fld-h" style={{ margin: "0 0 10px" }}>Carregar um ficheiro preenche o nome e o conteúdo. O markdown é convertido para o HTML que o leitor mostra. Usa marcadores como {"{{SIGO_URL}}"}; nunca valores reais.</p>
        <textarea className="ed" value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="HTML simples: h3, p, ul, li, b, code, table" aria-label="Conteúdo" />
        <div className="row2" style={{ marginTop: 14 }}>
          <button type="button" className="btn sec" style={{ width: "auto", padding: "11px 18px" }} disabled={aGuardar} onClick={() => void guardarBase(false)}>Guardar rascunho</button>
          <button type="button" className="btn" style={{ width: "auto", padding: "11px 18px" }} disabled={aGuardar} onClick={() => { if (!nome.trim()) { toast("Falta o nome do ficheiro"); return; } setPublicar(true); }}>Publicar a todas</button>
        </div>
        <p className="fld-h">Guardar rascunho não envia nada. Só a TheStarter vê. Publicar substitui a versão que as entidades leem.</p>
      </div>

      <Modal open={publicar} onClose={() => setPublicar(false)} title={`Publicar ${nomeFicheiro(nome.trim())}`}>
        <div className="m-sec">
          <p className="confirm">Substitui a versão que <b>{n} entidade{n === 1 ? "" : "s"}</b> leem neste momento e notifica os utilizadores delas.</p>
          {fora ? <p className="confirm muted">{fora} entidade{fora === 1 ? "" : "s"} fica{fora === 1 ? "" : "m"} de fora: sem plano de suporte ou com variação própria deste ficheiro. Continua{fora === 1 ? "" : "m"} com a versão que tinha{fora === 1 ? "" : "m"}.</p> : null}
          <div className="fld" style={{ marginTop: 16 }}>
            <label className="fld-l" htmlFor="pub-nota">O que mudou</label>
            <input id="pub-nota" value={mudou} onChange={(e) => setMudou(e.target.value)} placeholder="ex: o campo Regime mudou de sítio no SIGO" />
          </div>
          <p className="fld-h">Aparece na notificação. Diz porque vale a pena reler, não só que mudou.</p>
        </div>
        <div className="m-f">
          <button type="button" className="btn" disabled={aGuardar} onClick={() => { setPublicar(false); void guardarBase(true, mudou.trim()); }}>Publicar a {n} entidade{n === 1 ? "" : "s"}</button>
          <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={() => setPublicar(false)}>Cancelar</button>
        </div>
      </Modal>
    </section>
  );
}

function flowDoNome(nome: string): number | null {
  const m = /^flow-(\d)/i.exec(nome);
  return m ? Number(m[1]) : null;
}
