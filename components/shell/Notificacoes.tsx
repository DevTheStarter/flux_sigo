"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useSessao, iniciais } from "../../lib/cliente/sessao";
import { relativo } from "../../lib/cliente/datas";
import { useToast } from "../ui/Toast";

interface Notificacao {
  id: string;
  tipo: string;
  corpo: string;
  lida: boolean;
  criada_em: string;
  remetente: { nome: string | null } | null;
}

const ICONE: Record<string, string> = {
  bloqueio: "!",
  falha_sync: "!",
  problema: "!",
  prazo: "◷",
  concluido: "✓",
  publicacao: "↑",
};

/** Sino com ponto de não lidas e painel das últimas 7 (§10.1). */
export function Notificacoes({ aberto, onToggle }: { aberto: boolean; onToggle: () => void }) {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [lista, setLista] = useState<Notificacao[]>([]);

  const carregar = useCallback(async () => {
    const r = await supabase
      .from("notificacoes")
      .select("id, tipo, corpo, lida, criada_em, remetente:remetente_id(nome)")
      .eq("destinatario_id", s.id)
      .order("criada_em", { ascending: false })
      .limit(7);
    if (!r.error) setLista((r.data ?? []) as unknown as Notificacao[]);
  }, [supabase, s.id]);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 60 * 1000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const naoLidas = lista.some((n) => !n.lida);

  async function marcarLidas() {
    const ids = lista.filter((n) => !n.lida).map((n) => n.id);
    if (!ids.length) return;
    await (supabase as any).from("notificacoes").update({ lida: true }).in("id", ids);
    setLista((l) => l.map((n) => ({ ...n, lida: true })));
    toast("Notificações lidas");
  }

  return (
    <>
      <button className="ico-b" type="button" aria-label="Notificações" aria-expanded={aberto} onClick={onToggle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {naoLidas ? <span className="badge" /> : null}
      </button>
      {aberto ? (
        <div className="dd wide">
          <div className="dd-h">
            <span className="dd-h-t">Notificações</span>
            <button className="dd-h-a" type="button" onClick={marcarLidas}>Marcar lidas</button>
          </div>
          {lista.length === 0 ? (
            <div className="nt-vazio">Sem notificações.</div>
          ) : (
            lista.map((n) => {
              const ini = n.remetente?.nome ? iniciais(n.remetente.nome) : ICONE[n.tipo] ?? "·";
              return (
                <div key={n.id} className={"nt" + (n.lida ? "" : " un")}>
                  <span className={"ava sm" + (n.remetente?.nome ? "" : " gh")}>{ini}</span>
                  <span className="nt-b">
                    <span className="nt-t">{n.corpo}</span>
                    <span className="nt-m">{relativo(n.criada_em)}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}
