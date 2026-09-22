"use client";

import { SessaoProvider, type Sessao } from "../../lib/cliente/sessao";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

export function AppShell({ sessao, children }: { sessao: Sessao; children: React.ReactNode }) {
  return (
    <SessaoProvider sessao={sessao}>
      <TopBar />
      <div className="wrap">{children}</div>
      <div className="foot">Fluxo · {sessao.entidadeNome}</div>
      <BottomNav />
    </SessaoProvider>
  );
}
