import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";
import { enviarEmail, transporteConfigurado } from "../../../../lib/email";
import { urlBase } from "../../../../lib/convites";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Diagnóstico de email, só staff. Envia um email de teste para o próprio
 * endereço e devolve o transporte usado, o remetente e o erro, se houver.
 * Não expõe credenciais: só nomes de variáveis e mensagens de erro.
 */
export async function POST() {
  const supabase = await createClientServer();
  const authRes = await supabase.auth.getUser().catch(() => null);
  const user = authRes?.data?.user ?? null;
  if (!user) return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
  const meRes = await supabase.from("utilizadores").select("funcao, email, nome").eq("id", user.id).single();
  const me = meRes.data as { funcao: string; email: string; nome: string } | null;
  if (!me || me.funcao !== "staff") return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const configurado = {
    transporte: transporteConfigurado(),
    SMTP_USER: Boolean(process.env.SMTP_USER?.trim()),
    SMTP_PASS: Boolean(process.env.SMTP_PASS),
    SMTP_HOST: process.env.SMTP_HOST?.trim() || "smtp.gmail.com (por defeito)",
    SMTP_PORT: process.env.SMTP_PORT?.trim() || "587 (por defeito)",
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    EMAIL_DE: process.env.EMAIL_DE?.trim() || null,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.trim() || null,
    urlBase: urlBase(),
  };

  const r = await enviarEmail({
    para: me.email,
    assunto: "Fluxo · email de teste",
    html: `<p>Olá ${me.nome || ""},</p><p>Este é um email de teste do Fluxo. Se o estás a ler, o envio está a funcionar.</p><p style="color:#8d8d8d;font-size:12px">Transporte: ${configurado.transporte}. Aplicação: ${configurado.urlBase}.</p>`,
  });
  log.info("email de teste", { ok: r.ok, transporte: r.transporte, por: user.id });
  return NextResponse.json({ ok: r.ok, para: me.email, transporte: r.transporte, remetente: r.remetente, erro: r.erro ?? null, id: r.id ?? null, configurado });
}
