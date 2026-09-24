"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { createClientServer } from "../../lib/supabase/server";
import { createClientService } from "../../lib/supabase/service";
import { urlBase } from "../../lib/convites";
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
      // O link de recuperação traz um código PKCE; o callback troca-o por
      // sessão e segue para /definir?sessao=1, onde a palavra-passe é alterada.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${urlBase()}/api/auth/callback?next=/definir`,
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

/**
 * Aceitar um convite (§15, §16): cria a conta com a palavra-passe escolhida,
 * liga-a à entidade com a função do convite, marca o convite como usado e
 * inicia sessão. Token de uso único, válido 7 dias.
 * Erros: 1 palavra-passe, 3 convite inválido ou expirado, 4 conta já existe.
 */
export async function aceitarConviteAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  const token = String(formData.get("convite") ?? "").trim();
  const voltar = `/definir?convite=${encodeURIComponent(token)}`;

  if (!token) redirect("/definir?erro=3", RedirectType.replace);
  if (password.length < 10 || password !== confirmar) redirect(`${voltar}&erro=1`, RedirectType.replace);

  let sb: ReturnType<typeof createClientService>;
  try {
    sb = createClientService();
  } catch (e) {
    log.error("convite aceitar sem service role", { err: (e as Error).message });
    redirect(`${voltar}&erro=3`, RedirectType.replace);
  }

  const cRes = await sb
    .from("convites")
    .select("id, entidade_id, email, funcao, expira_em, usado_em")
    .eq("token", token)
    .maybeSingle();
  const convite = cRes.data as { id: string; entidade_id: string; email: string; funcao: string; expira_em: string; usado_em: string | null } | null;
  if (!convite || convite.usado_em || new Date(convite.expira_em) <= new Date()) {
    redirect(`${voltar}&erro=3`, RedirectType.replace);
  }
  const eRes = await sb.from("entidades").select("id, ativa").eq("id", convite.entidade_id).maybeSingle();
  if (!eRes.data || (eRes.data as { ativa: boolean }).ativa === false) {
    redirect(`${voltar}&erro=3`, RedirectType.replace);
  }

  // Já há perfil com este email: não se cria segunda conta.
  const jaExiste = await sb.from("utilizadores").select("id").eq("email", convite.email).maybeSingle();
  if (jaExiste.data) redirect(`${voltar}&erro=4`, RedirectType.replace);

  const nome = convite.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const criado = await sb.auth.admin.createUser({
    email: convite.email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (criado.error || !criado.data.user) {
    const msg = criado.error?.message ?? "";
    log.warn("convite criar conta falhou", { motivo: msg, convite_id: convite.id });
    redirect(`${voltar}&erro=${/already|exists|registered/i.test(msg) ? 4 : 3}`, RedirectType.replace);
  }
  const userId = criado.data.user.id;

  const perfil = await (sb as any).from("utilizadores").insert({
    id: userId,
    entidade_id: convite.entidade_id,
    nome,
    email: convite.email,
    funcao: convite.funcao,
  });
  if (perfil.error) {
    log.error("convite criar perfil falhou", { err: perfil.error.message, convite_id: convite.id });
    await sb.auth.admin.deleteUser(userId).catch(() => undefined);
    redirect(`${voltar}&erro=3`, RedirectType.replace);
  }
  await (sb as any).from("convites").update({ usado_em: new Date().toISOString() }).eq("id", convite.id);
  log.info("convite aceite", { convite_id: convite.id, entidade_id: convite.entidade_id, user_id: userId });

  // Sessão em cookies com o cliente SSR (anon key), como no login.
  try {
    const supabase = await createClientServer();
    const { error } = await supabase.auth.signInWithPassword({ email: convite.email, password });
    if (error) {
      log.warn("convite login após aceitar falhou", { motivo: error.message });
      redirect("/entrar", RedirectType.replace);
    }
  } catch (e) {
    log.error("convite login exception", { err: (e as Error).message });
    redirect("/entrar", RedirectType.replace);
  }
  redirect("/quadro", RedirectType.replace);
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
