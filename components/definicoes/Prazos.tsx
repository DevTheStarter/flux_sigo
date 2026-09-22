"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import { PRAZOS_DEFAULTS, mergePrazos, type PrazosCfg } from "../../lib/dados/prazos";
import { useToast } from "../ui/Toast";

const LINHAS: [number, string, string][] = [
  [0, "Recolha de dados", "antes do fim"],
  [1, "Perfis de formandos", "antes do fim"],
  [2, "Curso e módulos", "antes do fim"],
  [3, "Criação da ação", "depois do fim"],
  [4, "Inscrição e certificação", "depois do Flow 3"],
  [5, "Conclusão", "depois do Flow 4"],
];
const ENTRADA = [7, 10, 15, 21, 30, 45];
const DIAS = [1, 2, 3, 5, 7, 14, 21, 30];
const AVISO = [1, 2, 3, 5, 7];

export function Prazos() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [cfg, setCfg] = useState<PrazosCfg>(PRAZOS_DEFAULTS);
  const [aGuardar, setAGuardar] = useState(false);
  const podeEditar = s.funcao === "admin" || s.funcao === "staff";

  useEffect(() => {
    (async () => {
      const r = await supabase.from("config_entidade").select("prazos, prazo_entrada_dias, aviso_prazo_dias").eq("entidade_id", s.entidadeId).maybeSingle();
      const d = r.data as { prazos?: Partial<PrazosCfg>; prazo_entrada_dias?: number | null; aviso_prazo_dias?: number | null } | null;
      if (!d) return;
      const m = mergePrazos(d.prazos ?? {});
      if (!d.prazos?.entrada && typeof d.prazo_entrada_dias === "number") m.entrada = d.prazo_entrada_dias;
      if (!d.prazos?.aviso && typeof d.aviso_prazo_dias === "number") m.aviso = d.aviso_prazo_dias;
      setCfg(m);
    })();
  }, [supabase, s.entidadeId]);

  async function guardar() {
    setAGuardar(true);
    const r = await (supabase as any)
      .from("config_entidade")
      .upsert({ entidade_id: s.entidadeId, prazos: cfg, prazo_entrada_dias: cfg.entrada, aviso_prazo_dias: cfg.aviso }, { onConflict: "entidade_id" });
    setAGuardar(false);
    toast(r.error ? "Não foi possível guardar" : "Prazos guardados");
  }

  const set = (k: keyof PrazosCfg, v: number) => setCfg({ ...cfg, [k]: v });
  const opt = (n: number, sufixo: string) => `${n} ${n === 1 ? "dia" : "dias"}${sufixo}`;

  return (
    <div className="sblock">
      <h2>Entrada no quadro</h2>
      <p className="sdesc">Uma ação de formação só aparece no quadro quando se aproxima da data de fim. Antes disso não há nada a fazer e ocuparia espaço. Podem sempre ver as futuras a partir do link no topo da coluna Dados.</p>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Entra no quadro</span><span className="lrow-s">Antes da data de fim da ação de formação</span></span>
        <select className="sel-s" value={cfg.entrada} disabled={!podeEditar} onChange={(e) => set("entrada", Number(e.target.value))} aria-label="Janela de entrada">
          {ENTRADA.map((d) => <option key={d} value={d}>{opt(d, " antes")}</option>)}
        </select>
      </div>
      <p className="fld-h">Quinze dias é o valor recomendado. Dá folga para o Flow 0 perseguir dados em falta antes do prazo do Flow 1, que é um dia antes do fim.</p>

      <h2 style={{ marginTop: 34 }}>Prazos por flow</h2>
      <p className="sdesc">Quando cada flow deve estar feito. Os valores por omissão seguem a documentação do SIGO, mas cada entidade trabalha ao seu ritmo.</p>
      {LINHAS.map(([n, nome, ref]) => (
        <div className="lrow" key={n}>
          <span className="lrow-b"><span className="lrow-t">Flow {n} · {nome}</span><span className="lrow-s">{ref}</span></span>
          <select className="sel-xs" value={cfg[String(n) as keyof PrazosCfg]} disabled={!podeEditar} onChange={(e) => set(String(n) as keyof PrazosCfg, Number(e.target.value))} aria-label={`Prazo do Flow ${n}`}>
            {DIAS.map((d) => <option key={d} value={d}>{opt(d, "")}</option>)}
          </select>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Antecedência do aviso</h2>
      <p className="sdesc">Com quantos dias de antecedência um cartão começa a aparecer como próximo do prazo.</p>
      <div className="lrow">
        <span className="lrow-b"><span className="lrow-t">Avisar antes do prazo</span></span>
        <select className="sel-xs" value={cfg.aviso} disabled={!podeEditar} onChange={(e) => set("aviso", Number(e.target.value))} aria-label="Antecedência do aviso">
          {AVISO.map((d) => <option key={d} value={d}>{opt(d, "")}</option>)}
        </select>
      </div>
      {podeEditar ? (
        <button type="button" className="btn sm" style={{ marginTop: 20 }} disabled={aGuardar} onClick={() => void guardar()}>Guardar</button>
      ) : (
        <p className="fld-h" style={{ marginTop: 16 }}>Só administradores alteram os prazos.</p>
      )}
    </div>
  );
}
