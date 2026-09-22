"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessao } from "../../lib/cliente/sessao";

/** Navegação inferior, só em mobile (§18.3). Esconde-se enquanto um modal está aberto. */
export function BottomNav() {
  const pathname = usePathname() ?? "";
  const s = useSessao();
  const on = (h: string) => pathname === h || pathname.startsWith(h + "/");

  return (
    <nav className="bnav" aria-label="Navegação móvel">
      <Link href="/quadro" className={"bn" + (on("/quadro") ? " on" : "")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
          <rect x="3" y="4" width="5" height="16" rx="1" /><rect x="9.5" y="4" width="5" height="11" rx="1" /><rect x="16" y="4" width="5" height="16" rx="1" />
        </svg>
        <span>Quadro</span>
      </Link>
      <Link href="/documentacao" className={"bn" + (on("/documentacao") ? " on" : "")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" />
        </svg>
        <span>Documentos</span>
      </Link>
      {s.funcao === "staff" ? (
        <Link href="/entidades" className={"bn" + (on("/entidades") ? " on" : "")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 21h18" /><path d="M5 21V6l7-3 7 3v15" /><path d="M9.5 10h1M13.5 10h1M9.5 14h1M13.5 14h1" />
          </svg>
          <span>Entidades</span>
        </Link>
      ) : null}
      <Link href="/definicoes" className={"bn" + (on("/definicoes") ? " on" : "")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8" r="3.4" /><path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
        </svg>
        <span>Perfil</span>
      </Link>
    </nav>
  );
}

export default BottomNav;
