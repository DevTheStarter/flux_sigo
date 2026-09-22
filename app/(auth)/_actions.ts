"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { createClientServer } from "../../lib/supabase/server";
import { log } from "../../lib/log";

const URL_FRACASSO_GERAL = "/entrar?erro=1";

/** Sem enumeração de emails: resposta igual para email inválido e password errada. */
export async function entrarAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido || password.length === 0) {
    redirect("/entrar?erro=1", RedirectType.replace);
  }

  const cookieStore = cookies();
  const supabase = await createClientServer();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      log.warn("auth falhou", { motivo: error?.message ?? "sem sessao" });
      redirect(URL_FRACASSO_GERAL, RedirectType.replace);
    }
  } catch (e) {
    log.error("auth exception", { err: (e as any)?.message ?? String(e) });
    redirect(URL_FRACASSO_GERAL, RedirectType.replace);
  }

  cookieStore; // para manter o import vivo; o getSupabaseServer já leu cookies
  redirect("/quadro", RedirectType.replace);
}

export async function recuperarAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Mesmo que email inválido ou não exista, retornar sucesso para não enumerar.
  if (emailValido) {
    try {
      const supabase = await createClientServer();
      const urlBase =
        process.env.NEXT_PUBLIC_SITE_URL ??
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000");
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${urlBase}/definir`,
      });
    } catch (e) {
      log.error("auth reset email exception", { err: (e as any)?.message ?? String(e) });
    }
  }
  redirect("/recuperar?enviado=1", RedirectType.replace);
}

/**
 * Action usada quando já tem sessão de recuperação ativa (PKCE hash trocado no cliente
 * ou token de recovery enviado via query).
 */
export async function definirAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  const token = String(formData.get("token") ?? "").trim();

  if (password.length < 10 || password !== confirmar) {
    redirect(
      `/definir${token ? `?token=${encodeURIComponent(token)}` : ""}&erro=1`,
      RedirectType.replace
    );
  }

  try {
    const supabase = await createClientServer();
    let atualizou = false;
    if (token) {
      // Trocar token recovery por sessão
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "recovery",
      });
      if (error || !data.user) {
        redirect("/definir?erro=2", RedirectType.replace);
      }
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      log.warn("auth update pass falhou", { motivo: error.message });
      redirect(
        `/definir${token ? `?token=${encodeURIComponent(token)}` : ""}&erro=2`,
        RedirectType.replace
      );
    }
    atualizou = true;
    return { ok: atualizou };
  } catch (e) {
    log.error("auth definir exception", { err: (e as any)?.message ?? String(e) });
    redirect("/definir?erro=2", RedirectType.replace);
  }
}

export async function sairAction() {
  try {
    const supabase = await createClientServer();
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // mesmo em erro, vamos para /entrar
  }
  redirect("/entrar?saiu=1", RedirectType.replace);
}
