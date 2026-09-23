import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * §6.1 e §19: isolamento entre duas entidades reais, com ids forjados.
 * Corre só contra um projeto Supabase de teste, nunca contra produção:
 *
 *   FLUXO_TEST_SUPABASE_URL=... FLUXO_TEST_ANON_KEY=... FLUXO_TEST_SERVICE_ROLE_KEY=... npm test
 *
 * Cria duas entidades e dois utilizadores, verifica que cada um só vê o seu, e
 * apaga tudo no fim. Sem as três variáveis, o ficheiro é ignorado.
 */

const URL = process.env.FLUXO_TEST_SUPABASE_URL;
const ANON = process.env.FLUXO_TEST_ANON_KEY;
const SERVICE = process.env.FLUXO_TEST_SERVICE_ROLE_KEY;
const ativo = Boolean(URL && ANON && SERVICE);

const TABELAS_POR_ENTIDADE = ["vistas", "config_entidade", "config_relatorio", "notificacoes", "problemas_reportados", "documentos_variacao", "estado_notificacoes", "convites"] as const;

describe.skipIf(!ativo)("RLS: duas entidades", () => {
  const admin = ativo ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const sufixo = Date.now().toString(36);
  const ent: { id: string; nome: string }[] = [];
  const users: { id: string; email: string; password: string; entidadeId: string }[] = [];
  const clientes: SupabaseClient[] = [];
  let docId: string | null = null;

  beforeAll(async () => {
    for (const n of ["A", "B"]) {
      const e = await admin.from("entidades").insert({ nome: `RLS teste ${n} ${sufixo}`, setup_em: new Date().toISOString().slice(0, 10) }).select("id, nome").single();
      if (e.error) throw e.error;
      ent.push(e.data as { id: string; nome: string });
      const email = `rls-${n.toLowerCase()}-${sufixo}@example.com`;
      const password = `Teste-${sufixo}-${n}-1234`;
      const u = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (u.error || !u.data.user) throw u.error ?? new Error("sem utilizador");
      const perfil = await admin.from("utilizadores").insert({ id: u.data.user.id, entidade_id: e.data!.id, nome: `Utilizador ${n}`, email, funcao: "admin" });
      if (perfil.error) throw perfil.error;
      users.push({ id: u.data.user.id, email, password, entidadeId: e.data!.id });
      // uma linha por tabela, por entidade, para haver o que não ver
      await admin.from("notificacoes").insert({ entidade_id: e.data!.id, destinatario_id: u.data.user.id, tipo: "prazo", corpo: `só ${n}` });
      await admin.from("problemas_reportados").insert({ entidade_id: e.data!.id, reportado_por: u.data.user.id, flow: 1, descricao: `problema ${n}` });
      await admin.from("estado_notificacoes").insert({ entidade_id: e.data!.id, acao_ref: `rec${n}`, coluna: "1", estado: "ok" });
      await admin.from("convites").insert({ entidade_id: e.data!.id, email: `convite-${n}@example.com`, funcao: "gestor" });
    }
    const doc = await admin.from("documentos").select("id").limit(1).maybeSingle();
    docId = (doc.data as { id: string } | null)?.id ?? null;
    if (docId) {
      for (const e of ent) await admin.from("documentos_variacao").insert({ documento_id: docId, entidade_id: e.id, corpo: `<p>variação ${e.nome}</p>`, versao_base: "v0" });
    }
    for (const u of users) {
      const c = createClient(URL!, ANON!, { auth: { persistSession: false } });
      const s = await c.auth.signInWithPassword({ email: u.email, password: u.password });
      if (s.error) throw s.error;
      clientes.push(c);
    }
  }, 60_000);

  afterAll(async () => {
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
    for (const e of ent) await admin.from("entidades").delete().eq("id", e.id);
  }, 60_000);

  it("cada utilizador vê só a sua entidade", async () => {
    for (let i = 0; i < 2; i++) {
      const r = await clientes[i].from("entidades").select("id");
      expect(r.error).toBeNull();
      const ids = (r.data ?? []).map((x: { id: string }) => x.id);
      expect(ids).toContain(ent[i].id);
      expect(ids).not.toContain(ent[1 - i].id);
    }
  });

  it.each(TABELAS_POR_ENTIDADE)("%s: leitura filtrada por entidade, mesmo pedindo o id da outra", async (tabela) => {
    for (let i = 0; i < 2; i++) {
      const outra = await clientes[i].from(tabela).select("entidade_id").eq("entidade_id", ent[1 - i].id);
      expect(outra.error).toBeNull();
      expect(outra.data ?? []).toEqual([]);
      const tudo = await clientes[i].from(tabela).select("entidade_id");
      for (const row of (tudo.data ?? []) as { entidade_id: string }[]) expect(row.entidade_id).toBe(ent[i].id);
    }
  });

  it("utilizadores da outra entidade não são visíveis", async () => {
    const r = await clientes[0].from("utilizadores").select("id").eq("id", users[1].id);
    expect(r.data ?? []).toEqual([]);
  });

  it("inserir com o entidade_id da outra falha ou não fica visível", async () => {
    const r = await clientes[0].from("vistas").insert({ entidade_id: ent[1].id, nome: `forjada ${sufixo}`, condicoes: [] }).select("id");
    if (!r.error) {
      const viu = await admin.from("vistas").select("id").eq("entidade_id", ent[1].id).eq("nome", `forjada ${sufixo}`);
      expect(viu.data ?? []).toEqual([]);
    } else {
      expect(r.error).toBeTruthy();
    }
  });

  it("atualizar a config da outra entidade não tem efeito", async () => {
    const r = await clientes[0].from("config_entidade").update({ fonte_base: "appFORJADA" }).eq("entidade_id", ent[1].id).select("entidade_id");
    expect(r.data ?? []).toEqual([]);
    const real = await admin.from("config_entidade").select("fonte_base").eq("entidade_id", ent[1].id).maybeSingle();
    expect((real.data as { fonte_base: string | null } | null)?.fonte_base ?? null).not.toBe("appFORJADA");
  });

  it("a credencial cifrada nunca é lida pelo cliente com um id forjado", async () => {
    const r = await clientes[0].from("config_entidade").select("fonte_credencial").eq("entidade_id", ent[1].id);
    expect(r.data ?? []).toEqual([]);
  });
});
