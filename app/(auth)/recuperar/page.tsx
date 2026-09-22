import Link from "next/link";
import { recuperarAction } from "../_actions";

export default function RecuperarPage() {
  return (
    <form
      action={recuperarAction}
      method="POST"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Recuperar senha</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Introduz o email da conta. Se existir, enviamos um link para definir
          uma nova senha.
        </p>
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
        Enviar email
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <Link href="/entrar" style={{ color: "var(--muted)" }}>
          ← Voltar
        </Link>
      </div>
    </form>
  );
}
