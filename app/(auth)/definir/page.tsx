"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { definirAction } from "../_actions";

/** Convite (§16): o link de `convites`, 7 dias, uso único. */
function FormularioConvite({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; entidade: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [existente, setExistente] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/convites/${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = (await r.json()) as { email?: string; entidade?: string; erro?: string };
        if (!r.ok) setErro(j.erro || "Link inválido.");
        else setInfo({ email: j.email ?? "", entidade: j.entidade ?? "" });
      } catch {
        setErro("Não foi possível validar o link.");
      }
    })();
  }, [token]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (p1.length < 10) { setErro("Mínimo 10 caracteres."); return; }
    if (p1 !== p2) { setErro("As palavras-passe não coincidem."); return; }
    setErro(null);
    setAEnviar(true);
    try {
      const r = await fetch(`/api/convites/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, password: p1 }),
      });
      const j = (await r.json()) as { ok?: boolean; sessao?: boolean; contaExistente?: boolean; erro?: string };
      if (!r.ok) throw new Error(j.erro || "Não foi possível concluir o acesso.");
      if (j.contaExistente) { setExistente(true); return; }
      router.replace(j.sessao ? "/quadro" : "/entrar");
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setAEnviar(false);
    }
  }

  if (existente) {
    return (
      <div>
        <div className="auth-t">Já tinhas conta</div>
        <p className="auth-s">O acesso à <b>{info?.entidade}</b> ficou ligado à conta que já existia para {info?.email}. Entra com a palavra-passe que já tinhas, ou recupera-a.</p>
        <Link href="/entrar" className="btn">Entrar</Link>
        <p className="auth-foot"><Link href="/recuperar">Esqueci-me da palavra-passe</Link></p>
      </div>
    );
  }

  if (erro && !info) {
    return (
      <div>
        <div className="auth-t">Link inválido</div>
        <p className="auth-s">{erro}</p>
        <p className="auth-s">Pede um novo convite a quem administra a conta da tua entidade.</p>
        <p className="auth-foot"><Link href="/entrar">Voltar</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="auth-t">Definir palavra-passe</div>
      <p className="auth-s">
        {info ? <>Escolhe uma palavra-passe para concluir o acesso à <b>{info.entidade}</b> com o email {info.email}.</> : "A validar o link…"}
      </p>
      <div className="fld">
        <label className="fld-l" htmlFor="nome">Nome</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como queres aparecer à equipa" disabled={!info} autoComplete="name" />
      </div>
      <div className="fld">
        <label className="fld-l" htmlFor="p1">Palavra-passe</label>
        <input id="p1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="mínimo 10 caracteres" disabled={!info} />
      </div>
      <div className="fld">
        <label className="fld-l" htmlFor="p2">Repetir</label>
        <input id="p2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} disabled={!info} />
      </div>
      {erro ? <p className="err-msg" role="alert">{erro}</p> : null}
      <button type="submit" className="btn" style={{ marginTop: 6 }} disabled={!info || aEnviar || p1.length < 10 || p1 !== p2}>{aEnviar ? "A concluir…" : "Concluir"}</button>
      <p className="auth-foot"><Link href="/entrar">Voltar</Link></p>
    </form>
  );
}

/** Recuperação (§16): link do Supabase Auth, 60 minutos, uso único. */
function FormularioRecuperacao() {
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
      <p className="auth-s">Escolhe uma nova palavra-passe. Mínimo 10 caracteres. O link é de uso único.</p>
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

function Escolha() {
  const search = useSearchParams();
  const convite = search.get("convite");
  return convite ? <FormularioConvite token={convite} /> : <FormularioRecuperacao />;
}

export default function DefinirPage() {
  return (
    <Suspense fallback={<p className="auth-s">A preparar…</p>}>
      <Escolha />
    </Suspense>
  );
}
