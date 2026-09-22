"use client";

import { useRouter } from "next/navigation";
import { useSessao } from "../../lib/cliente/sessao";
import { Perfil } from "./Perfil";
import { Equipa } from "./Equipa";
import { NotificacoesTab } from "./NotificacoesTab";
import { Relatorio } from "./Relatorio";
import { Prazos } from "./Prazos";
import { Credenciais } from "./Credenciais";
import { Ligacao } from "./Ligacao";
import { Privacidade } from "./Privacidade";

export const TABS: { k: string; rotulo: string; admin?: boolean }[] = [
  { k: "perfil", rotulo: "Perfil" },
  { k: "equipa", rotulo: "Equipa", admin: true },
  { k: "notif", rotulo: "Notificações" },
  { k: "relat", rotulo: "Relatório semanal" },
  { k: "prazos", rotulo: "Prazos" },
  { k: "vars", rotulo: "Credenciais" },
  { k: "dados", rotulo: "Ligação de dados" },
  { k: "priv", rotulo: "Privacidade" },
];

/** Definições (§17). Cada separador tem o seu Guardar; nada grava ao perder o foco. */
export function Definicoes({ tab }: { tab: string }) {
  const s = useSessao();
  const router = useRouter();
  const admin = s.funcao === "admin" || s.funcao === "staff";
  const visiveis = TABS.filter((t) => !t.admin || admin);
  const atual = visiveis.some((t) => t.k === tab) ? tab : "perfil";

  return (
    <section className="page">
      <div className="ph"><div><h1>Definições</h1></div></div>
      <div className="stabs" role="tablist">
        {visiveis.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={atual === t.k} className={"stab" + (atual === t.k ? " on" : "")} onClick={() => router.replace(`/definicoes?tab=${t.k}`)}>
            {t.rotulo}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {atual === "perfil" ? <Perfil /> : null}
        {atual === "equipa" ? <Equipa /> : null}
        {atual === "notif" ? <NotificacoesTab /> : null}
        {atual === "relat" ? <Relatorio /> : null}
        {atual === "prazos" ? <Prazos /> : null}
        {atual === "vars" ? <Credenciais /> : null}
        {atual === "dados" ? <Ligacao /> : null}
        {atual === "priv" ? <Privacidade /> : null}
      </div>
    </section>
  );
}
