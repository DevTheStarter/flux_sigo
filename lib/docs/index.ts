import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { mdParaHtml } from "./markdown";
import {
  substituirVariaveis,
  type SubstituicaoOpts,
  CHAVES_VARIAVEIS_CANONICAS,
} from "./variaveis";
import { decifrarCredencial } from "../cifra";

export interface DocLookup {
  base(nome: string): Promise<{ corpo_md: string | null } | null>;
  variacao(
    nome: string,
    entidadeId: string
  ): Promise<{ corpo_md: string | null } | null>;
}

export interface DocRenderResult {
  html: string;
  /** true se usou variacao entidade, false se usou base */
  variou: boolean;
  nome: string;
}

/**
 * §13.1 Resolver documento:
 *   1. tentar variacao por (nome, entidade_id) em documentos_variacao
 *   2. fallback para base (documentos global)
 * Depois: substitui {{VAR}} + MD → HTML subset.
 */
export async function renderizarDocumento(
  nome: string,
  entidadeId: string,
  vars: Record<string, string | null | undefined>,
  lookup: DocLookup,
  opts: SubstituicaoOpts = {}
): Promise<DocRenderResult> {
  const variacao = await lookup.variacao(nome, entidadeId);
  let corpoMd = variacao?.corpo_md ?? null;
  let variou = corpoMd !== null;
  if (!corpoMd) {
    const base = await lookup.base(nome);
    corpoMd = base?.corpo_md ?? null;
  }
  if (!corpoMd) {
    return {
      html: `<p>Documento <code>${nome}</code> não encontrado.</p>`,
      variou,
      nome,
    };
  }
  const substituted = substituirVariaveis(corpoMd, vars, opts);
  const html = mdParaHtml(substituted);
  return { html, variou, nome };
}

/**
 * Implementação DocLookup real sobre Supabase (scoped por RLS quando client
 * do user autenticado; service role quando server-side).
 */
export class SupabaseDocLookup implements DocLookup {
  constructor(
    private readonly supabase: SupabaseClient<Database>
  ) {}

  async base(nome: string): Promise<{ corpo_md: string | null } | null> {
    try {
      const r = await this.supabase
        .from("documentos")
        .select("corpo")
        .eq("nome", nome)
        .eq("publicado", true)
        .order("atualizado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.error) return null;
      if (!r.data) return null;
      return { corpo_md: (r.data as any).corpo ?? null };
    } catch {
      return null;
    }
  }

  async variacao(
    nome: string,
    entidadeId: string
  ): Promise<{ corpo_md: string | null } | null> {
    try {
      const r = await this.supabase
        .from("documentos_variacao")
        .select("corpo, documento_id, documentos(nome)")
        .eq("entidade_id", entidadeId)
        .order("atualizado_em", { ascending: false })
        .maybeSingle();
      if (r.error) return null;
      if (!r.data) return null;
      const row = r.data as any;
      if (row?.documentos?.nome !== nome) return null;
      return { corpo_md: row.corpo ?? null };
    } catch {
      return null;
    }
  }
}

/**
 * Obter as variáveis canónicas para substituição em MD.
 * SIGO_PALAVRA fica sempre vazio (nunca vem do servidor — só localStorage
 * do browser quando renderizar por client).
 * CRM_TOKEN: omitido por padrão (chamada explicita à doc engine sem omitir
 * só existe no endpoint /api/credenciais/copia).
 */
export async function obterVariaveisEntidade(
  supabase: SupabaseClient<Database>,
  entidadeId: string
): Promise<Record<string, string | null | undefined>> {
  const out: Record<string, string | null | undefined> = {};
  for (const k of CHAVES_VARIAVEIS_CANONICAS) out[k] = null;

  const [entRes, cfgRes] = await Promise.allSettled([
    supabase
      .from("entidades")
      .select("id, nome, nipc")
      .eq("id", entidadeId)
      .maybeSingle(),
    supabase
      .from("config_entidade")
      .select(
        "fonte_base, fonte_credencial, fonte_tipo, sigo_url, sigo_utilizador, " +
          "variaveis, area_formacao_default, regime_default"
      )
      .eq("entidade_id", entidadeId)
      .maybeSingle(),
  ]);

  const entRow =
    entRes.status === "fulfilled" && entRes.value && !entRes.value.error
      ? (entRes.value.data as any)
      : null;
  const cfgRow =
    cfgRes.status === "fulfilled" && cfgRes.value && !cfgRes.value.error
      ? (cfgRes.value.data as any)
      : null;

  out.ENTIDADE_NOME = entRow?.nome ?? null;
  out.ENTIDADE_NIF = entRow?.nipc ?? null;
  out.SIGO_ENTIDADE_ID = entRow?.id ?? null;
  out.ENTIDADE_EMAIL = null;

  out.CRM_BASE_URL = cfgRow?.fonte_base ?? null;
  out.CRM_USUARIO = null;
  out.SIGO_URL = cfgRow?.sigo_url ?? null;
  out.SIGO_UTILIZADOR = cfgRow?.sigo_utilizador ?? null;
  out.ENTIDADE_MORADA = null;

  // Extra: ler de variaveis JSONB se definido (sobrescreve defaults acima
  // quando o Fluxo-Admin preencheu variáveis custom para a entidade).
  if (cfgRow?.variaveis && typeof cfgRow.variaveis === "object") {
    for (const k of CHAVES_VARIAVEIS_CANONICAS) {
      const v = cfgRow.variaveis[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        out[k] = String(v);
      }
    }
  }

  // CRM_ENTIDADE_ID a partir de CRM_USUARIO/CRM_BASE_URL quando disponível
  // (sem inventar valor — deixa null caso não esteja em variaveis).
  out.CRM_ENTIDADE_ID = out.CRM_ENTIDADE_ID ?? null;

  // CRM_TOKEN: desencriptar só se houver credencial. Os callers que usam
  // SubstituicaoOpts.omitirChaves default vão continuar a mascará-lo.
  if (cfgRow?.fonte_credencial) {
    try {
      const dec = await decifrarCredencial(cfgRow.fonte_credencial);
      if (dec?.token) out.CRM_TOKEN = dec.token;
      if (dec?.usuario && !out.CRM_USUARIO) out.CRM_USUARIO = dec.usuario;
    } catch {
      // segredo: não logar
    }
  }

  return out;
}

/** Lista canónica dos 7 documentos (ordem fixa da UI de documentação). */
export const DOCUMENTOS_MENU = [
  { slug: "ajuda-inicio", titulo: "ajuda · primeiro acesso", flow: null as number | null },
  { slug: "flow-0", titulo: "flow 0 · recolha de dados", flow: 0 },
  { slug: "flow-1", titulo: "flow 1 · perfis", flow: 1 },
  { slug: "flow-2", titulo: "flow 2 · curso", flow: 2 },
  { slug: "flow-3", titulo: "flow 3 · criação da ação", flow: 3 },
  { slug: "flow-4", titulo: "flow 4 · certificação", flow: 4 },
  { slug: "flow-5", titulo: "flow 5 · conclusão", flow: 5 },
] as const;

export * from "./variaveis";
export { mdParaHtml } from "./markdown";
