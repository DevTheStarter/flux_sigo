import { NextResponse } from "next/server";
import { createClientServer } from "../../../../lib/supabase/server";
import { createClientService } from "../../../../lib/supabase/service";
import { log } from "../../../../lib/log";
import { fonteDaEntidade } from "../../../../lib/cron/quadro";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CriarEntidadeBody = {
  nome: string;
  nipc?: string;
  fonte_tipo?: string;
  ativa?: boolean;
  contrato_assinado?: boolean;
  setup_em?: string;
};

async function validarStaff(supabase: any, user: { id: string }) {
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
  if (!me) return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });
  if (me.funcao !== "staff")
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  return null;
}

/**
 * GET: lista de entidades para a página Entidades (§15). Só staff.
 * Usa o service role apenas para ler `config_entidade.fonte_tipo`; nunca devolve
 * credenciais nem conteúdo do quadro.
 */
export async function GET() {
  try {
    const supabase = await createClientServer();
    let user: { id: string } | null = null;
    try {
      const res = await supabase.auth.getUser();
      user = (res.data as any)?.user ?? null;
    } catch {
      user = null;
    }
    if (!user || !user.id) return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
    const forbidden = await validarStaff(supabase, user);
    if (forbidden) return forbidden;

    const sb = createClientService();
    const [ents, users, cfgs, probs] = await Promise.all([
      sb.from("entidades").select("id, nome, nipc, ativa, suporte, setup_em, contrato_assinado, criada_em").order("criada_em", { ascending: false }),
      sb.from("utilizadores").select("entidade_id, ultimo_acesso"),
      sb.from("config_entidade").select("entidade_id, fonte_tipo, fonte_base"),
      sb.from("problemas_reportados").select("entidade_id, estado"),
    ]);
    if (ents.error) throw ents.error;
    const porEnt = new Map<string, { utilizadores: number; ultimaAtividade: string | null }>();
    for (const u of (users.data ?? []) as { entidade_id: string; ultimo_acesso: string | null }[]) {
      const e = porEnt.get(u.entidade_id) ?? { utilizadores: 0, ultimaAtividade: null };
      e.utilizadores += 1;
      if (u.ultimo_acesso && (!e.ultimaAtividade || u.ultimo_acesso > e.ultimaAtividade)) e.ultimaAtividade = u.ultimo_acesso;
      porEnt.set(u.entidade_id, e);
    }
    const fonte = new Map<string, { tipo: string | null; configurada: boolean }>();
    for (const c of (cfgs.data ?? []) as { entidade_id: string; fonte_tipo: string | null; fonte_base: string | null }[]) {
      fonte.set(c.entidade_id, { tipo: c.fonte_tipo, configurada: !!c.fonte_base });
    }
    const abertos = new Map<string, number>();
    for (const p of (probs.data ?? []) as { entidade_id: string | null; estado: string }[]) {
      if (p.estado === "aberto" && p.entidade_id) abertos.set(p.entidade_id, (abertos.get(p.entidade_id) ?? 0) + 1);
    }
    // §15 KPI "ações acompanhadas": só o número, via adaptador (cache de 15 min).
    // Nunca chega aqui nome, estado ou registo de uma ação (§2.4).
    const contagens = new Map<string, number>();
    await Promise.all(
      ((ents.data ?? []) as { id: string; ativa: boolean }[])
        .filter((e) => e.ativa && fonte.get(e.id)?.configurada)
        .map(async (e) => {
          try {
            const f = await fonteDaEntidade(sb, e.id);
            if ("erro" in f) return;
            contagens.set(e.id, await f.fonte.contarAcoes());
          } catch (err) {
            log.warn("entidades contar acoes", { entidade_id: e.id, err: (err as Error).message });
          }
        }),
    );
    const lista = ((ents.data ?? []) as any[]).map((e) => ({
      ...e,
      utilizadores: porEnt.get(e.id)?.utilizadores ?? 0,
      ultimaAtividade: porEnt.get(e.id)?.ultimaAtividade ?? null,
      fonteTipo: fonte.get(e.id)?.tipo ?? null,
      fonteConfigurada: fonte.get(e.id)?.configurada ?? false,
      problemasAbertos: abertos.get(e.id) ?? 0,
      acoes: contagens.has(e.id) ? (contagens.get(e.id) as number) : (null as number | null),
    }));
    return NextResponse.json({ entidades: lista });
  } catch (e) {
    log.error("entidades GET inesperado", { err: (e as Error).message });
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
    if (!user || !user.id)
      return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });

    const forbidden = await validarStaff(supabase, user);
    if (forbidden) return forbidden;

    let body: CriarEntidadeBody | null = null;
    try {
      body = (await req.json()) as CriarEntidadeBody;
    } catch {
      body = null;
    }
    if (!body)
      return NextResponse.json({ erro: "Body JSON inválido" }, { status: 400 });

    const nome = (body.nome ?? "").toString().trim();
    if (nome.length < 2)
      return NextResponse.json(
        { erro: "Nome da entidade é obrigatório (mínimo 2 caracteres)" },
        { status: 400 },
      );

    const nipc =
      body.nipc && body.nipc.trim().length > 0
        ? body.nipc.trim().slice(0, 20)
        : null;

    const ativa = typeof body.ativa === "boolean" ? body.ativa : true;
    const contrato_assinado =
      typeof body.contrato_assinado === "boolean"
        ? body.contrato_assinado
        : false;
    const setup_em =
      typeof body.setup_em === "string" &&
      body.setup_em.length >= 10 &&
      body.setup_em.length <= 20
        ? body.setup_em
        : null;

    let inserted: any = null;
    try {
      const insertRow: Record<string, unknown> = {
        nome,
        nipc,
        ativa,
        contrato_assinado,
        setup_em,
        suporte: false,
      };
      const table: any = (supabase as any).from("entidades");
      const res = await table
        .insert([insertRow])
        .select("id, nome, nipc, ativa, suporte, setup_em, contrato_assinado, criada_em")
        .single();
      if ((res as any).error) throw (res as any).error;
      inserted = res.data;
    } catch (e: any) {
      log.error("entidades post criar falhou", {
        user_id: user.id,
        nome,
        err: e?.message ?? String(e),
      });
      const duplicate =
        e?.code === "23505" ||
        String(e?.message ?? "").toLowerCase().includes("duplicate");
      return NextResponse.json(
        {
          erro: duplicate
            ? "Já existe uma entidade com esse nome."
            : "Falha ao criar entidade: " + (e?.message ?? String(e)),
        },
        { status: 422 },
      );
    }

    // fonte escolhida na criação (§15); o trigger já criou a linha de config_entidade
    const fonteTipo = typeof body.fonte_tipo === "string" && body.fonte_tipo.trim() ? body.fonte_tipo.trim().toLowerCase() : null;
    if (fonteTipo) {
      try {
        const sb = createClientService();
        await sb.from("config_entidade").upsert({ entidade_id: inserted.id, fonte_tipo: fonteTipo } as any, { onConflict: "entidade_id" });
      } catch (e) {
        log.warn("entidades post fonte_tipo não gravado", { err: (e as Error).message });
      }
    }

    log.info("entidades post criar concluído", {
      user_id: user.id,
      entidade_id: inserted.id,
      nome: inserted.nome,
    });
    return NextResponse.json(
      { entidade: inserted, ok: true },
      { status: 201 },
    );
  } catch (e) {
    log.error("entidades post inesperado", { err: (e as Error).message });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
    if (me.funcao !== "staff") {
      return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const entId: string | undefined = body?.id;
    if (!entId || typeof entId !== "string" || entId.trim().length === 0) {
      return NextResponse.json(
        { erro: "Falta campo id da entidade" },
        { status: 400 },
      );
    }

    let alvo:
      | { id: string; nome: string; suporte: boolean; ativa: boolean }
      | null = null;
    try {
      const res = await supabase
        .from("entidades")
        .select("id, nome, suporte, ativa")
        .eq("id", entId)
        .single();
      alvo = res.data as
        | { id: string; nome: string; suporte: boolean; ativa: boolean }
        | null;
    } catch {
      alvo = null;
    }
    if (!alvo) {
      return NextResponse.json(
        { erro: "Entidade não encontrada" },
        { status: 404 },
      );
    }
    if (alvo.suporte === true) {
      log.warn("entidades delete tentativa bloqueada (TheStarter)", {
        user_id: user.id,
        entidade_id: alvo.id,
        nome: alvo.nome,
      });
      return NextResponse.json(
        {
          erro:
            "Não é possível eliminar a entidade de suporte da plataforma (TheStarter).",
        },
        { status: 422 },
      );
    }

    try {
      const res = await supabase.from("entidades").delete().eq("id", alvo.id);
      if ((res as any).error) throw (res as any).error;
    } catch (e) {
      log.error("entidades delete falhou", {
        user_id: user.id,
        entidade_id: alvo.id,
        nome: alvo.nome,
        err: (e as Error).message,
      });
      return NextResponse.json(
        { erro: "Falha ao eliminar entidade" },
        { status: 500 },
      );
    }

    log.info("entidades delete concluído", {
      user_id: user.id,
      entidade_id: alvo.id,
      nome: alvo.nome,
    });
    return NextResponse.json({ ok: true, id: alvo.id, nome: alvo.nome });
  } catch (e) {
    log.error("entidades delete inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
