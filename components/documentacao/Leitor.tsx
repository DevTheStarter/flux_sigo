"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSessao } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { corpoHtml, marcarVariaveis, nomeFicheiro, textoDocumento, useDocumentos } from "../../lib/cliente/docs";
import { useVariaveisEntidade } from "../../lib/cliente/config";
import { substituir } from "../../lib/cliente/variaveis";
import { documentoEfetivo } from "../../lib/docs/resolver";
import { useToast } from "../ui/Toast";

/** Leitor (§13.2): etiquetas {{CHAVE}}, "Ver os meus valores", "Copiar conteúdo". */
export function Leitor({ nome, entidadeParam }: { nome: string; entidadeParam: string | null }) {
  const s = useSessao();
  const staff = s.funcao === "staff";
  const toast = useToast();
  const { documentos, variacoes, entidades, carregado } = useDocumentos(staff);
  const entidadeId = staff ? entidadeParam : s.entidadeId;
  const { valores } = useVariaveisEntidade(s.entidadeId);
  const [verValores, setVerValores] = useState(false);

  const doc = useMemo(() => documentoEfetivo(nome, entidadeId, documentos, variacoes), [nome, entidadeId, documentos, variacoes]);
  const html = useMemo(() => (doc ? marcarVariaveis(corpoHtml(doc.corpo), valores, verValores) : ""), [doc, valores, verValores]);
  const entidadeNome = staff && entidadeParam ? entidades.find((e) => e.id === entidadeParam)?.nome ?? "" : "";

  async function copiar() {
    if (!doc) return;
    // cópia de um documento completo: substitui também os segredos, só aqui e só no cliente (§4.9, §8.4)
    const { texto, faltam } = substituir(textoDocumento(doc.corpo), valores, true);
    try {
      await navigator.clipboard.writeText(texto);
      toast(faltam.length ? `${nomeFicheiro(nome)} copiado · ${faltam.length} ${faltam.length === 1 ? "valor" : "valores"} por preencher` : `${nomeFicheiro(nome)} copiado com os vossos valores`);
    } catch {
      toast("Não foi possível copiar");
    }
  }

  const voltar = staff && entidadeParam ? `/documentacao?entidade=${entidadeParam}` : "/documentacao";

  return (
    <section className="page">
      <div className="ph"><div><h1>Documentação</h1></div></div>
      <div className="reader">
        <Link href={voltar} className="rback">← Todos os documentos</Link>
        {!carregado ? (
          <p className="sub">A ler...</p>
        ) : !doc ? (
          <p className="empty">Documento não encontrado.</p>
        ) : (
          <>
            <div className="rhead">
              <div>
                <div className="rname">{nomeFicheiro(doc.nome)}</div>
                <div className="rmeta">
                  {doc.versao} · atualizado {relativo(doc.atualizado_em)}
                  {doc.origem === "variacao" ? (entidadeNome ? ` · variação da ${entidadeNome}` : " · adaptado à vossa entidade") : ""}
                  {!doc.publicado ? " · rascunho" : ""}
                </div>
              </div>
              <button type="button" className="btn sec sm" onClick={() => void copiar()}>Copiar conteúdo</button>
            </div>
            {doc.desatualizada ? (
              <div className="note" style={{ marginBottom: 18 }}>
                <span className="note-t">Variação desatualizada</span>
                <span className="note-s">A base deste ficheiro passou para a {documentos.find((b) => b.id === doc.id)?.versao}. Esta variação foi copiada da {doc.versaoBase} e não recebe as atualizações.</span>
              </div>
            ) : null}
            <div className="vbar2">
              <span className="vbar2-t">Este documento usa valores da vossa entidade. Ao copiar, são substituídos pelos vossos.</span>
              <button type="button" className="btn sec sm" onClick={() => setVerValores(!verValores)}>{verValores ? "Esconder valores" : "Ver os meus valores"}</button>
            </div>
            <div className="md" dangerouslySetInnerHTML={{ __html: html || "<p>Sem conteúdo disponível.</p>" }} />
          </>
        )}
      </div>
    </section>
  );
}
