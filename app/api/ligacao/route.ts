import { NextResponse } from "next/server";
import { createClientServer } from "../../../lib/supabase/server";
import { criarAirtable, invalidarCache, ultimaLeituraDe } from "../../../lib/dados/airtable";
import { COLUNAS_CONFIG_FONTE, configFonte, tokenDaCredencial, type ConfigFonteRow } from "../../../lib/dados/credencial";
import { encriptar } from "../../../lib/cifra";
import { log } from "../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Estado da ligação de dados (Definições → Ligação de dados, e o topo da app). */
export interface EstadoLigacaoResposta {
  configurada: boolean;
  fonteTipo: string | null;
  fonteBase: string | null;
  ok: boolean;
  erro: string | null;
  aviso: string | null;
  ultimaLeitura: string | null;
  contagens: { acoes: number; registos: number } | null;
  credencialAtualizadaEm: string | null;
}

async function contexto() {
  const supabase = await createClientServer();
  const authRes = await supabase.auth.getUser().catch(() => null);
  const user = authRes?.data?.user ?? null;
  if (!user) return { erro: NextResponse.json({ erro: "Sem sessão" }, { status: 401 }) };
  const meRes = await supabase.from("utilizadores").select("funcao, entidade_id").eq("id", user.id).single();
  const me = meRes.data as { funcao: string; entidade_id: string } | null;
  if (!me) return { erro: NextResponse.json({ erro: "Sem perfil" }, { status: 403 }) };
  return { supabase, user, me };
}

/** GET: estado da ligação. `?verificar=1` força uma leitura de teste na fonte. */
export async function GET(req: Request) {
  const ctx = await contexto();
  if ("erro" in ctx) return ctx.erro;
  const { supabase, me } = ctx;
  const verificar = new URL(req.url).searchParams.get("verificar") === "1";

  const cfgRes = await supabase
    .from("config_entidade")
    .select(COLUNAS_CONFIG_FONTE)
    .eq("entidade_id", me.entidade_id)
    .maybeSingle();
  const cfg = (cfgRes.data as unknown as ConfigFonteRow | null) ?? null;
  const fonteCfg = cfg ? configFonte(cfg) : null;

  const base: EstadoLigacaoResposta = {
    configurada: false,
    fonteTipo: cfg?.fonte_tipo ?? null,
    fonteBase: cfg?.fonte_base ?? null,
    ok: false,
    erro: null,
    aviso: null,
    ultimaLeitura: null,
    contagens: null,
    credencialAtualizadaEm: cfg?.atualizado_em ?? null,
  };
  if (!cfg || !fonteCfg) return NextResponse.json(base);

  let token: string | null = null;
  try {
    token = await tokenDaCredencial(cfg.fonte_credencial);
  } catch {
    return NextResponse.json({ ...base, erro: "Credencial ilegível. Volta a introduzir o token." });
  }
  if (!token) return NextResponse.json(base);

  const fonte = criarAirtable({ ...fonteCfg, token });
  const resposta: EstadoLigacaoResposta = { ...base, configurada: true };
  try {
    if (verificar) {
      const v = await fonte.verificarLigacao();
      resposta.ok = v.ok;
      resposta.erro = v.erro;
      resposta.aviso = v.aviso ?? null;
      if (!v.ok) return NextResponse.json(resposta);
    }
    const acoes = await fonte.obterAcoes();
    const registos = await fonte.obterRegistos();
    resposta.ok = true;
    resposta.contagens = { acoes: acoes.length, registos: registos.length };
    resposta.ultimaLeitura = ultimaLeituraDe(fonteCfg.baseId) ?? new Date().toISOString();
  } catch (e) {
    resposta.ok = false;
    resposta.erro = (e as Error).message;
    log.warn("ligacao leitura falhou", { entidade_id: me.entidade_id, err: (e as Error).message });
  }
  return NextResponse.json(resposta);
}

/**
 * POST: guarda a configuração da fonte. O token (só leitura) é cifrado no servidor
 * e nunca volta ao cliente. Só admin ou staff.
 * body: { fonteTipo?, fonteBase?, tabelaAcoes?, tabelaRegistos?, tabelaFormandos?, token? }
 */
export async function POST(req: Request) {
  const ctx = await contexto();
  if ("erro" in ctx) return ctx.erro;
  const { supabase, me, user } = ctx;
  if (me.funcao !== "admin" && me.funcao !== "staff") {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido" }, { status: 400 });
  }
  const texto = (k: string) => {
    const v = body[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const row: Record<string, unknown> = {};
  if ("fonteTipo" in body) row.fonte_tipo = texto("fonteTipo") ?? "airtable";
  if ("fonteBase" in body) row.fonte_base = texto("fonteBase");
  if ("tabelaAcoes" in body) row.fonte_tabela_acoes = texto("tabelaAcoes");
  if ("tabelaRegistos" in body) row.fonte_tabela_registos = texto("tabelaRegistos");
  if ("tabelaFormandos" in body) row.fonte_tabela_formandos = texto("tabelaFormandos");
  const token = texto("token");
  if (token) {
    try {
      row.fonte_credencial = await encriptar(token);
    } catch (e) {
      log.error("ligacao cifra falhou", { err: (e as Error).message });
      return NextResponse.json({ erro: "Não foi possível guardar a credencial." }, { status: 500 });
    }
  }
  row.atualizado_em = new Date().toISOString();

  const r = await (supabase as any)
    .from("config_entidade")
    .upsert({ entidade_id: me.entidade_id, ...row }, { onConflict: "entidade_id" });
  if (r.error) {
    log.error("ligacao guardar falhou", { err: r.error.message, user_id: user.id });
    return NextResponse.json({ erro: "Não foi possível guardar." }, { status: 500 });
  }
  const cfgRes = await supabase.from("config_entidade").select("fonte_base").eq("entidade_id", me.entidade_id).maybeSingle();
  const base = (cfgRes.data as { fonte_base?: string | null } | null)?.fonte_base;
  if (base) invalidarCache(base);
  return NextResponse.json({ ok: true });
}
