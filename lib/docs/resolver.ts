/**
 * Resolução base + variação (spec §13.1). Função pura, usada no cliente e nos testes.
 */
export interface DocumentoBase {
  id: string;
  nome: string;
  versao: string;
  flow: number | null;
  corpo: string;
  publicado: boolean;
  atualizado_em: string;
}

export interface Variacao {
  id: string;
  documento_id: string;
  entidade_id: string;
  corpo: string;
  nota: string | null;
  versao_base: string;
  atualizado_em: string;
}

export interface DocumentoEfetivo extends DocumentoBase {
  origem: "base" | "variacao";
  nota: string | null;
  /** a base avançou desde que a variação foi copiada */
  desatualizada: boolean;
  versaoBase: string;
  variacaoId: string | null;
}

export function documentoEfetivo(
  nome: string,
  entidadeId: string | null,
  documentos: DocumentoBase[],
  variacoes: Variacao[]
): DocumentoEfetivo | null {
  const base = documentos.find((d) => d.nome === nome);
  if (!base) return null;
  const v = entidadeId ? variacoes.find((x) => x.documento_id === base.id && x.entidade_id === entidadeId) : undefined;
  if (!v) {
    return { ...base, origem: "base", nota: null, desatualizada: false, versaoBase: base.versao, variacaoId: null };
  }
  return {
    ...base,
    corpo: v.corpo,
    atualizado_em: v.atualizado_em,
    origem: "variacao",
    nota: v.nota,
    desatualizada: v.versao_base !== base.versao,
    versaoBase: v.versao_base,
    variacaoId: v.id,
  };
}
