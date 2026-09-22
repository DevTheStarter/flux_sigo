import { redirect } from "next/navigation";
import { createClientServer } from "../../lib/supabase/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createClientServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/quadro");
  } catch {
    // ignorar; cookies podem estar ausentes no edge
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              letterSpacing: "-0.01em",
            }}
          >
            Fluxo
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--muted)",
            }}
          >
            SIGO · Ligações formação
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
