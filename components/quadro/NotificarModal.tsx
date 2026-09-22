"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartaoQuadro } from "../../app/api/quadro/route";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

interface Colega { id: string; nome: string; email: string }

/** Notificar um colega (§10.2). É um pedido, não uma atribuição. */
export function NotificarModal({ c, onClose, onFechado }: { c: CartaoQuadro; onClose: () => void; onFechado: () => void }) {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [para, setPara] = useState("");
  const [msg, setMsg] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const fase = Math.min(c.col, 5);
  const placeholder = `Podes correr o Flow ${fase} desta ação?`;

  useEffect(() => {
    (async () => {
      const r = await supabase.from("utilizadores").select("id, nome, email").eq("entidade_id", s.entidadeId).neq("id", s.id).order("nome");
      const l = (r.data ?? []) as Colega[];
      setColegas(l);
      if (l[0]) setPara(l[0].id);
    })();
  }, [supabase, s.entidadeId, s.id]);

  async function enviar() {
    const dest = colegas.find((x) => x.id === para);
    if (!dest) { toast("Escolhe um colega"); return; }
    setAEnviar(true);
    const texto = msg.trim() || placeholder;
    const r = await (supabase as any).from("notificacoes").insert({
      entidade_id: s.entidadeId,
      destinatario_id: dest.id,
      remetente_id: s.id,
      tipo: "notificado",
      corpo: `${s.nome || s.email}: "${texto}" — ${c.acao.nome}`,
      acao_ref: c.id,
    });
    setAEnviar(false);
    if (r.error) { toast("Não foi possível enviar"); return; }
    toast(`Notificação enviada a ${dest.nome || dest.email}`);
    onFechado();
  }

  return (
    <Modal open onClose={onClose} title="Notificar" subtitle={c.acao.nome}>
      <div className="m-sec">
        <div className="fld">
          <label className="fld-l" htmlFor="not-para">Para</label>
          {colegas.length ? (
            <select id="not-para" value={para} onChange={(e) => setPara(e.target.value)}>
              {colegas.map((x) => <option key={x.id} value={x.id}>{x.nome || x.email} · {x.email}</option>)}
            </select>
          ) : (
            <p className="fld-h">Ainda não há mais ninguém na vossa equipa. Convida colegas em Definições → Equipa.</p>
          )}
        </div>
        <div className="fld">
          <label className="fld-l" htmlFor="not-msg">Mensagem</label>
          <input id="not-msg" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={placeholder} />
          <p className="fld-h">Recebe notificação na app e por email, conforme as preferências dessa pessoa.</p>
        </div>
      </div>
      <div className="m-f">
        <button type="button" className="btn" disabled={!colegas.length || aEnviar} onClick={() => void enviar()}>Enviar notificação</button>
        <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
