import Link from "next/link";
import { entrarAction } from "../_actions";

export default function EntrarPage({
  searchParams,
}: {
  searchParams?: { erro?: string; recuperar?: string; saiu?: string };
}) {
  const erro = searchParams?.erro === "1";
  const recuperado = searchParams?.recuperar === "1";
  const saiu = searchParams?.saiu === "1";

  return (
    <form
      action={entrarAction}
      method="POST"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Iniciar sessão</h2>
        {erro && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--red)",
              background: "var(--red-pale)",
              borderRadius: 6,
              padding: "8px 10px",
              border: "1px solid var(--red-50, transparent)",
            }}
          >
            Credenciais inválidas ou sessão por confirmar.
          </p>
        )}
        {recuperado && (
          <p
            role="status"
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--fg)",
              background: "var(--panel)",
              borderRadius: 6,
              padding: "8px 10px",
              border: "1px solid var(--border)",
            }}
          >
            Se a conta existir, enviamos um email para recuperar a senha.
          </p>
        )}
        {saiu && (
          <p
            role="status"
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--muted)",
              background: "var(--panel)",
              borderRadius: 6,
              padding: "8px 10px",
              border: "1px solid var(--border)",
            }}
          >
            Sessão terminada.
          </p>
        )}
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13 }}>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13 }}>Senha</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          minLength={10}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
        />
      </label>

      <button
        type="submit"
        style={{
          height: 40,
          borderRadius: 6,
          background: "var(--fg)",
          color: "var(--bg)",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Entrar
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <Link href="/recuperar" style={{ color: "var(--muted)" }}>
          Esqueci a senha
        </Link>
        <span style={{ color: "var(--muted-dim)" }}>v1.0</span>
      </div>
    </form>
  );
}
