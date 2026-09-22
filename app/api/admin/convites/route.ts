import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";
import { log } from "../../../../lib/log";

const FUNCOES_VALIDAS = new Set(["admin", "gestor", "leitura"]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const supabase = await createClientServer();

    let user: { id: string } | null = null;
    try {
      const res = await supabase.auth.getUser();
      user = (res.data as any)?.user ?? null;
    } catch {
      user = null;
    }
    if (!user || !user.id) {
      return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
    }

    let me: { funcao: string; entidade_id: string } | null = null;
    try {
      const res = await supabase
        .from("utilizadores")
        .select("funcao, entidade_id")
        .eq("id", user.id)
        .single();
      me = res.data as { funcao: string; entidade_id: string } | null;
    } catch {
      me = null;
    }
    if (!me) {
      return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });
    }

    let entidadeId: string = me.entidade_id;

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { erro: "Body JSON inválido" },
        { status: 400 },
      );
    }

    const email: string | undefined = body?.email
      ? String(body.email).trim().toLowerCase()
      : undefined;
    const funcao: string | undefined = body?.funcao
      ? String(body.funcao).trim()
      : undefined;

    if (!email) {
      return NextResponse.json(
        { erro: "Campo email obrigatório" },
        { status: 400 },
      );
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { erro: "Email inválido" },
        { status: 400 },
      );
    }
    if (!funcao || !FUNCOES_VALIDAS.has(funcao)) {
      return NextResponse.json(
        {
          erro: `Campo funcao inválido (uma de: ${[
            ...FUNCOES_VALIDAS,
          ].join(", ")})`,
        },
        { status: 400 },
      );
    }

    if (me.funcao === "staff") {
      const eid = body?.entidade_id;
      if (!eid || typeof eid !== "string") {
        return NextResponse.json(
          { erro: "Staff tem de indicar entidade_id no body" },
          { status: 400 },
        );
      }
      entidadeId = eid;
    } else if (me.funcao === "leitura") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    } else if (me.funcao !== "admin" && me.funcao !== "gestor") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    }

    if (funcao === "staff") {
      return NextResponse.json(
        { erro: "Não é possível convidar staff por esta via." },
        { status: 400 },
      );
    }

    let existente: { usado_em: unknown; expira_em: string } | null = null;
    try {
      const res = await supabase
        .from("convites")
        .select("id, usado_em, expira_em")
        .eq("entidade_id", entidadeId)
        .eq("email", email)
        .maybeSingle();
      existente = (res.data as any) ?? null;
    } catch {
      existente = null;
    }
    if (
      existente &&
      !(existente as any).usado_em &&
      new Date(existente.expira_em) > new Date()
    ) {
      return NextResponse.json(
        {
          erro:
            "Já existe um convite ativo para este email nesta entidade.",
        },
        { status: 409 },
      );
    }

    let convite: {
      id: string;
      email: string;
      funcao: string;
      entidade_id: string;
      expira_em: string;
      token: string;
    } | null = null;
    try {
      const res = await supabase
        .from("convites")
        .insert({
          entidade_id: entidadeId,
          email,
          funcao,
        } as any)
        .select("id, email, funcao, entidade_id, expira_em, token")
        .single();
      convite = (res.data as any) ?? null;
    } catch (e) {
      log.error("convites criar falha", {
        err: (e as Error).message,
        email,
        funcao,
        entidade_id: entidadeId,
        user_id: user.id,
      });
      return NextResponse.json(
        { erro: "Falha ao criar convite." },
        { status: 500 },
      );
    }
    if (!convite) {
      return NextResponse.json(
        { erro: "Falha ao criar convite." },
        { status: 500 },
      );
    }

    log.info("convite criado", {
      convite_id: convite.id,
      email,
      funcao,
      entidade_id: entidadeId,
      criado_por: user.id,
    });

    return NextResponse.json(
      {
        convite: {
          id: convite.id,
          email: convite.email,
          funcao: convite.funcao,
          entidade_id: convite.entidade_id,
          expira_em: convite.expira_em,
          token: convite.token,
        },
        nota:
          "Envio de email pendente de integração Resend. Por enquanto partilhe " +
          "manualmente o link /definir?convite_token=<token> com o utilizador.",
      },
      { status: 201 },
    );
  } catch (e) {
    log.error("convites POST erro inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
