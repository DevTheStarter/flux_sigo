"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useSessao } from "../../lib/cliente/sessao";
import { COLUNAS_CONFIG_VARIAVEIS, GRUPOS_VARIAVEIS, updateDaConfig, VARIAVEIS, variaveisDaConfig } from "../../lib/cliente/variaveis";
import { apagarSegredos, guardarSegredo, lerSegredos, type SegredoLocal } from "../../lib/cliente/segredos";
import { useToast } from "../ui/Toast";
import type { EstadoLigacaoResposta } from "../../app/api/ligacao/route";

/** Credenciais e variáveis (§8, §17). Segredos só neste navegador; nada grava sem Guardar. */
export function Credenciais() {
  const s = useSessao();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [locais, setLocais] = useState<Record<string, string>>({});
  const [aGuardar, setAGuardar] = useState(false);
  const [aTestar, setATestar] = useState(false);
  const podeEditar = s.funcao === "admin" || s.funcao === "staff" || s.funcao === "gestor";

  useEffect(() => {
    setLocais({ ...(lerSegredos() as Record<string, string>) });
    (async () => {
      const r = await supabase.from("config_entidade").select(COLUNAS_CONFIG_VARIAVEIS).eq("entidade_id", s.entidadeId).maybeSingle();
      setValores(variaveisDaConfig((r.data as unknown as Record<string, unknown> | null) ?? null));
    })();
  }, [supabase, s.entidadeId]);

  const faltam = VARIAVEIS.filter((v) => (v.local ? !(locais[v.k] ?? "").trim() : !(valores[v.k] ?? "").trim()));

  async function guardar() {
    setAGuardar(true);
    for (const v of VARIAVEIS) if (v.local) guardarSegredo(v.k as SegredoLocal, (locais[v.k] ?? "").trim());
    if (s.funcao === "admin" || s.funcao === "staff") {
      const r = await (supabase as any).from("config_entidade").upsert({ entidade_id: s.entidadeId, ...updateDaConfig(valores) }, { onConflict: "entidade_id" });
      setAGuardar(false);
      if (r.error) { toast("Não foi possível guardar as variáveis"); return; }
    } else {
      setAGuardar(false);
    }
    toast("Credenciais guardadas");
  }

  async function testar() {
    setATestar(true);
    try {
      const r = await fetch("/api/ligacao?verificar=1", { cache: "no-store" });
      const j = (await r.json()) as EstadoLigacaoResposta;
      if (!j.configurada) toast("Ligação de dados por configurar. Vê o separador Ligação de dados.");
      else if (!j.ok) toast(`Falha na ligação: ${j.erro ?? "sem detalhe"}`);
      else if (faltam.length) toast(`Ligação confirmada · ${faltam.length} ${faltam.length === 1 ? "valor" : "valores"} por preencher`);
      else if (j.aviso) toast(j.aviso);
      else toast("Ligação à base de dados confirmada e todos os valores preenchidos");
    } catch {
      toast("Não foi possível testar a ligação");
    } finally {
      setATestar(false);
    }
  }

  function esquecer() {
    apagarSegredos();
    setLocais({});
    toast("Apagadas deste navegador");
  }

  return (
    <div className="sblock">
      <h2>Credenciais e variáveis</h2>
      <p className="sdesc">Os documentos dos flows não têm valores fixos. Trazem marcadores como <code>{"{{SIGO_UTILIZADOR}}"}</code>, e o Fluxo substitui-os por estes valores no momento em que copiam uma instrução. Assim o mesmo documento serve todas as entidades.</p>
      {faltam.length ? (
        <div className="note">
          <span className="note-t">{faltam.length} valor{faltam.length > 1 ? "es" : ""} por preencher</span>
          <span className="note-s">As instruções que os usam vão sair incompletas até estarem definidos.</span>
        </div>
      ) : null}

      {GRUPOS_VARIAVEIS.map((g) => (
        <div key={g}>
          <h2 style={{ marginTop: 30 }}>{g}</h2>
          {VARIAVEIS.filter((v) => v.grupo === g).map((v) => (
            <div className="lrow" key={v.k}>
              <span className="lrow-b">
                <span className="lrow-t">{v.rotulo}{v.local ? <span className="pill" style={{ marginLeft: 7 }}>só neste navegador</span> : null}</span>
                <span className="lrow-s"><code>{`{{${v.k}}}`}</code>{v.local ? " · nunca é enviada para os nossos servidores" : ""}</span>
              </span>
              <input
                className="inp-s"
                type={v.secreta ? "password" : "text"}
                autoComplete="off"
                value={v.local ? locais[v.k] ?? "" : valores[v.k] ?? ""}
                placeholder={v.secreta ? "••••••••" : "por preencher"}
                disabled={!podeEditar || (!v.local && s.funcao === "gestor")}
                aria-label={v.rotulo}
                onChange={(e) => (v.local ? setLocais({ ...locais, [v.k]: e.target.value }) : setValores({ ...valores, [v.k]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="note neutro" style={{ marginTop: 26 }}>
        <span className="note-t2">Onde ficam estes valores</span>
        <span className="note-s">
          A maioria fica guardada nos nossos servidores, porque a documentação precisa deles em qualquer computador da equipa.<br /><br />
          A <b>palavra-passe do SIGO</b> e o <b>token dos flows</b> são a exceção. Ficam apenas neste navegador e nunca chegam aos nossos servidores: só são usados no momento em que copiam um documento, e isso acontece no vosso computador. Se mudarem de computador ou limparem o navegador, têm de os introduzir outra vez.<br /><br />
          O token dos flows tem permissão de escrita, porque os flows gravam na base de dados. O Fluxo usa um token diferente, só de leitura, que configuram em Ligação de dados. <b>São dois tokens distintos.</b>
        </span>
      </div>
      <div className="row2" style={{ marginTop: 14 }}>
        <button type="button" className="btn sec sm" onClick={esquecer}>Apagar deste navegador</button>
      </div>
      <div className="row2" style={{ marginTop: 18 }}>
        <button type="button" className="btn sm" disabled={aGuardar || !podeEditar} onClick={() => void guardar()}>Guardar</button>
        <button type="button" className="btn sec sm" disabled={aTestar} onClick={() => void testar()}>Testar ligação</button>
      </div>
      <p className="fld-h">Recomendamos renovar o token de acesso à base de dados uma vez por ano, e a palavra-passe do SIGO sempre que alguém sai da equipa.</p>
    </div>
  );
}
