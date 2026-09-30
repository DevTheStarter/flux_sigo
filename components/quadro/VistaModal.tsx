"use client";

import { useState } from "react";
import type { CartaoQuadro } from "../../app/api/quadro/route";
import { CAMPOS_VISTA, normalizarCondicoes, opcoesCampo, OPERADORES_VISTA, rotuloValor, type Condicao, type Vista } from "../../lib/cliente/vistas";
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
  const [conds, setConds] = useState<Condicao[]>(
    vista ? vista.condicoes.map((c) => ({ ...c, vals: [...c.vals] })) : [{ campo: "ano", op: "em", vals: opcoesCampo("ano", cartoes).slice(0, 1) }],
  );
  const [aGuardar, setAGuardar] = useState(false);

  function mudar(i: number, patch: Partial<Condicao>) {
    setConds((cs) => cs.map((c, k) => {
      if (k !== i) return c;
      const n = { ...c, ...patch };
      if (patch.campo && patch.campo !== c.campo) n.vals = [];
      return n;
    }));
  }

  function alternar(i: number, v: string, ligado: boolean) {
    setConds((cs) => cs.map((c, k) => {
      if (k !== i) return c;
      const vals = ligado ? (c.vals.includes(v) ? c.vals : [...c.vals, v]) : c.vals.filter((x) => x !== v);
      return { ...c, vals };
    }));
  }

  async function guardar() {
    setAGuardar(true);
    await onGuardar(nome.trim() || "Vista sem nome", normalizarCondicoes(conds), vista?.id ?? null);
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
          // Valores guardados que já não existem nos cartões continuam visíveis para poderem ser retirados.
          const extra = c.vals.filter((v) => !opcoes.includes(v));
          const todas = [...opcoes, ...extra];
          return (
            <div className="cbloco" key={i}>
              <div className="crow">
                <select value={c.campo} onChange={(e) => mudar(i, { campo: e.target.value as Condicao["campo"] })} aria-label="Campo">
                  {CAMPOS_VISTA.map((f) => <option key={f.k} value={f.k}>{f.rotulo}</option>)}
                </select>
                <select value={c.op} style={{ maxWidth: 92 }} onChange={(e) => mudar(i, { op: e.target.value as Condicao["op"] })} aria-label="Operador">
                  {OPERADORES_VISTA.map((o) => <option key={o.k} value={o.k}>{o.rotulo}</option>)}
                </select>
                <button type="button" className="del" aria-label="Remover condição" onClick={() => setConds((cs) => cs.filter((_, k) => k !== i))}>×</button>
              </div>
              {todas.length === 0 ? (
                <p className="fld-h" style={{ margin: "0 0 10px" }}>Sem valores para este campo nas ações carregadas.</p>
              ) : (
                <div className="cvals" role="group" aria-label="Valores">
                  {todas.map((v) => {
                    const on = c.vals.includes(v);
                    return (
                      <label key={v} className={"cval" + (on ? " on" : "")}>
                        <input type="checkbox" checked={on} onChange={(e) => alternar(i, v, e.target.checked)} />
                        {rotuloValor(c.campo, v)}
                      </label>
                    );
                  })}
                </div>
              )}
              {c.vals.length === 0 ? <p className="fld-h" style={{ margin: "-4px 0 10px" }}>Escolhe pelo menos um valor. Sem valores, esta condição é ignorada.</p> : null}
            </div>
          );
        })}
        <button type="button" className="link" style={{ marginTop: 4 }} onClick={() => setConds((cs) => [...cs, { campo: "tipo", op: "em", vals: [] }])}>
          + Adicionar condição
        </button>
        <p className="fld-h">
          Cada condição pode ter vários valores: basta um deles bater certo. Uma ação de formação aparece na vista se cumprir todas as condições.
          Sem condições, aparecem todas. As vistas são partilhadas com a vossa equipa.
        </p>
      </div>
      <div className="m-f">
        <button type="button" className="btn" disabled={aGuardar} onClick={() => void guardar()}>{vista ? "Guardar alterações" : "Criar vista"}</button>
        <button type="button" className="btn sec" style={{ marginTop: 8 }} onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
