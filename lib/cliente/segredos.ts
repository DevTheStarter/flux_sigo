/**
 * Segredos que só existem neste navegador (spec §8.4): SIGO_PALAVRA e CRM_TOKEN.
 * Uma chave de localStorage, JSON, com try/catch. Nunca entram em pedidos.
 */

export const CHAVE_LOCAL = "fluxo-local";
export const SEGREDOS_LOCAIS = ["SIGO_PALAVRA", "CRM_TOKEN"] as const;
export type SegredoLocal = (typeof SEGREDOS_LOCAIS)[number];

export function lerSegredos(): Partial<Record<SegredoLocal, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHAVE_LOCAL);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const out: Partial<Record<SegredoLocal, string>> = {};
    for (const k of SEGREDOS_LOCAIS) {
      if (obj && typeof obj[k] === "string" && obj[k]) out[k] = obj[k];
    }
    return out;
  } catch {
    return {};
  }
}

export function guardarSegredo(k: SegredoLocal, valor: string) {
  if (typeof window === "undefined") return;
  try {
    const atual = lerSegredos() as Record<string, string>;
    if (valor) atual[k] = valor;
    else delete atual[k];
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(atual));
  } catch {
    /* armazenamento indisponível: o valor fica só em memória */
  }
}

export function apagarSegredos() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE_LOCAL);
  } catch {
    /* ignorar */
  }
}

export function ehSegredo(chave: string): chave is SegredoLocal {
  return (SEGREDOS_LOCAIS as readonly string[]).includes(chave);
}
