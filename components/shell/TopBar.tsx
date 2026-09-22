"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { iniciais, useSessao } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { useToast } from "../ui/Toast";
import { Notificacoes } from "./Notificacoes";
import type { EstadoLigacaoResposta } from "../../app/api/ligacao/route";

const MENU: { rotulo: string; tab: string }[] = [
  { rotulo: "Perfil", tab: "perfil" },
  { rotulo: "Equipa", tab: "equipa" },
  { rotulo: "Notificações", tab: "notif" },
  { rotulo: "Relatório semanal", tab: "relat" },
  { rotulo: "Prazos", tab: "prazos" },
  { rotulo: "Ligação de dados", tab: "dados" },
];

function mudarTema() {
  const atual = document.documentElement.getAttribute("data-theme");
  const escuroSistema = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const agora = atual ?? (escuroSistema ? "dark" : "light");
  const novo = agora === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  try {
    localStorage.setItem("fluxo-tema", novo);
  } catch {
    /* ignorar */
  }
}

function terminarSessao() {
  const f = document.createElement("form");
  f.method = "POST";
  f.action = "/api/auth/sair";
  document.body.appendChild(f);
  f.submit();
}

export function TopBar() {
  const s = useSessao();
  const pathname = usePathname() ?? "";
  const toast = useToast();
  const [aberto, setAberto] = useState<"conta" | "notif" | null>(null);
  const [ligacao, setLigacao] = useState<EstadoLigacaoResposta | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const ref = useRef<HTMLDivElement | null>(null);
  const staff = s.funcao === "staff";

  const lerLigacao = useCallback(async (verificar = false) => {
    try {
      const r = await fetch(`/api/ligacao${verificar ? "?verificar=1" : ""}`, { cache: "no-store" });
      if (r.ok) setLigacao((await r.json()) as EstadoLigacaoResposta);
    } catch {
      /* mantém o último estado */
    }
  }, []);

  useEffect(() => {
    void lerLigacao();
    const t = setInterval(() => { setAgora(new Date()); void lerLigacao(); }, 5 * 60 * 1000);
    const tick = setInterval(() => setAgora(new Date()), 30 * 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [lerLigacao]);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(null);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const ativo = (h: string) => pathname === h || pathname.startsWith(h + "/");

  let syncTexto = "Sem ligação de dados";
  let syncTip = "Configura a ligação à base de dados em Definições → Ligação de dados.";
  let syncErro = false;
  if (ligacao?.configurada) {
    if (ligacao.ok) {
      syncTexto = ligacao.ultimaLeitura ? `Sincronizado ${relativo(ligacao.ultimaLeitura, agora)}` : "Sincronizado";
      syncTip = "O quadro lê a base de dados a cada 15 minutos. A próxima leitura acontece quando alguém abrir o quadro depois disso.";
    } else {
      syncErro = true;
      syncTexto = "Falha na sincronização";
      syncTip = `A última leitura falhou${ligacao.erro ? `: ${ligacao.erro}` : "."} Novas tentativas a cada 15 minutos, ou repete agora.`;
    }
  }

  return (
    <header className="hdr">
      <div className="hl">
        <Link href="/quadro" className="logo">
          Fluxo
          {staff ? <span className="tag-st">TheStarter</span> : null}
        </Link>
        <nav className="nav" aria-label="Navegação principal">
          <Link href="/quadro" className={ativo("/quadro") ? "on" : ""}>Quadro</Link>
          <Link href="/documentacao" className={ativo("/documentacao") ? "on" : ""}>Documentação</Link>
          {staff ? <Link href="/entidades" className={ativo("/entidades") ? "on" : ""}>Entidades</Link> : null}
        </nav>
      </div>
      <div className="hr" ref={ref}>
        <div className={"sync" + (syncErro ? " err" : "")}>
          <span className="sync-d" />
          <span>{syncTexto}</span>
          {syncErro ? (
            <button
              className="sretry"
              type="button"
              onClick={async () => {
                await fetch("/api/ligacao/sincronizar", { method: "POST" });
                await lerLigacao(true);
                toast("A repetir a leitura");
              }}
            >
              repetir
            </button>
          ) : null}
          <span className="tip">{syncTip}</span>
        </div>
        <span className="org">{s.entidadeNome}</span>
        <Notificacoes aberto={aberto === "notif"} onToggle={() => setAberto(aberto === "notif" ? null : "notif")} />
        <button
          className="ico-b ico-conta"
          type="button"
          aria-label="Conta"
          aria-haspopup="menu"
          aria-expanded={aberto === "conta"}
          onClick={() => setAberto(aberto === "conta" ? null : "conta")}
          style={{ padding: 0 }}
        >
          <span className="ava">{iniciais(s.nome, s.email)}</span>
        </button>

        {aberto === "conta" ? (
          <div className="dd" role="menu">
            <div className="dd-u">
              <div className="dd-n">{s.nome || s.email}</div>
              <div className="dd-e">{s.email}</div>
            </div>
            {MENU.filter((m) => m.tab !== "equipa" || s.funcao === "admin" || staff).map((m) => (
              <Link key={m.tab} href={`/definicoes?tab=${m.tab}`} className="dd-i" role="menuitem" onClick={() => setAberto(null)}>
                {m.rotulo}
              </Link>
            ))}
            <div className="dd-sep" />
            <button className="dd-i" role="menuitem" type="button" onClick={() => { mudarTema(); setAberto(null); }}>
              Mudar tema
            </button>
            <button className="dd-i" role="menuitem" type="button" onClick={terminarSessao}>
              Terminar sessão
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default TopBar;
