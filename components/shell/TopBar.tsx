"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

export type UserPapel = "staff" | "admin" | "gestor" | "leitura";

export interface TopBarProps {
  entidadeNome?: string;
  userEmail?: string;
  userName?: string;
  papel?: UserPapel;
  /** yyyy-mm-dd hh:mm UTC ou null = sincronizar */
  ultimaSincro?: string | null;
  aSincronizar?: boolean;
  notificacoesNaoLidas?: number;
}

type MenuItem =
  | { kind: "link"; label: string; href: string; requireStaff?: boolean; requireAdmin?: boolean }
  | { kind: "action"; label: string; on: () => void; perigo?: boolean; requireStaff?: boolean; requireAdmin?: boolean }
  | { kind: "separator" };

const MENU: MenuItem[] = [
  { kind: "link", label: "Definições", href: "/definicoes" },
  { kind: "link", label: "Entidades", href: "/entidades", requireStaff: true },
  { kind: "link", label: "Documentação", href: "/documentacao" },
  { kind: "link", label: "Problemas reportados", href: "/problemas" },
  { kind: "separator" },
  { kind: "link", label: "Preferências de notificação", href: "/definicoes?tab=notificacoes" },
  { kind: "link", label: "Gerir utilizadores", href: "/utilizadores", requireAdmin: true },
  { kind: "link", label: "Sessões ativas", href: "/definicoes?tab=sessoes" },
  { kind: "link", label: "Créditos e subscrição", href: "/creditos", requireStaff: true },
  { kind: "separator" },
  {
    kind: "action",
    label: "Terminar sessão",
    on: () => {
      const f = document.createElement("form");
      f.method = "POST";
      f.action = "/api/auth/sair";
      document.body.appendChild(f);
      f.submit();
    },
    perigo: true,
  },
];

const NAV_DSK: { label: string; href: string; requireStaff?: boolean }[] = [
  { label: "quadro", href: "/quadro" },
  { label: "definições", href: "/definicoes" },
  { label: "entidades", href: "/entidades", requireStaff: true },
  { label: "documentação", href: "/documentacao" },
  { label: "problemas", href: "/problemas" },
];

function iniciais(name?: string, email?: string): string {
  const s = (name ?? email ?? "").trim();
  if (!s) return "·";
  const partes = s.split(/[\s@.]+/).filter(Boolean);
  if (partes.length >= 2)
    return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0][0] ?? "·").toUpperCase();
}

function visivel(item: MenuItem, papel?: UserPapel): boolean {
  const staff = papel === "staff";
  const admin = papel === "staff" || papel === "admin";
  if ("requireStaff" in item && item.requireStaff && !staff) return false;
  if ("requireAdmin" in item && item.requireAdmin && !admin) return false;
  return true;
}

export function TopBar(props: TopBarProps) {
  const {
    entidadeNome,
    userEmail,
    userName,
    papel,
    ultimaSincro,
    aSincronizar,
    notificacoesNaoLidas = 0,
  } = props;

  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setMenuAberto(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuAberto]);

  const sincroEstado = aSincronizar
    ? "A sincronizar…"
    : ultimaSincro
    ? `Sincronizado ${ultimaSincro}`
    : "Ainda não sincronizado";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          height: 56,
          padding: "0 16px",
          display: "grid",
          gridTemplateColumns: "auto auto 1fr auto auto",
          alignItems: "center",
          gap: 16,
          maxWidth: 1440,
          marginInline: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/quadro"
            style={{
              textDecoration: "none",
              color: "inherit",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              fontSize: 16,
            }}
          >
            Fluxo
          </Link>
          {papel === "staff" ? (
            <span
              title="Administração da plataforma FLUXO (TheStarter) — gere todas as entidades e utilizadores"
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--panel)",
                color: "var(--fg)",
                border: "1px solid var(--fg)",
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              TheStarter · administração
            </span>
          ) : (
            papel && papel !== "leitura" && (
              <span
                title={`Vista cliente — só podes gerir a entidade atual (${entidadeNome ?? "?"}). Se quiseres gerir empresas, entra com uma conta staff.`}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--panel)",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  fontWeight: 500,
                }}
              >
                {entidadeNome ?? "entidade"} · {papel}
              </span>
            )
          )}
        </div>

        <style>{`
          [data-navdesk] { display: none; }
          @media (min-width: 761px) { [data-navdesk] { display: flex; } }
        `}</style>
        <nav
          data-navdesk
          aria-label="Navegação principal"
          style={{
            alignItems: "center",
            gap: 4,
            marginLeft: 8,
          }}
        >
          {NAV_DSK.filter((n) => !n.requireStaff || papel === "staff").map((n) => {
            const ativa =
              n.href === "/quadro"
                ? pathname === "/quadro"
                : pathname?.startsWith(n.href) === true;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={ativa ? "page" : undefined}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: ativa ? 600 : 500,
                  color: ativa ? "var(--fg)" : "var(--muted)",
                  background: ativa ? "var(--panel)" : "transparent",
                  border: "1px solid " + (ativa ? "var(--border)" : "transparent"),
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {entidadeNome ?? "Sem entidade ligada"}
          </span>
          <span
            title={sincroEstado}
            style={{
              fontSize: 12,
              color: "var(--muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: aSincronizar ? "var(--red)" : "var(--border)",
              }}
            />
            {sincroEstado}
          </span>
        </div>

        <button
          type="button"
          aria-label={`Notificações (${notificacoesNaoLidas} não lidas)`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            color: "var(--fg)",
            position: "relative",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 16H18V12C18 9.79086 16.2091 8 14 8V7C14 5.89543 13.1046 5 12 5C10.8954 5 10 5.89543 10 7V8C7.79086 8 6 9.79086 6 12V16ZM13.73 18.995C13.5508 19.5857 13.0346 20 12.44 20C11.8454 20 11.3292 19.5857 11.15 18.995"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {notificacoesNaoLidas > 0 && (
            <span
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                background: "var(--red)",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {notificacoesNaoLidas > 99 ? "99+" : notificacoesNaoLidas}
            </span>
          )}
        </button>

        <div ref={ref} style={{ position: "relative" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((v) => !v)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--fg)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            {iniciais(userName, userEmail)}
          </button>

          {menuAberto && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 240,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "var(--shadow-dropdown)",
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {(userName || userEmail) && (
                <div style={{ padding: "8px 10px 10px" }}>
                  {userName && (
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{userName}</div>
                  )}
                  {userEmail && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userEmail}
                    </div>
                  )}
                  {papel && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {papel}
                    </div>
                  )}
                </div>
              )}

              {MENU.filter((m) => visivel(m, papel)).map((item, idx) =>
                item.kind === "separator" ? (
                  <div
                    key={`sep-${idx}`}
                    style={{ height: 1, background: "var(--border)", margin: "4px 2px" }}
                  />
                ) : item.kind === "link" ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuAberto(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 4,
                      textDecoration: "none",
                      color: "var(--fg)",
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    role="menuitem"
                    onClick={() => {
                      setMenuAberto(false);
                      item.on();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 4,
                      border: "none",
                      background: "transparent",
                      color: item.perigo ? "var(--red)" : "var(--fg)",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
