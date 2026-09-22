import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";
import { log } from "../../../../lib/log";

type PapelValido = "staff" | "admin" | "gestor" | "leitura";
const FUNCOES_VALIDAS = new Set<PapelValido>([
  "staff",
  "admin",
  "gestor",
  "leitura",
]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
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
    if (me.funcao === "leitura") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    }

    const url = new URL(req.url);
    const filtroEnt = url.searchParams.get("entidade_id");

    try {
      const query = supabase
        .from("utilizadores")
        .select(
          "id,nome,email,funcao,entidade_id,ultimo_acesso,criado_em",
        );

      if (me.funcao === "staff") {
        if (filtroEnt) query.eq("entidade_id", filtroEnt);
      } else {
        query.eq("entidade_id", me.entidade_id);
        if (filtroEnt && filtroEnt !== me.entidade_id) {
          return NextResponse.json(
            { erro: "Sem permissão" },
            { status: 403 },
          );
        }
      }
      query.order("criado_em", { ascending: false });

      const res = await query;
      return NextResponse.json({ utilizadores: (res as any).data ?? [] });
    } catch (e) {
      log.error("utilizadores GET erro", {
        err: (e as Error).message,
      });
      return NextResponse.json(
        { erro: "Falha ao listar utilizadores" },
        { status: 500 },
      );
    }
  } catch (e) {
    log.error("utilizadores GET inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}

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

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const novoAuthId: string | undefined = body?.auth_id;
    const nome: string | undefined = body?.nome;
    const email: string | undefined = body?.email
      ? String(body.email).trim().toLowerCase()
      : undefined;
    const funcao: string | undefined = body?.funcao;
    let entidadeId: string = me.entidade_id;

    if (!novoAuthId || typeof novoAuthId !== "string") {
      return NextResponse.json(
        { erro: "Campo auth_id (UUID do auth.users) obrigatório." },
        { status: 400 },
      );
    }
    if (!nome || !email) {
      return NextResponse.json(
        { erro: "Campos nome e email obrigatórios." },
        { status: 400 },
      );
    }
    if (!funcao || !FUNCOES_VALIDAS.has(funcao as PapelValido)) {
      return NextResponse.json(
        {
          erro: `Campo funcao inválido (uma de: ${[
            ...FUNCOES_VALIDAS,
          ].join(", ")}).`,
        },
        { status: 400 },
      );
    }

    if (me.funcao === "staff") {
      const eid = body?.entidade_id;
      if (!eid || typeof eid !== "string") {
        return NextResponse.json(
          { erro: "Staff tem de indicar entidade_id no body." },
          { status: 400 },
        );
      }
      entidadeId = eid;
    } else if (me.funcao === "leitura") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    } else if (me.funcao !== "admin" && me.funcao !== "gestor") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    }

    if (funcao === "staff" && me.funcao !== "staff") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    }

    try {
      const res = await supabase
        .from("utilizadores")
        .insert({
          id: novoAuthId,
          entidade_id: entidadeId,
          nome,
          email,
          funcao: funcao as PapelValido,
        } as any)
        .select("id,nome,email,funcao,entidade_id")
        .single();
      const u = (res.data as any) ?? null;
      if (!u) {
        return NextResponse.json(
          { erro: "Falha ao inserir utilizador." },
          { status: 500 },
        );
      }
      log.info("utilizador criado", {
        id: u.id,
        email,
        funcao: u.funcao,
        entidade_id: entidadeId,
        criado_por: user.id,
      });
      return NextResponse.json({ utilizador: u }, { status: 201 });
    } catch (e) {
      log.error("utilizadores POST erro insert", {
        err: (e as Error).message,
        auth_id: novoAuthId,
        email,
      });
      return NextResponse.json(
        {
          erro:
            (e as Error)?.message ??
            "Falha ao inserir utilizador.",
        },
        { status: 500 },
      );
    }
  } catch (e) {
    log.error("utilizadores POST inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
