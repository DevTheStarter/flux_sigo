"use client";

import { createContext, useContext } from "react";

export type Funcao = "staff" | "admin" | "gestor" | "leitura";

export interface Sessao {
  id: string;
  nome: string;
  email: string;
  funcao: Funcao;
  entidadeId: string;
  entidadeNome: string;
  /** plano de suporte mensal */
  suporte: boolean;
  setupEm: string | null;
}

const Ctx = createContext<Sessao | null>(null);

export function SessaoProvider({ sessao, children }: { sessao: Sessao; children: React.ReactNode }) {
  return <Ctx.Provider value={sessao}>{children}</Ctx.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSessao fora do SessaoProvider");
  return s;
}

/** §14: suporte incluído nos 30 dias após o setup. */
export function dentroDos30(setupEm: string | null): boolean {
  if (!setupEm) return false;
  const t = new Date(setupEm).getTime();
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) / 86400000 <= 30;
}

export function recebeAtualizacoes(s: { suporte: boolean; setupEm: string | null }): boolean {
  return s.suporte || dentroDos30(s.setupEm);
}

export function podeReportar(s: Sessao): boolean {
  return s.funcao === "staff" || recebeAtualizacoes(s);
}

export function iniciais(nome: string | null | undefined, email?: string | null): string {
  const s = (nome && nome.trim()) || (email ?? "").split("@")[0] || "";
  const partes = s.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  const out = partes.map((p) => p[0]).join("").toUpperCase();
  return out || "·";
}

export const ROTULO_FUNCAO: Record<Funcao, string> = {
  staff: "TheStarter",
  admin: "Administrador",
  gestor: "Gestor de formação",
  leitura: "Só leitura",
};
