import { redirect } from "next/navigation";
import { createClientServer } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClientServer();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/quadro");
  } catch {
    /* sem cookies: mostra o ecrã */
  }
  return (
    <main className="auth">
      <div className="auth-box">
        <div className="auth-logo">Fluxo</div>
        {children}
      </div>
    </main>
  );
}
