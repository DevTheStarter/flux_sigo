"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessao } from "../../lib/cliente/sessao";
import { relativo, diasDesde } from "../../lib/cliente/datas";
import { DetalheEntidade } from "./DetalheEntidade";
import { NovaEntidade } from "./NovaEntidade";

export interface EntidadeLinha {
  id: string;
  nome: string;
  nipc: string | null;
  ativa: boolean;
  suporte: boolean;
  setup_em: string | null;
  contrato_assinado: boolean;
  criada_em: string;
  utilizadores: number;
  ultimaAtividade: string | null;
  fonteTipo: string | null;
  fonteConfigurada: boolean;
  problemasAbertos: number;
  acoes: number | null;
}

const NOME_FONTE: Record<string, string> = { airtable: "Airtable", sheets: "Google Sheets", notion: "Notion", outro: "Outro" };

export function pillSuporte(e: EntidadeLinha): string {
  if (e.suporte) return "suporte";
  const d = diasDesde(e.setup_em);
  if (d !== null && d <= 30) return `setup · ${30 - d}d`;
  return "sem suporte";
}

/** Entidades (§15). Só staff. */
export function Entidades() {
  const s = useSessao();
  const [lista, setLista] = useState<EntidadeLinha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/entidades", { cache: "no-store" });
      const j = (await r.json()) as { entidades?: EntidadeLinha[]; erro?: string };
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      setLista(j.entidades ?? []);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  if (s.funcao !== "staff") {
    return <section className="page"><div className="ph"><div><h1>Entidades</h1></div></div><p className="empty">Esta secção é da TheStarter.</p></section>;
  }

  const ativas = lista.filter((e) => e.ativa);
  const acoesTotal = ativas.reduce<number | null>((acc, e) => (acc === null || e.acoes === null ? null : acc + e.acoes), 0);
  const entidadeAberta = lista.find((e) => e.id === aberta) ?? null;

  return (
    <section className="page">
      <div className="ph"><div><h1>Entidades</h1></div></div>
      <div className="kpi">
        <div><div className="kpi-n">{ativas.length}</div><div className="kpi-l">ativas</div></div>
        <div><div className="kpi-n">{ativas.reduce((a, e) => a + e.utilizadores, 0)}</div><div className="kpi-l">utilizadores</div></div>
        <div><div className="kpi-n">{acoesTotal === null ? "—" : acoesTotal}</div><div className="kpi-l">ações acompanhadas</div></div>
        <div><div className="kpi-n">{ativas.filter((e) => e.suporte).length}</div><div className="kpi-l">com suporte</div></div>
        <div><div className={"kpi-n" + (lista.some((e) => !e.contrato_assinado) ? " red" : "")} style={lista.some((e) => !e.contrato_assinado) ? { color: "var(--red)" } : undefined}>{lista.filter((e) => !e.contrato_assinado).length}</div><div className="kpi-l">sem contrato</div></div>
      </div>
      {erro ? <p className="err-msg">{erro}</p> : null}
      {carregado && !lista.length && !erro ? <p className="empty">Ainda não há entidades.</p> : null}
      {lista.map((e) => {
        const d = diasDesde(e.ultimaAtividade);
        const dot = !e.ativa ? "off" : d === null || d > 14 ? "warn" : "ok";
        return (
          <button type="button" className="ent-row" key={e.id} onClick={() => setAberta(e.id)}>
            <span className={"dot-s " + dot} />
            <span className="ent-b">
              <span className="ent-n">{e.nome}{!e.contrato_assinado ? <span className="pill">sem contrato</span> : null}</span>
              <span className="ent-m">
                {e.utilizadores} utilizador{e.utilizadores === 1 ? "" : "es"} · {e.acoes === null ? "ações —" : `${e.acoes} ações`} · {e.fonteConfigurada ? NOME_FONTE[(e.fonteTipo ?? "airtable").toLowerCase()] ?? e.fonteTipo : "sem ligação"} · {e.ultimaAtividade ? relativo(e.ultimaAtividade) : "sem atividade"}
                {e.problemasAbertos ? ` · ${e.problemasAbertos} problema${e.problemasAbertos > 1 ? "s" : ""} em aberto` : ""}
              </span>
            </span>
            <span className={"pill" + (e.suporte ? " fill" : "")}>{pillSuporte(e)}</span>
            <span className={"pill" + (e.ativa ? " fill" : "")}>{e.ativa ? "ativa" : "inativa"}</span>
          </button>
        );
      })}
      <button type="button" className="btn sec sm" style={{ marginTop: 20 }} onClick={() => setNova(true)}>Adicionar entidade</button>

      {entidadeAberta ? <DetalheEntidade e={entidadeAberta} onClose={() => setAberta(null)} onMudou={carregar} /> : null}
      {nova ? <NovaEntidade onClose={() => setNova(false)} onCriada={() => void carregar()} /> : null}
    </section>
  );
}
