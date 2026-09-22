"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../supabase/client";
import { mdParaHtml } from "../docs/markdown";
import { htmlParaTexto, pareceHtml, sanitizarHtml } from "../docs/sanitizar";
import type { DocumentoBase, Variacao } from "../docs/resolver";
import { VARIAVEIS } from "./variaveis";

const RX = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

/** Corpo do documento pronto para o leitor (HTML limpo). */
export function corpoHtml(corpo: string): string {
  const html = pareceHtml(corpo) ? corpo : mdParaHtml(corpo);
  return sanitizarHtml(html);
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** Marca {{CHAVE}} como etiquetas. Com `verValores`, mostra os valores não secretos (§8.3). */
export function marcarVariaveis(html: string, valores: Record<string, string>, verValores: boolean): string {
  return html.replace(RX, (m, k: string) => {
    const def = VARIAVEIS.find((v) => v.k === k);
    if (!def) return `<span class="vtag falta">${k}</span>`;
    if (def.secreta) return `<span class="vtag seg" title="Só neste navegador. Nunca é mostrada.">${k}</span>`;
    if (verValores) {
      const v = valores[k];
      return v ? `<span class="vtag">${escapar(v)}</span>` : `<span class="vtag falta" title="Por preencher em Credenciais">${k}</span>`;
    }
    return `<span class="vtag">${k}</span>`;
  });
}

export function textoDocumento(corpo: string): string {
  return htmlParaTexto(corpoHtml(corpo));
}

export interface EntidadeResumo {
  id: string;
  nome: string;
  ativa: boolean;
  suporte: boolean;
  setup_em: string | null;
}

/** Carrega documentos base e variações visíveis pela sessão (RLS). Staff carrega também as entidades. */
export function useDocumentos(staff: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [documentos, setDocumentos] = useState<DocumentoBase[]>([]);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [entidades, setEntidades] = useState<EntidadeResumo[]>([]);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    const [d, v, e] = await Promise.all([
      supabase.from("documentos").select("id, nome, versao, flow, corpo, publicado, atualizado_em").order("flow", { ascending: true, nullsFirst: true }),
      supabase.from("documentos_variacao").select("id, documento_id, entidade_id, corpo, nota, versao_base, atualizado_em"),
      staff ? supabase.from("entidades").select("id, nome, ativa, suporte, setup_em").order("nome") : Promise.resolve({ data: [] as EntidadeResumo[] }),
    ]);
    const docs = ((d.data ?? []) as DocumentoBase[]).filter((x) => staff || x.publicado);
    docs.sort((a, b) => (a.flow ?? -1) - (b.flow ?? -1) || a.nome.localeCompare(b.nome));
    setDocumentos(docs);
    setVariacoes((v.data ?? []) as Variacao[]);
    setEntidades(((e as { data: EntidadeResumo[] | null }).data ?? []) as EntidadeResumo[]);
    setCarregado(true);
  }, [supabase, staff]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  return { supabase, documentos, variacoes, entidades, carregado, recarregar };
}

export function nomeFicheiro(nome: string): string {
  return /\.md$/i.test(nome) ? nome : `${nome}.md`;
}
