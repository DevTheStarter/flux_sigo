/**
 * Substitui {{CHAVE}} por valores.
 * omitirChaves são as que NUNCA aparecem no render standard (SIGO_PALAVRA e
 * CRM_TOKEN em claro). O endpoint `/api/credenciais/copia` é o único que
 * fornece CRM_TOKEN desencriptado de propósito, chamando esta função com
 * omitirChaves=[].
 */
export interface SubstituicaoOpts {
  omitirChaves?: string[];
  /** substituto quando a chave está omitida ou ausente. Default `—` */
  placeholder?: string;
}

const RX = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

export function substituirVariaveis(
  texto: string,
  vars: Record<string, string | null | undefined>,
  opts: SubstituicaoOpts = {}
): string {
  const omitir = new Set(opts.omitirChaves ?? []);
  const placeholder = opts.placeholder ?? "—";
  return texto.replace(RX, (_match, chave: string) => {
    if (omitir.has(chave)) return placeholder;
    const v = vars[chave];
    if (v === null || v === undefined || v === "") return placeholder;
    return String(v);
  });
}

/** Chaves esperadas para validar no seed/UI (§8 variáveis + 2 tokens). */
export const CHAVES_VARIAVEIS_CANONICAS = [
  "ENTIDADE_NOME",
  "ENTIDADE_EMAIL",
  "ENTIDADE_NIF",
  "ENTIDADE_MORADA",
  "SIGO_ENTIDADE_ID",
  "CRM_BASE_URL",
  "CRM_ENTIDADE_ID",
  "CRM_TOKEN", // cifrado em BD, omitido por padrão
  "CRM_USUARIO",
  "SIGO_PALAVRA", // nunca enviado do servidor, omitido sempre (só localStorage)
] as const;

export type VariavelChave = (typeof CHAVES_VARIAVEIS_CANONICAS)[number];
