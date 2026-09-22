import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";
import { invalidarCache } from "../../../../lib/dados/airtable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POST: limpa a cache de 15 minutos desta entidade. A próxima leitura vai à fonte. */
export async function POST() {
  const supabase = await createClientServer();
  const authRes = await supabase.auth.getUser().catch(() => null);
  const user = authRes?.data?.user ?? null;
  if (!user) return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
  const meRes = await supabase.from("utilizadores").select("entidade_id").eq("id", user.id).single();
  const me = meRes.data as { entidade_id: string } | null;
  if (!me) return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });
  const cfgRes = await supabase.from("config_entidade").select("fonte_base").eq("entidade_id", me.entidade_id).maybeSingle();
  const base = (cfgRes.data as { fonte_base?: string | null } | null)?.fonte_base;
  if (base) invalidarCache(base);
  return NextResponse.json({ ok: true });
}
