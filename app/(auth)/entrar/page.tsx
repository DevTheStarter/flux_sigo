import Link from "next/link";
import { entrarAction } from "../_actions";

export default function EntrarPage({ searchParams }: { searchParams?: { erro?: string; saiu?: string; next?: string } }) {
  const erro = searchParams?.erro === "1";
  const saiu = searchParams?.saiu === "1";
  return (
    <form action={entrarAction}>
      <div className="auth-t">Entrar</div>
      <p className="auth-s">Usa o email da tua entidade formadora.</p>
      <div className="fld">
        <label className="fld-l" htmlFor="email">Email</label>
        <input id="email" type="email" name="email" required autoComplete="email" placeholder="nome@entidade.pt" />
      </div>
      <div className="fld">
        <label className="fld-l" htmlFor="password">Palavra-passe</label>
        <input id="password" type="password" name="password" required autoComplete="current-password" placeholder="••••••••" />
      </div>
      {erro ? <p className="err-msg" role="alert">Email ou palavra-passe incorretos.</p> : null}
      {saiu ? <p className="ok-msg" role="status">Sessão terminada.</p> : null}
      <button type="submit" className="btn" style={{ marginTop: 6 }}>Entrar</button>
      <p className="auth-foot">
        <Link href="/recuperar">Esqueci-me da palavra-passe</Link>
      </p>
      <div className="auth-note">
        O Fluxo não tem registo. As contas são criadas pela TheStarter. Se a tua entidade subscreveu e ainda não tens acesso, fala com quem administra a conta.
      </div>
    </form>
  );
}
