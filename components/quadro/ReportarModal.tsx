"use client";

import { useEffect, useState } from "react";
import type { CartaoQuadro } from "../../app/api/quadro/route";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

interface Anexo { ficheiro: File; url: string }

const MAX = 5;
const MAX_BYTES = 5 * 1024 * 1024;

/** Reportar problema à TheStarter (§11). */
export function ReportarModal({ c, onClose, onFechado }: { c: CartaoQuadro; onClose: () => void; onFechado: () => void }) {
  const toast = useToast();
  const [descricao, setDescricao] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [aEnviar, setAEnviar] = useState(false);
  const fase = Math.min(c.col, 5);

  useEffect(() => () => anexos.forEach((a) => URL.revokeObjectURL(a.url)), [anexos]);

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    const novos: Anexo[] = [];
    for (const f of Array.from(lista)) {
      if (anexos.length + novos.length >= MAX) { toast("Máximo 5 ficheiros"); break; }
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { toast(`${f.name} não é PNG, JPG ou WEBP`); continue; }
      if (f.size > MAX_BYTES) { toast(`${f.name} excede 5 MB`); continue; }
      novos.push({ ficheiro: f, url: URL.createObjectURL(f) });
    }
    setAnexos((a) => [...a, ...novos]);
  }

  async function enviar() {
    if (!descricao.trim()) { toast("Descreve o que aconteceu"); return; }
    setAEnviar(true);
    const fd = new FormData();
    fd.set("descricao", descricao.trim());
    fd.set("flow", String(fase));
    fd.set("acao_ref", c.id);
    fd.set("acao_nome", c.acao.nome);
    for (const a of anexos) fd.append("anexos", a.ficheiro, a.ficheiro.name);
    try {
      const r = await fetch("/api/problemas", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      toast("Reportado. Vamos analisar e avisar-te.");
      onFechado();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Reportar problema" subtitle={`${c.acao.nome} · Flow ${fase}`}>
      <div className="m-sec">
        <p className="confirm">O SIGO muda sem aviso. Reportar aqui permite-nos atualizar a documentação e avisar as outras entidades antes de lhes acontecer o mesmo.</p>
        <div className="fld" style={{ marginTop: 16 }}>
          <label className="fld-l" htmlFor="rep-desc">Em que passo parou</label>
          <textarea id="rep-desc" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex: o campo Regime deixou de existir no formulário de criação da ação" />
        </div>
        <div className="fld">
          <span className="fld-l">Capturas de ecrã</span>
          <label className="drop">
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: "none" }} onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
            <span className="drop-t">Clica para escolher imagens</span>
            <span className="drop-s">PNG, JPG ou WEBP · até 5 ficheiros · máx 5 MB cada</span>
          </label>
          <div>
            {anexos.map((a, i) => (
              <div className="anexo" key={a.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" />
                <span className="anexo-b">
                  <span className="anexo-n">{a.ficheiro.name}</span>
                  <span className="anexo-s">{(a.ficheiro.size / 1024).toFixed(0)} KB</span>
                </span>
                <button type="button" className="anexo-x" aria-label="Remover" onClick={() => setAnexos((l) => l.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
          </div>
        </div>
        <p className="fld-h">Tapa ou corta qualquer dado de formandos antes de enviar. Nomes, NIF e números de documento não devem sair da vossa base de dados.</p>
      </div>
      <div className="m-f">
        <button type="button" className="btn" disabled={aEnviar || !descricao.trim()} onClick={() => void enviar()}>{aEnviar ? "A enviar…" : "Enviar para a TheStarter"}</button>
        <p className="hint">Vai para people@thestarter.io. Respondemos em dias úteis.</p>
        <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
