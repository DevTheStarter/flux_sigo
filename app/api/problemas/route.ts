import { NextResponse } from "next/server";
import { createClientServer } from "../../../lib/supabase/server";
import { enviarEmail } from "../../../lib/email";
import { log } from "../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_ANEXOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = new Set(["image/png", "image/jpeg", "image/webp"]);
const BUCKET = "problemas-anexos";

function dentroDos30(setupEm: string | null): boolean {
  if (!setupEm) return false;
  const t = new Date(setupEm).getTime();
  return Number.isFinite(t) && (Date.now() - t) / 86400000 <= 30;
}

/**
 * POST multipart: descricao, flow, acao_ref, acao_nome, anexos[] (§11).
 * Só quando podeReportar(): staff, suporte, ou 30 dias após o setup.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClientServer();
    const authRes = await supabase.auth.getUser().catch(() => null);
    const user = authRes?.data?.user ?? null;
    if (!user) return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });

    const meRes = await supabase
      .from("utilizadores")
      .select("funcao, entidade_id, nome, email, entidades:entidade_id(nome, suporte, setup_em)")
      .eq("id", user.id)
      .single();
    const me = meRes.data as unknown as {
      funcao: string;
      entidade_id: string;
      nome: string;
      email: string;
      entidades: { nome: string; suporte: boolean; setup_em: string | null } | null;
    } | null;
    if (!me) return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });

    const pode = me.funcao === "staff" || !!me.entidades?.suporte || dentroDos30(me.entidades?.setup_em ?? null);
    if (!pode) return NextResponse.json({ erro: "Reportar problemas exige plano de suporte." }, { status: 403 });

    const form = await req.formData();
    const descricao = String(form.get("descricao") ?? "").trim();
    const flow = Number(form.get("flow"));
    const acaoRef = String(form.get("acao_ref") ?? "") || null;
    const acaoNome = String(form.get("acao_nome") ?? "") || null;
    if (!descricao) return NextResponse.json({ erro: "Descreve o que aconteceu." }, { status: 400 });
    if (!Number.isInteger(flow) || flow < 0 || flow > 5) return NextResponse.json({ erro: "Flow inválido" }, { status: 400 });

    const ficheiros = form.getAll("anexos").filter((f): f is File => f instanceof File && f.size > 0);
    if (ficheiros.length > MAX_ANEXOS) return NextResponse.json({ erro: `Máximo ${MAX_ANEXOS} ficheiros.` }, { status: 400 });
    for (const f of ficheiros) {
      if (!TIPOS.has(f.type)) return NextResponse.json({ erro: `${f.name} não é PNG, JPG ou WEBP.` }, { status: 400 });
      if (f.size > MAX_BYTES) return NextResponse.json({ erro: `${f.name} excede 5 MB.` }, { status: 400 });
    }

    const ins = await (supabase as any)
      .from("problemas_reportados")
      .insert({ entidade_id: me.entidade_id, reportado_por: user.id, flow, acao_ref: acaoRef, acao_nome: acaoNome, descricao })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      log.error("problemas inserir falhou", { err: ins.error?.message });
      return NextResponse.json({ erro: "Não foi possível registar o problema." }, { status: 500 });
    }
    const problemaId = ins.data.id as string;

    const apagarEm = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const links: string[] = [];
    for (const f of ficheiros) {
      const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const caminho = `${user.id}/${problemaId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(caminho, f, { contentType: f.type, upsert: false });
      if (up.error) {
        log.warn("problemas anexo upload falhou", { err: up.error.message });
        continue;
      }
      await (supabase as any)
        .from("problemas_anexos")
        .insert({ problema_id: problemaId, caminho, nome: f.name, tamanho: f.size, apagar_em: apagarEm });
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60 * 24 * 7);
      if (signed.data?.signedUrl) links.push(signed.data.signedUrl);
    }

    await (supabase as any).from("notificacoes").insert({
      entidade_id: me.entidade_id,
      destinatario_id: user.id,
      remetente_id: user.id,
      tipo: "problema",
      corpo: `Reportaste um problema no Flow ${flow}${acaoNome ? ` — ${acaoNome}` : ""}${ficheiros.length ? ` · ${ficheiros.length} ${ficheiros.length === 1 ? "imagem" : "imagens"}` : ""}`,
      acao_ref: acaoRef,
    });

    const destino = process.env.EMAIL_REPORTES ?? "people@thestarter.io";
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    try {
      await enviarEmail({
        para: destino,
        assunto: `[Fluxo] Problema no Flow ${flow} · ${me.entidades?.nome ?? "entidade"}`,
        html:
          `<p><b>${esc(me.entidades?.nome ?? "")}</b> · ${esc(me.nome)} (${esc(me.email)})</p>` +
          `<p>Ação de formação: ${esc(acaoNome ?? "—")} · Flow ${flow}</p>` +
          `<p style="white-space:pre-wrap">${esc(descricao)}</p>` +
          (links.length ? `<p>Anexos:</p><ul>${links.map((l) => `<li><a href="${l}">${l}</a></li>`).join("")}</ul>` : ""),
      });
    } catch (e) {
      log.warn("problemas email falhou", { err: (e as Error).message });
    }

    return NextResponse.json({ ok: true, id: problemaId, anexos: links.length });
  } catch (e) {
    log.error("problemas erro inesperado", { err: (e as Error).message });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
