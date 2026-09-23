import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClientServer } from "../lib/supabase/server";
import { prepararLanding } from "../lib/landing/preparar";
import landing from "./landing.html";

export const dynamic = "force-dynamic";

/**
 * `/` serve a landing (app/landing.html) tal e qual, sem o layout React da
 * aplicação: página estática, com o nonce da CSP aplicado ao script.
 * Com sessão iniciada continua a ir para /quadro, como antes.
 */
export async function GET(request: NextRequest) {
  let comSessao = false;
  try {
    const supabase = await createClientServer();
    const { data } = await supabase.auth.getUser();
    comSessao = Boolean(data.user);
  } catch {
    /* sem cookies ou sem Supabase configurado: mostra a landing */
  }
  if (comSessao) return NextResponse.redirect(new URL("/quadro", request.url));

  const nonce = headers().get("x-nonce");
  return new NextResponse(prepararLanding(landing, nonce), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
