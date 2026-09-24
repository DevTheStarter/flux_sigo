"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

/** Criar entidade (§15): nome, NIPC, fonte, primeiro utilizador. */
export function NovaEntidade({ onClose, onCriada }: { onClose: () => void; onCriada: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [nipc, setNipc] = useState("");
  const [fonte, setFonte] = useState("airtable");
  const [email, setEmail] = useState("");
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    if (nome.trim().length < 2) { setErro("Falta o nome."); return; }
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setErro("Email do primeiro utilizador inválido."); return; }
    setACriar(true);
    try {
      const r = await fetch("/api/admin/entidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), nipc: nipc.trim() || undefined, setup_em: new Date().toISOString().slice(0, 10), fonte_tipo: fonte }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; entidade?: { id: string } };
      if (!r.ok || !j.entidade) throw new Error(j.erro || `Erro ${r.status}`);
      const c = await fetch("/api/admin/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, funcao: "admin", entidade_id: j.entidade.id }),
      });
      const cj = (await c.json().catch(() => ({}))) as { emailEnviado?: boolean };
      if (!c.ok) toast("Entidade criada, mas o convite falhou. Volta a convidar a partir do detalhe.");
      else if (cj.emailEnviado) toast(`${nome.trim()} criada. Convite enviado para ${e}.`);
      else toast(`${nome.trim()} criada. O email do convite não foi enviado: volta a convidar a partir do detalhe para obteres o link.`);
      onCriada();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setACriar(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Adicionar entidade">
      <div className="m-sec">
        <div className="fld"><label className="fld-l" htmlFor="ne-nome">Nome</label><input id="ne-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Escola de Formação, Lda" autoFocus /></div>
        <div className="fld"><label className="fld-l" htmlFor="ne-nipc">NIPC</label><input id="ne-nipc" value={nipc} onChange={(e) => setNipc(e.target.value)} placeholder="500 000 000" /></div>
        <div className="fld"><label className="fld-l" htmlFor="ne-fonte">Fonte de dados</label>
          <select id="ne-fonte" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="airtable">Airtable</option>
            <option value="sheets">Google Sheets</option>
            <option value="notion">Notion</option>
            <option value="outro">Outra</option>
          </select>
        </div>
        <div className="fld"><label className="fld-l" htmlFor="ne-email">Email do primeiro utilizador</label><input id="ne-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="direcao@entidade.pt" /></div>
        <p className="fld-h">A credencial de acesso à fonte é configurada depois, com a entidade, durante o setup.</p>
        {erro ? <p className="err-msg">{erro}</p> : null}
      </div>
      <div className="m-f">
        <button type="button" className="btn" disabled={aCriar} onClick={() => void criar()}>{aCriar ? "A criar…" : "Criar e convidar"}</button>
      </div>
    </Modal>
  );
}
