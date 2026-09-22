"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { definirAction } from "../_actions";

function FormContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [hashToken, setHashToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busy, startTx] = useTransition();

  useEffect(() => {
    const h = window.location.hash;
    if (!h) return;
    const params = new URLSearchParams(h.startsWith("#") ? h.slice(1) : h);
    const accessToken = params.get("access_token");
    const type = params.get("type");
    if (accessToken && (type === "recovery" || type === "invite")) {
      setHashToken(accessToken);
    }
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }, []);

  const queryErro = search.get("erro");
  const token = search.get("token") || hashToken;

  useEffect(() => {
    if (queryErro === "1")
      setErro("As senhas não coincidem ou têm menos de 10 caracteres.");
    else if (queryErro === "2")
      setErro("Não foi possível atualizar a senha. Volte a pedir recuperação.");
    else setErro(null);
  }, [queryErro]);

  const pode = useMemo(
    () => senha.length >= 10 && senha === confirmar && token && !busy,
    [senha, confirmar, token, busy]
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !pode) return;
    const fd = new FormData();
    fd.set("password", senha);
    fd.set("confirmar", confirmar);
    fd.set("token", token);
    startTx(async () => {
      try {
        await definirAction(fd);
        router.replace("/quadro");
      } catch {
        setErro("Ocorreu um erro ao atualizar a senha.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Definir senha</h2>
        {!token && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--red)",
              background: "var(--red-pale)",
              borderRadius: 6,
              padding: "8px 10px",
            }}
          >
            Sem token de recuperação. Volta a pedir o email em recuperar.
          </p>
        )}
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
            }}
          >
            {erro}
          </p>
        )}
        {token && !erro && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            A nova senha deve ter pelo menos 10 caracteres.
          </p>
        )}
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13 }}>Nova senha</span>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={10}
          disabled={!token}
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
        <span style={{ fontSize: 13 }}>Confirmar senha</span>
        <input
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          minLength={10}
          disabled={!token}
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
        disabled={!pode}
        style={{
          height: 40,
          borderRadius: 6,
          background: pode ? "var(--fg)" : "var(--border)",
          color: pode ? "var(--bg)" : "var(--muted)",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Guardar senha
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <Link href="/entrar" style={{ color: "var(--muted)" }}>
          ← Voltar
        </Link>
      </div>
    </form>
  );
}

export default function DefinirPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "40px 16px",
            display: "grid",
            placeItems: "center",
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          A preparar…
        </div>
      }
    >
      <FormContent />
    </Suspense>
  );
}
