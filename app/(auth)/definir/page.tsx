"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { definirAction } from "../_actions";

function Formulario() {
  const search = useSearchParams();
  const router = useRouter();
  const [hashToken, setHashToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, startTx] = useTransition();

  useEffect(() => {
    const h = window.location.hash;
    if (!h) return;
    const params = new URLSearchParams(h.startsWith("#") ? h.slice(1) : h);
    const t = params.get("access_token");
    const tipo = params.get("type");
    if (t && (tipo === "recovery" || tipo === "invite")) setHashToken(t);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const token = search.get("token") || hashToken;
  const queryErro = search.get("erro");
  useEffect(() => {
    if (queryErro === "1") setErro("As palavras-passe não coincidem ou têm menos de 10 caracteres.");
    else if (queryErro === "2") setErro("O link já não é válido. Pede um novo em Recuperar acesso.");
    else setErro(null);
  }, [queryErro]);

  const pode = useMemo(() => p1.length >= 10 && p1 === p2 && !!token && !busy, [p1, p2, token, busy]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (p1.length < 10) { setErro("Mínimo 10 caracteres."); return; }
    if (p1 !== p2) { setErro("As palavras-passe não coincidem."); return; }
    if (!token) return;
    const fd = new FormData();
    fd.set("password", p1);
    fd.set("confirmar", p2);
    fd.set("token", token);
    startTx(async () => {
      try {
        await definirAction(fd);
        router.replace("/quadro");
      } catch {
        setErro("Não foi possível definir a palavra-passe.");
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="auth-t">Definir palavra-passe</div>
      <p className="auth-s">Escolhe uma palavra-passe para concluir o acesso. Mínimo 10 caracteres. O link é de uso único.</p>
      {!token ? <p className="err-msg" role="alert" style={{ marginBottom: 14 }}>Sem link válido. Pede um novo em Recuperar acesso.</p> : null}
      <div className="fld">
        <label className="fld-l" htmlFor="p1">Palavra-passe</label>
        <input id="p1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="mínimo 10 caracteres" disabled={!token} />
      </div>
      <div className="fld">
        <label className="fld-l" htmlFor="p2">Repetir</label>
        <input id="p2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} disabled={!token} />
      </div>
      {erro ? <p className="err-msg" role="alert">{erro}</p> : null}
      <button type="submit" className="btn" style={{ marginTop: 6 }} disabled={!pode}>Concluir</button>
      <p className="auth-foot"><Link href="/entrar">Voltar</Link></p>
    </form>
  );
}

export default function DefinirPage() {
  return (
    <Suspense fallback={<p className="auth-s">A preparar…</p>}>
      <Formulario />
    </Suspense>
  );
}
