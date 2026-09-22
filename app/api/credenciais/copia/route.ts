import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";
import { desencriptar } from "../../../../lib/cifra";
import { log } from "../../../../lib/log";

const ROLES_PERMITIDOS = new Set<string>(["staff", "admin", "gestor"]);
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 10;
const rlHits = new Map<string, { count: number; resetAt: number }>();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request) {
  try {
    const supabase = await createClientServer();

    let user: { id: string } | null = null;
    try {
      const res = await supabase.auth.getUser();
      user = (res.data as any)?.user ?? null;
    } catch {
      user = null;
    }
    if (!user || !user.id) {
      return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
    }

    const agora = Date.now();
    const prev = rlHits.get(user.id);
    const state =
      prev && prev.resetAt > agora
        ? prev
        : { count: 0, resetAt: agora + RL_WINDOW_MS };
    state.count += 1;
    rlHits.set(user.id, state);
    if (state.count > RL_LIMIT) {
      return NextResponse.json(
        { erro: "Muitos pedidos. Tenta novamente dentro de 1 minuto." },
        { status: 429 },
      );
    }

    let me: { funcao: string; entidade_id: string } | null = null;
    try {
      const res = await supabase
        .from("utilizadores")
        .select("funcao, entidade_id")
        .eq("id", user.id)
        .single();
      me = res.data as { funcao: string; entidade_id: string } | null;
    } catch {
      me = null;
    }
    if (!me) {
      return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });
    }
    if (!ROLES_PERMITIDOS.has(me.funcao)) {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    }

    let cfg: { fonte_credencial?: unknown } | null = null;
    try {
      const res = await supabase
        .from("config_entidade")
        .select("fonte_credencial")
        .eq("entidade_id", me.entidade_id)
        .maybeSingle();
      cfg = (res.data as any) ?? null;
    } catch (e) {
      log.error("credenciais copia erro config_entidade", {
        err: (e as Error).message,
        user_id: user.id,
      });
      return NextResponse.json(
        { erro: "Erro ao ler configuração" },
        { status: 500 },
      );
    }

    const crmCifrado = (
      (cfg?.fonte_credencial as Record<string, unknown>) ?? {}
    ).crm_token as string | undefined;
    if (!crmCifrado) {
      return NextResponse.json({ crm_token: null }, { status: 200 });
    }
    try {
      const token = await desencriptar(crmCifrado);
      log.info("credenciais copia entregue", {
        user_id: user.id,
        entidade_id: me.entidade_id,
      });
      return NextResponse.json({ crm_token: token ?? null });
    } catch (e) {
      log.error("credenciais copia falha decifra", {
        err: (e as Error)?.message ?? String(e),
        user_id: user.id,
      });
      return NextResponse.json(
        { erro: "Não foi possível desencriptar o token." },
        { status: 500 },
      );
    }
  } catch (e) {
    log.error("credenciais copia erro inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
