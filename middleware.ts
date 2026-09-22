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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protege = PROTEGIDAS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const res = NextResponse.next();

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
    "/((?!_next/static|_next/image|favicon.ico|robots.png|robots.txt|fonts/|base/).*)",
  ],
};
