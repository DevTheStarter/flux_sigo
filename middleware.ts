import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type Cookie = { name: string; value: string; options: CookieOptions };

const PROTEGIDAS = [
  "/quadro",
  "/definicoes",
  "/documentacao",
  "/entidades",
  "/api/admin",
];

const STAFF_APENAS = ["/api/admin"];

/**
 * CSP com nonce por pedido (§19). O App Router precisa de scripts inline para
 * hidratar; um nonce permite-os sem 'unsafe-inline'. O Next lê o nonce do
 * cabeçalho Content-Security-Policy do pedido e aplica-o aos seus scripts.
 */
function cspComNonce(): { nonce: string; csp: string } {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return { nonce, csp };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protege = PROTEGIDAS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const { nonce, csp } = cspComNonce();
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);

  // 1. Criar cliente Supabase e sincronizar SEMPRE os cookies (mesmo em rotas
  //    não protegidas) — evita perda de sessão em redirects ou navegação.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Cookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // 1a. atualizar cookies do request (reutilização em passos seguintes)
            request.cookies.set(name, value);
            // 1b. escrever Set-Cookie no response final (obrigatório)
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh sessão: obrigatório no middleware para garantir que getUser atualiza
  // os cookies antes de devolver resposta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!protege) {
    return res;
  }

  // Rotas protegidas: sem login → redirecionar para /entrar com ?next=
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    // Propagar quaisquer cookies atualizados para o redirect também.
    const resCookies = res.cookies.getAll();
    for (const c of resCookies) redirect.cookies.set(c.name, c.value, c as any);
    return redirect;
  }

  // Rotas STAFF_APENAS: obrigatório funcao === 'staff'.
  // Apenas aplicado se o caminho corresponder a STAFF_APENAS.
  const staffOnly = STAFF_APENAS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (staffOnly) {
    const resQ = await supabase
      .from("utilizadores")
      .select("funcao")
      .eq("id", user.id)
      .maybeSingle();
    const funcao = (resQ.data as { funcao?: string } | null)?.funcao ?? null;
    if (resQ.error || funcao !== "staff") {
      const forbidden = NextResponse.json(
        { erro: "staff apenas" },
        { status: 403 }
      );
      const resCookies = res.cookies.getAll();
      for (const c of resCookies) forbidden.cookies.set(c.name, c.value, c as any);
      return forbidden;
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match todas paths EXCETO:
     *   - arquivos estáticos (imagens, fonts, etc.)
     *   - _next (compilação Next)
     *   - favicon.ico / robots.txt
     *   - api/auth (callback + sair têm force-dynamic + PKCE, não precisam de
     *     middleware de proteção).
     * Depois filtramos programaticamente em PROTEGIDAS acima.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.png|robots.txt|fonts/|docs/|tema.js|base/).*)",
  ],
};
