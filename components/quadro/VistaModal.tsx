"use client";

import { useState } from "react";
import type { CartaoQuadro } from "../../app/api/quadro/route";
import { CAMPOS_VISTA, opcoesCampo, ROTULO_ESTADO, type Condicao, type Vista } from "../../lib/cliente/vistas";
import { Modal } from "../ui/Modal";

export function VistaModal({
  vista,
  cartoes,
  onClose,
  onGuardar,
}: {
  vista: Vista | null;
  cartoes: CartaoQuadro[];
  onClose: () => void;
  onGuardar: (nome: string, condicoes: Condicao[], id: string | null) => Promise<void>;
}) {
  const [nome, setNome] = useState(vista?.nome ?? "");
  const [conds, setConds] = useState<Condicao[]>(vista ? vista.condicoes.map((c) => ({ ...c })) : [{ campo: "ano", op: "=", val: opcoesCampo("ano", cartoes)[0] ?? "" }]);
  const [aGuardar, setAGuardar] = useState(false);

  function mudar(i: number, patch: Partial<Condicao>) {
    setConds((cs) => cs.map((c, k) => {
      if (k !== i) return c;
      const n = { ...c, ...patch };
      if (patch.campo && patch.campo !== c.campo) n.val = opcoesCampo(patch.campo, cartoes)[0] ?? "";
      if (patch.op === "em" && c.op !== "em") n.val = c.val;
      return n;
    }));
  }

  async function guardar() {
    setAGuardar(true);
    await onGuardar(nome.trim() || "Vista sem nome", conds.filter((c) => c.val.trim()), vista?.id ?? null);
    setAGuardar(false);
  }

  return (
    <Modal open onClose={onClose} title={vista ? "Editar vista" : "Nova vista"}>
      <div className="m-sec">
        <div className="fld">
          <label className="fld-l" htmlFor="vista-nome">Nome da vista</label>
          <input id="vista-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Cursos de Lisboa" />
        </div>
        <span className="fld-l">Condições</span>
        {conds.length === 0 ? <p className="fld-h" style={{ margin: "0 0 4px" }}>Nenhuma condição. Vai mostrar todas as ações.</p> : null}
        {conds.map((c, i) => {
          const opcoes = opcoesCampo(c.campo, cartoes);
          return (
            <div className="crow" key={i}>
              <select value={c.campo} onChange={(e) => mudar(i, { campo: e.target.value as Condicao["campo"] })} aria-label="Campo">
                {CAMPOS_VISTA.map((f) => <option key={f.k} value={f.k}>{f.rotulo}</option>)}
              </select>
              <select value={c.op} style={{ maxWidth: 74 }} onChange={(e) => mudar(i, { op: e.target.value as Condicao["op"] })} aria-label="Operador">
                <option value="=">=</option>
                <option value="≠">≠</option>
                <option value="em">em</option>
              </select>
              {c.op === "em" ? (
                <input value={c.val} onChange={(e) => mudar(i, { val: e.target.value })} placeholder="valores separados por vírgula" aria-label="Valores" />
              ) : (
                <select value={c.val} onChange={(e) => mudar(i, { val: e.target.value })} aria-label="Valor">
                  {!opcoes.includes(c.val) && c.val ? <option value={c.val}>{c.val}</option> : null}
                  {opcoes.map((o) => <option key={o} value={o}>{c.campo === "estado" ? ROTULO_ESTADO[o] ?? o : o}</option>)}
                </select>
              )}
              <button type="button" className="del" aria-label="Remover condição" onClick={() => setConds((cs) => cs.filter((_, k) => k !== i))}>×</button>
            </div>
          );
        })}
        <button type="button" className="link" style={{ marginTop: 4 }} onClick={() => setConds((cs) => [...cs, { campo: "tipo", op: "=", val: opcoesCampo("tipo", cartoes)[0] ?? "" }])}>
          + Adicionar condição
        </button>
        <p className="fld-h">Uma ação de formação aparece na vista se cumprir todas as condições. Sem condições, aparecem todas. As vistas são partilhadas com a vossa equipa.</p>
      </div>
      <div className="m-f">
        <button type="button" className="btn" disabled={aGuardar} onClick={() => void guardar()}>{vista ? "Guardar alterações" : "Criar vista"}</button>
        <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
