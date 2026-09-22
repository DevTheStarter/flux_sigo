import { redirect } from "next/navigation";
import { createClientServer } from "../../lib/supabase/server";
import { AppShell } from "../../components/shell/AppShell";
import type { Sessao } from "../../lib/cliente/sessao";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let sessao: Sessao | null = null;
  try {
    const supabase = await createClientServer();
    const res = await supabase.auth.getUser();
    const user = res.data.user;
    if (user) {
      const r = await supabase
        .from("utilizadores")
        .select("id, nome, email, funcao, entidade_id, entidades:entidade_id(nome, suporte, setup_em)")
        .eq("id", user.id)
        .single();
      const d = r.data as unknown as {
        id: string;
        nome: string;
        email: string;
        funcao: Sessao["funcao"];
        entidade_id: string;
        entidades: { nome: string; suporte: boolean; setup_em: string | null } | null;
      } | null;
      if (d) {
        sessao = {
          id: d.id,
          nome: d.nome ?? "",
          email: d.email ?? user.email ?? "",
          funcao: d.funcao ?? "leitura",
          entidadeId: d.entidade_id,
          entidadeNome: d.entidades?.nome ?? "",
          suporte: !!d.entidades?.suporte,
          setupEm: d.entidades?.setup_em ?? null,
        };
      }
    }
  } catch {
    sessao = null;
  }

  if (!sessao) redirect("/entrar");

  return <AppShell sessao={sessao}>{children}</AppShell>;
}
