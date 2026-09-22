import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Sair: POST /api/auth/sair → redirect /entrar?saiu=1 */
export async function POST(req: Request) {
  const { origin } = new URL(req.url);
  try {
    const supabase = await createClientServer();
    await supabase.auth.signOut({ scope: "global" }).catch(() => null);
  } catch {
    // ignore; sempre redirect
  }
  return NextResponse.redirect(`${origin}/entrar?saiu=1`, { status: 303 });
}
