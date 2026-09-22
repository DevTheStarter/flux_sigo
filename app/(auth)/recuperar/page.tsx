import Link from "next/link";
import { recuperarAction } from "../_actions";

export default function RecuperarPage({ searchParams }: { searchParams?: { enviado?: string } }) {
  if (searchParams?.enviado === "1") {
    return (
      <div>
        <div className="auth-t">Verifica o teu email</div>
        <p className="auth-s">Se existir uma conta com esse endereço, recebeste um link. É válido 60 minutos e só pode ser usado uma vez.</p>
        <p className="auth-foot"><Link href="/entrar">Voltar</Link></p>
      </div>
    );
  }
  return (
    <form action={recuperarAction}>
      <div className="auth-t">Recuperar acesso</div>
      <p className="auth-s">Enviamos um link para definires uma nova palavra-passe.</p>
      <div className="fld">
        <label className="fld-l" htmlFor="email">Email</label>
        <input id="email" type="email" name="email" required autoComplete="email" placeholder="nome@entidade.pt" />
      </div>
      <button type="submit" className="btn" style={{ marginTop: 6 }}>Enviar link</button>
      <p className="auth-foot"><Link href="/entrar">Voltar</Link></p>
    </form>
  );
}
