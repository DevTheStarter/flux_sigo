import { NextResponse } from "next/server";
import { createClientService } from "../../../../lib/supabase/service";
import { createClientServer } from "../../../../lib/supabase/server";
import { log } from "../../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Convites (§16). Rota pública: quem tem o link ainda não tem sessão.
 * O token vive em `convites` (7 dias, uso único). A identidade continua a ser
 * o Supabase Auth: aqui só se cria o utilizador Auth e a linha em `utilizadores`.
 */

interface Convite {
  id: string;
  entidade_id: string;
  email: string;
  funcao: "admin" | "gestor" | "leitura";
  expira_em: string;
  usado_em: string | null;
}

async function lerConvite(token: string) {
  const sb = createClientService();
  const r = await sb
    .from("convites")
    .select("id, entidade_id, email, funcao, expira_em, usado_em, entidades:entidade_id(nome, ativa)")
    .eq("token", token)
    .maybeSingle();
  const c = r.data as unknown as (Convite & { entidades: { nome: string; ativa: boolean } | null }) | null;
  if (!c) return { erro: "Link inválido.", estado: 404 as const };
  if (c.usado_em) return { erro: "Este link já foi usado.", estado: 410 as const };
  if (new Date(c.expira_em).getTime() < Date.now()) return { erro: "Este link expirou. Pede um novo convite.", estado: 410 as const };
  if (c.entidades && !c.entidades.ativa) return { erro: "Esta entidade está desativada.", estado: 410 as const };
  return { convite: c, sb };
}

/** GET: valida o link e diz a quem é (email, entidade). Não expõe mais nada. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token ?? "");
  if (!token || token.length > 200) return NextResponse.json({ erro: "Link inválido." }, { status: 400 });
  const r = await lerConvite(token);
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.estado });
  return NextResponse.json({ email: r.convite.email, entidade: r.convite.entidades?.nome ?? "", funcao: r.convite.funcao });
}

/**
 * POST { nome, password }: cria o utilizador Auth com a palavra-passe escolhida,
 * a linha em `utilizadores`, marca o convite como usado e inicia sessão.
 * Se já existir conta Auth com este email, liga-a à entidade sem tocar na palavra-passe.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token ?? "");
  if (!token || token.length > 200) return NextResponse.json({ erro: "Link inválido." }, { status: 400 });

  let body: { nome?: unknown; password?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 10) return NextResponse.json({ erro: "A palavra-passe tem de ter pelo menos 10 caracteres." }, { status: 400 });

  const r = await lerConvite(token);
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.estado });
  const { convite, sb } = r;
  const email = convite.email.toLowerCase();

  // 1. utilizador Auth (identidade continua no Supabase Auth)
  let authId: string | null = null;
  let contaExistente = false;
  const criado = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } });
  if (criado.data.user) {
    authId = criado.data.user.id;
  } else {
    const msg = criado.error?.message ?? "";
    const jaExiste = /already|exists|registered/i.test(msg) || criado.error?.status === 422;
    if (!jaExiste) {
      log.error("convite createUser falhou", { err: msg });
      return NextResponse.json({ erro: "Não foi possível criar a conta." }, { status: 500 });
    }
    // conta já existe: encontrar o id sem alterar a palavra-passe dessa pessoa
    contaExistente = true;
    let pagina = 1;
    while (!authId && pagina <= 20) {
      const lista = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (lista.error) break;
      const u = lista.data.users.find((x) => (x.email ?? "").toLowerCase() === email);
      if (u) authId = u.id;
      if (lista.data.users.length < 200) break;
      pagina += 1;
    }
    if (!authId) {
      log.error("convite conta existente não encontrada", { email });
      return NextResponse.json({ erro: "Já existe uma conta com este email. Entra com a tua palavra-passe ou recupera-a." }, { status: 409 });
    }
  }

  // 2. linha em utilizadores (RLS ignorada: service role)
  const nomeFinal = nome || email.split("@")[0];
  const up = await (sb as any)
    .from("utilizadores")
    .upsert({ id: authId, entidade_id: convite.entidade_id, nome: nomeFinal, email, funcao: convite.funcao }, { onConflict: "id" });
  if (up.error) {
    log.error("convite utilizadores upsert falhou", { err: up.error.message });
    return NextResponse.json({ erro: "Não foi possível concluir o acesso." }, { status: 500 });
  }

  // 3. convite usado (uso único)
  await (sb as any).from("convites").update({ usado_em: new Date().toISOString() }).eq("id", convite.id);
  log.info("convite concluído", { convite_id: convite.id, entidade_id: convite.entidade_id, existente: contaExistente });

  // 4. sessão: só quando a palavra-passe acabou de ser definida
  if (contaExistente) {
    return NextResponse.json({ ok: true, contaExistente: true });
  }
  try {
    const supabase = await createClientServer();
    const login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) return NextResponse.json({ ok: true, sessao: false });
  } catch {
    return NextResponse.json({ ok: true, sessao: false });
  }
  return NextResponse.json({ ok: true, sessao: true });
}
