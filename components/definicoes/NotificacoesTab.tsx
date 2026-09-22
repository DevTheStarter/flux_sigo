"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import { Toggle } from "../ui/Toggle";
import { useToast } from "../ui/Toast";

const EVENTOS: [string, string][] = [
  ["notificado", "Quando um colega me notifica"],
  ["prazo", "Quando uma ação de formação passa o prazo"],
  ["bloqueio", "Quando uma ação de formação fica bloqueada"],
  ["concluido", "Quando alguém conclui um flow"],
  ["falha_sync", "Quando a sincronização com a base de dados falha"],
];
const CANAIS: [string, string][] = [["app", "Dentro da aplicação"], ["email", "Por email"]];
const DEF_EVENTOS: Record<string, boolean> = { notificado: true, prazo: true, bloqueio: true, concluido: false, falha_sync: true };
const DEF_CANAIS: Record<string, boolean> = { app: true, email: true };

export function NotificacoesTab() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [eventos, setEventos] = useState(DEF_EVENTOS);
  const [canais, setCanais] = useState(DEF_CANAIS);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await supabase.from("preferencias_notificacao").select("eventos, canais").eq("utilizador_id", s.id).maybeSingle();
      const d = r.data as { eventos?: Record<string, boolean>; canais?: Record<string, boolean> } | null;
      if (d?.eventos) setEventos({ ...DEF_EVENTOS, ...d.eventos });
      if (d?.canais) setCanais({ ...DEF_CANAIS, ...d.canais });
    })();
  }, [supabase, s.id]);

  async function guardar() {
    setAGuardar(true);
    const r = await (supabase as any).from("preferencias_notificacao").upsert({ utilizador_id: s.id, eventos, canais }, { onConflict: "utilizador_id" });
    setAGuardar(false);
    toast(r.error ? "Não foi possível guardar" : "Preferências guardadas");
  }

  return (
    <div className="sblock">
      <h2>Notificações</h2>
      <p className="sdesc">O que te avisa, e por onde. Cada pessoa define as suas.</p>
      {EVENTOS.map(([k, l]) => (
        <div className="lrow" key={k}>
          <span className="lrow-b"><span className="lrow-t">{l}</span></span>
          <Toggle on={!!eventos[k]} label={l} onChange={(v) => setEventos({ ...eventos, [k]: v })} />
        </div>
      ))}
      <h2 style={{ marginTop: 32 }}>Canais</h2>
      <p className="sdesc">Onde queres receber estes avisos.</p>
      {CANAIS.map(([k, l]) => (
        <div className="lrow" key={k}>
          <span className="lrow-b"><span className="lrow-t">{l}</span></span>
          <Toggle on={!!canais[k]} label={l} onChange={(v) => setCanais({ ...canais, [k]: v })} />
        </div>
      ))}
      <button type="button" className="btn sm" style={{ marginTop: 20 }} disabled={aGuardar} onClick={() => void guardar()}>Guardar</button>
    </div>
  );
}
