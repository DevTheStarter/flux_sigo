import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClientServer } from "../../../../lib/supabase/server";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Troca código PKCE (magic links, convites, OAuth) por sessão em cookies.
 * ?next= opcional para onde ir depois.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next =
    searchParams.get("next") && /^\/[A-Za-z0-9\/_-]*$/.test(searchParams.get("next")!)
      ? searchParams.get("next")!
      : "/quadro";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=1`);
  }

  const cookieStore = cookies();
  const supabase = await createClientServer();

  try {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      log.warn("auth callback falhou", { motivo: error?.message ?? "sem sessao" });
      return NextResponse.redirect(`${origin}/entrar?erro=1`);
    }
  } catch (e) {
    log.error("auth callback exception", { err: (e as any)?.message ?? String(e) });
    return NextResponse.redirect(`${origin}/entrar?erro=1`);
  }

  cookieStore; // manter referência viva
  return NextResponse.redirect(`${origin}${next}`);
}
