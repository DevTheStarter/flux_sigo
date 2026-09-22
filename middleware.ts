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
const ADMIN_APENAS = ["/api/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const salta = !PROTEGIDAS.some((p) =>
    pathname === p || pathname.startsWith(p + "/")
  );
  if (salta) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Cookie[]) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (ADMIN_APENAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const staff = await supabase
      .from("utilizadores")
      .select("papel")
      .eq("id", user.id)
      .single<{ papel: string }>();
    if (staff.error || staff.data.papel !== "staff") {
      return NextResponse.json(
        { erro: "staff apenas" },
        { status: 403 }
      );
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/quadro/:path*",
    "/definicoes/:path*",
    "/documentacao/:path*",
    "/entidades/:path*",
    "/api/admin/:path*",
  ],
};
