"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const ITEMS: NavItem[] = [
  {
    label: "Quadro",
    href: "/quadro",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 7H9V21H3V7ZM15 3H21V21H15V3ZM9 12H15V21H9V12Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Ações",
    href: "/acoes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7V4M12 7V4M17 7V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Documentação",
    href: "/documentacao",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 3H18C19.1 3 20 3.9 20 5V21L16 18L12 21L8 18L4 21V5C4 3.9 4.9 3 6 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Problemas",
    href: "/problemas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "definições",
    href: "/definicoes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4 21C4 16.58 7.58 13 12 13C16.42 13 20 16.58 20 21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  function active(href: string): boolean {
    if (href === "/quadro") return pathname === "/quadro";
    if (href.startsWith("/definicoes"))
      return pathname?.startsWith("/definicoes") === true;
    return pathname?.startsWith(href) === true;
  }

  return (
    <nav
      aria-label="Navegação móvel"
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 40,
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
        width: "100%",
      }}
    >
      <style>{`
        [data-bottomnav-root] { display: none; }
        @media (max-width: 760px) { [data-bottomnav-root] { display: grid; } }
      `}</style>
      <div
        data-bottomnav-root
        style={{
          gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
          maxWidth: 640,
          marginInline: "auto",
        }}
      >
        {ITEMS.map((item) => {
          const isActive = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                textDecoration: "none",
                padding: "10px 6px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                color: isActive ? "var(--fg)" : "var(--muted)",
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1,
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
