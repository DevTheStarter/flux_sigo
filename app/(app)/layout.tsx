import { redirect } from "next/navigation";
import { createClientServer } from "../../lib/supabase/server";
import { TopBar } from "../../components/shell/TopBar";
import { BottomNav } from "../../components/shell/BottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { id: string; email?: string; user_metadata?: { name?: string } } | null = null;
  try {
    const supabase = await createClientServer();
    const res = await supabase.auth.getUser();
    user = res.data.user;
    if (user) {
      let data: any = null;
      try {
        const r = await supabase
          .from("utilizadores")
          .select("funcao, entidade_id, entidades:entidade_id(nome)")
          .eq("id", user.id)
          .single();
        data = r.data;
      } catch (e) {
        data = null;
      }
      const papel = (data as any)?.funcao as
        | "staff"
        | "admin"
        | "gestor"
        | "leitura"
        | undefined;
      const entidade = (data as any)?.entidades as { nome: string } | null;
      const entidadeNome = (entidade?.nome) as string | undefined;
      return (
        <>
          <TopBar
            userEmail={user.email}
            userName={user.user_metadata?.name}
            papel={papel ?? "leitura"}
            entidadeNome={entidadeNome}
          />
          <div
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 1440,
              marginInline: "auto",
              minWidth: 0,
            }}
          >
            {children}
          </div>
          <BottomNav />
        </>
      );
    }
  } catch {
    // ignorar
  }

  if (!user) redirect("/entrar?erro=1");
  return null;
}
