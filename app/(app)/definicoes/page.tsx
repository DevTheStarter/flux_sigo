"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, Tab, TabPanel } from "../../../components/ui/Tabs";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Pill } from "../../../components/ui/Pill";
import { createClient } from "../../../lib/supabase/client";

const TABS = [
  { value: "perfil", label: "Perfil" },
  { value: "equipa", label: "Equipa" },
  { value: "notif", label: "Notificações" },
  { value: "relat", label: "Relatório semanal" },
  { value: "prazos", label: "Prazos" },
  { value: "vars", label: "Credenciais" },
  { value: "dados", label: "Ligação de dados" },
  { value: "priv", label: "Privacidade" },
];

const NOTIF_ITEMS = [
  { k: "atrib", l: "Quando um colega me notifica" },
  { k: "prazo", l: "Quando uma ação passa o prazo" },
  { k: "bloq", l: "Quando uma ação fica bloqueada" },
  { k: "concl", l: "Quando alguém conclui um flow" },
  { k: "falha", l: "Quando a sincronização com o Airtable falha" },
];

const CANAIS = [
  { k: "app", l: "Dentro da aplicação" },
  { k: "email", l: "Por email" },
];

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const HORAS = ["07:00", "08:00", "09:00", "10:00", "11:00", "15:00", "17:00", "18:00"];
const DIAS_ENTRADA = [7, 10, 15, 21, 30, 45];
const DIAS_PRAZO = [1, 2, 3, 5, 7, 14, 21, 30];
const DIAS_AVISO = [1, 2, 3, 5, 7];

const PRAZOS_LINHAS = [
  { n: 0, nome: "Recolha de dados", ref: "antes do fim" },
  { n: 1, nome: "Perfis de formandos", ref: "antes do fim" },
  { n: 2, nome: "Curso e módulos", ref: "antes do fim" },
  { n: 3, nome: "Criação da ação", ref: "depois do fim" },
  { n: 4, nome: "Inscrição e certificação", ref: "depois do Flow 3" },
  { n: 5, nome: "Conclusão", ref: "depois do Flow 4" },
];

const VARS_DEFS = [
  { k: "SIGO_URL", r: "URL de login do SIGO", g: "SIGO", local: false, secret: false },
  { k: "SIGO_UTILIZADOR", r: "Utilizador do SIGO", g: "SIGO", local: false, secret: false },
  { k: "SIGO_PALAVRA", r: "Palavra-passe do SIGO", g: "SIGO", local: true, secret: true },
  { k: "CRM_TIPO", r: "Sistema de dados", g: "Base de dados", local: false, secret: false },
  { k: "CRM_BASE", r: "Identificador da base", g: "Base de dados", local: false, secret: false },
  { k: "CRM_TOKEN", r: "Token dos flows (leitura e escrita)", g: "Base de dados", local: true, secret: true },
  { k: "TBL_ACOES", r: "Tabela de ações de formação", g: "Base de dados", local: false, secret: false },
  { k: "TBL_FORMANDOS", r: "Tabela de formandos", g: "Base de dados", local: false, secret: false },
  { k: "TBL_LOGS", r: "Tabela de registos", g: "Base de dados", local: false, secret: false },
  { k: "AREA_FORMACAO", r: "Área de formação", g: "Regras fixas", local: false, secret: false },
  { k: "REGIME", r: "Regime", g: "Regras fixas", local: false, secret: false },
];

const VAR_LOCAL_KEYS = new Set(VARS_DEFS.filter((v) => v.local).map((v) => v.k));

const LS_PREFIX = "fluxo.vars.v1.";

function lerLocalVars(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  try {
    for (const k of VAR_LOCAL_KEYS) {
      try {
        const val = window.localStorage.getItem(LS_PREFIX + k);
        if (typeof val === "string") out[k] = val;
      } catch {
        /* storage blocked */
      }
    }
  } catch {
    /* localStorage unavailable */
  }
  return out;
}

function escreverLocalVar(k: string, v: string) {
  if (typeof window === "undefined") return;
  if (!VAR_LOCAL_KEYS.has(k)) return;
  try {
    if (v.trim().length === 0) {
      window.localStorage.removeItem(LS_PREFIX + k);
    } else {
      window.localStorage.setItem(LS_PREFIX + k, v);
    }
  } catch {
    /* storage blocked */
  }
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "0.5px solid var(--ls)",
        position: "relative",
        flexShrink: 0,
        transition: "0.15s",
        background: on ? "var(--fg)" : "transparent",
        borderColor: on ? "var(--fg)" : "var(--ls)",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <i
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: on ? "var(--bg)" : "var(--ls)",
          transition: "0.15s",
          display: "block",
        }}
      />
    </button>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        color: "var(--muted)",
        textTransform: "uppercase",
        marginBottom: 6,
        display: "block",
        ...style,
      }}
    >
      {children}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.55 }}>{children}</p>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 38, maxWidth: 720 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.2px", marginBottom: 5 }}>{title}</h2>
      {desc && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>{desc}</p>
      )}
      {children}
    </div>
  );
}

function ListRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 0",
        borderBottom: "0.5px solid var(--line)",
      }}
    >
      {children}
    </div>
  );
}

function ListRowBody({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500, display: "block" }}>{title}</div>
      {subtitle !== undefined && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, display: "block" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Avatar({ inicial, size = "sm" }: { inicial: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? 22 : 28;
  const fsize = size === "sm" ? 9 : 10.5;
  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: "50%",
        background: "var(--fg)",
        color: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fsize,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {inicial}
    </div>
  );
}

function iniciaisDe(nome?: string | null, email?: string | null): string {
  const s = (nome ?? email ?? "").trim();
  if (!s) return "·";
  const partes = s.split(/[\s@.]+/).filter(Boolean);
  if (partes.length >= 2)
    return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0][0] ?? "·").toUpperCase();
}

function Note({
  tone = "danger",
  title,
  children,
}: {
  tone?: "danger" | "neutral" | "ok";
  title: string;
  children: React.ReactNode;
}) {
  const cores =
    tone === "danger"
      ? {
          border: "0.5px solid var(--red-b)",
          borderLeft: "2px solid var(--red)",
          background: "var(--red-s)",
          titleColor: "var(--red)",
        }
      : tone === "ok"
      ? {
          border: "0.5px solid var(--ls)",
          borderLeft: "2px solid #2f7d4b",
          background: "var(--hover)",
          titleColor: "#2f7d4b",
        }
      : {
          border: "0.5px solid var(--ls)",
          borderLeft: "2px solid var(--fg)",
          background: "var(--hover)",
          titleColor: "var(--fg)",
        };
  return (
    <div
      style={{
        borderRadius: 6,
        padding: "11px 13px",
        marginBottom: 12,
        ...cores,
      }}
    >
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: cores.titleColor }}>
        {title}
      </span>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--soft)", lineHeight: 1.6 }}>
        {children}
      </span>
    </div>
  );
}

type MeuUser = {
  id: string;
  funcao: "staff" | "admin" | "gestor" | "leitura";
  nome: string | null;
  email: string | null;
  entidade_id: string | null;
  entidade_nome: string | null;
};

type EquipaMembro = {
  id: string;
  nome: string | null;
  email: string | null;
  funcao: "staff" | "admin" | "gestor" | "leitura";
  ultimo_acesso: string | null;
};

type ConfigEntidade = {
  fonte_tipo: string | null;
  fonte_base: string | null;
  fonte_tabela_acoes: string | null;
  fonte_tabela_formandos: string | null;
  fonte_tabela_registos: string | null;
  prazos: Record<string, number> | null;
  prazo_entrada_dias: number | null;
  aviso_prazo_dias: number | null;
  area_formacao_default: string | null;
  regime_default: string | null;
  sigo_url: string | null;
  sigo_utilizador: string | null;
};

type ConfigRelatorio = {
  ativo: boolean;
  dia_semana: string | null;
  hora: string | null;
  destinatarios: string[];
};

type PreferenciasNotif = {
  eventos: Record<string, boolean>;
  canais: Record<string, boolean>;
};

const PRAZOS_DEFAULTS: Record<number, number> = { 0: 15, 1: 3, 2: 3, 3: 1, 4: 1, 5: 21 };
const DEFAULTS_PREFERENCIAS: PreferenciasNotif = {
  eventos: { atrib: true, prazo: true, bloq: true, concl: false, falha: true },
  canais: { app: true, email: true },
};
const DEFAULTS_RELATORIO: ConfigRelatorio = {
  ativo: true,
  dia_semana: "Segunda",
  hora: "09:00",
  destinatarios: [],
};

export default function DefinicoesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState(TABS[0].value);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [me, setMe] = useState<MeuUser | null>(null);
  const [equipa, setEquipa] = useState<EquipaMembro[]>([]);
  const [novoEmail, setNovoEmail] = useState("");

  const [perfil, setPerfil] = useState({ nome: "", email: "", entidade: "" });

  const [notif, setNotif] = useState<Record<string, boolean>>(DEFAULTS_PREFERENCIAS.eventos);
  const [canal, setCanal] = useState<Record<string, boolean>>(DEFAULTS_PREFERENCIAS.canais);

  const [relat, setRelat] = useState<ConfigRelatorio>(DEFAULTS_RELATORIO);
  const [novoDestEmail, setNovoDestEmail] = useState("");

  const [prazos, setPrazos] = useState<Record<number, number>>(PRAZOS_DEFAULTS);
  const [entrada, setEntrada] = useState<number>(15);
  const [aviso, setAviso] = useState<number>(3);

  const [varsArr, setVarsArr] = useState(() => {
    const locais = lerLocalVars();
    return VARS_DEFS.map((v) => ({
      ...v,
      v: locais[v.k] ?? "",
    }));
  });

  const [cfgEnt, setCfgEnt] = useState<ConfigEntidade>({
    fonte_tipo: null,
    fonte_base: null,
    fonte_tabela_acoes: null,
    fonte_tabela_formandos: null,
    fonte_tabela_registos: null,
    prazos: null,
    prazo_entrada_dias: null,
    aviso_prazo_dias: null,
    area_formacao_default: null,
    regime_default: null,
    sigo_url: null,
    sigo_utilizador: null,
  });

  const inicial = useMemo(() => {
    return {
      perfil: { ...perfil },
      notif: { ...notif },
      canal: { ...canal },
      relat: {
        ...relat,
        destinatarios: [...relat.destinatarios],
      },
      prazos: { ...prazos },
      entrada,
      aviso,
      varsArr: varsArr.map((v) => ({ ...v })),
    };
    // guarda só após carregamento inicial para não comparar defaults vazios
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aCarregar]);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErroCarregar(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Sem sessão ativa");

      const [userRes, cfgRes, prefRes, relatRes] = await Promise.allSettled([
        supabase
          .from("utilizadores")
          .select(
            "id, funcao, nome, email, entidade_id, entidades:entidade_id(nome)",
          )
          .eq("id", user.id)
          .single(),
        supabase
          .from("config_entidade")
          .select(
            "fonte_tipo, fonte_base, fonte_tabela_acoes, fonte_tabela_formandos, fonte_tabela_registos, prazos, prazo_entrada_dias, aviso_prazo_dias, area_formacao_default, regime_default, sigo_url, sigo_utilizador",
          )
          .limit(1)
          .maybeSingle(),
        supabase
          .from("preferencias_notificacao")
          .select("eventos, canais")
          .eq("utilizador_id", user.id)
          .maybeSingle(),
        supabase
          .from("config_relatorio")
          .select("ativo, dia_semana, hora, destinatarios")
          .limit(1)
          .maybeSingle(),
      ]);

      let meu: MeuUser | null = null;
      if (userRes.status === "fulfilled" && (userRes.value as any).data) {
        const d = (userRes.value as any).data as any;
        meu = {
          id: d.id,
          funcao: d.funcao,
          nome: d.nome,
          email: d.email,
          entidade_id: d.entidade_id,
          entidade_nome: d.entidades?.nome ?? null,
        };
        setMe(meu);
        setPerfil({
          nome: d.nome ?? "",
          email: d.email ?? "",
          entidade: d.entidades?.nome ?? "",
        });
      }

      if (meu?.entidade_id) {
        try {
          const eq = await supabase
            .from("utilizadores")
            .select("id, nome, email, funcao, ultimo_acesso")
            .eq("entidade_id", meu.entidade_id)
            .order("criado_em", { ascending: true });
          if (!((eq as any).error)) {
            setEquipa(((eq as any).data ?? []) as EquipaMembro[]);
          }
        } catch {
          /* ignore */
        }
      }

      if (cfgRes.status === "fulfilled" && (cfgRes.value as any).data) {
        const c = (cfgRes.value as any).data as Partial<ConfigEntidade>;
        setCfgEnt({
          fonte_tipo: c.fonte_tipo ?? null,
          fonte_base: c.fonte_base ?? null,
          fonte_tabela_acoes: c.fonte_tabela_acoes ?? null,
          fonte_tabela_formandos: c.fonte_tabela_formandos ?? null,
          fonte_tabela_registos: c.fonte_tabela_registos ?? null,
          prazos: c.prazos ?? null,
          prazo_entrada_dias: c.prazo_entrada_dias ?? null,
          aviso_prazo_dias: c.aviso_prazo_dias ?? null,
          area_formacao_default: c.area_formacao_default ?? null,
          regime_default: c.regime_default ?? null,
          sigo_url: c.sigo_url ?? null,
          sigo_utilizador: c.sigo_utilizador ?? null,
        });
        if (c.prazos && typeof c.prazos === "object") {
          const merged = { ...PRAZOS_DEFAULTS, ...(c.prazos as Record<number, number>) };
          setPrazos(merged);
        }
        if (typeof c.prazo_entrada_dias === "number") setEntrada(c.prazo_entrada_dias);
        if (typeof c.aviso_prazo_dias === "number") setAviso(c.aviso_prazo_dias);

        // preencher varsArr (as não-locais vêm do server; locais vêm do localStorage)
        const locais = lerLocalVars();
        setVarsArr(
          VARS_DEFS.map((v) => {
            let val = locais[v.k] ?? "";
            if (!v.local) {
              switch (v.k) {
                case "SIGO_URL":
                  val = c.sigo_url ?? "";
                  break;
                case "SIGO_UTILIZADOR":
                  val = c.sigo_utilizador ?? "";
                  break;
                case "CRM_TIPO":
                  val = c.fonte_tipo ?? "";
                  break;
                case "CRM_BASE":
                  val = c.fonte_base ?? "";
                  break;
                case "TBL_ACOES":
                  val = c.fonte_tabela_acoes ?? "";
                  break;
                case "TBL_FORMANDOS":
                  val = c.fonte_tabela_formandos ?? "";
                  break;
                case "TBL_LOGS":
                  val = c.fonte_tabela_registos ?? "";
                  break;
                case "AREA_FORMACAO":
                  val = c.area_formacao_default ?? "";
                  break;
                case "REGIME":
                  val = c.regime_default ?? "";
                  break;
              }
            }
            return { ...v, v: val };
          }),
        );
      }

      if (prefRes.status === "fulfilled" && (prefRes.value as any).data) {
        const p = (prefRes.value as any).data;
        if (p.eventos && typeof p.eventos === "object")
          setNotif({ ...DEFAULTS_PREFERENCIAS.eventos, ...(p.eventos as Record<string, boolean>) });
        if (p.canais && typeof p.canais === "object")
          setCanal({ ...DEFAULTS_PREFERENCIAS.canais, ...(p.canais as Record<string, boolean>) });
      }

      if (relatRes.status === "fulfilled" && (relatRes.value as any).data) {
        const r = (relatRes.value as any).data;
        setRelat({
          ativo: typeof r.ativo === "boolean" ? r.ativo : true,
          dia_semana: r.dia_semana ?? "Segunda",
          hora: r.hora ?? "09:00",
          destinatarios: Array.isArray(r.destinatarios) ? r.destinatarios : [],
        });
      }
    } catch (e: any) {
      setErroCarregar(e?.message ?? String(e));
    } finally {
      setACarregar(false);
    }
  }, [supabase]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function onGuardar() {
    setSaving(true);
    setSavedAt(null);
    try {
      const entidadeId = me?.entidade_id;
      if (entidadeId) {
        const locaisAtualizar: Record<string, string> = {};
        for (const v of varsArr) {
          if (v.local) {
            locaisAtualizar[v.k] = v.v;
            escreverLocalVar(v.k, v.v);
          }
        }

        const entUpdate: Record<string, unknown> = {};
        const nonLocalVars = varsArr.filter((v) => !v.local);
        for (const v of nonLocalVars) {
          const val = v.v.trim().length > 0 ? v.v.trim() : null;
          switch (v.k) {
            case "SIGO_URL":
              entUpdate.sigo_url = val;
              break;
            case "SIGO_UTILIZADOR":
              entUpdate.sigo_utilizador = val;
              break;
            case "CRM_TIPO":
              entUpdate.fonte_tipo = val;
              break;
            case "CRM_BASE":
              entUpdate.fonte_base = val;
              break;
            case "TBL_ACOES":
              entUpdate.fonte_tabela_acoes = val;
              break;
            case "TBL_FORMANDOS":
              entUpdate.fonte_tabela_formandos = val;
              break;
            case "TBL_LOGS":
              entUpdate.fonte_tabela_registos = val;
              break;
            case "AREA_FORMACAO":
              entUpdate.area_formacao_default = val;
              break;
            case "REGIME":
              entUpdate.regime_default = val;
              break;
          }
        }
        entUpdate.prazos = prazos;
        entUpdate.prazo_entrada_dias = entrada;
        entUpdate.aviso_prazo_dias = aviso;

        const temCfgEnt = await (async () => {
          try {
            const r = await supabase
              .from("config_entidade")
              .select("entidade_id")
              .eq("entidade_id", entidadeId)
              .maybeSingle();
            return !!(r as any).data;
          } catch {
            return false;
          }
        })();

        if (temCfgEnt) {
          await (supabase as any)
            .from("config_entidade")
            .update(entUpdate)
            .eq("entidade_id", entidadeId);
        } else {
          await (supabase as any).from("config_entidade").insert([
            { entidade_id: entidadeId, ...entUpdate },
          ]);
        }

        // preferencias_notificacao (próprio user)
        const prefRow: Record<string, unknown> = {
          utilizador_id: me!.id,
          eventos: notif,
          canais: canal,
        };
        const temPref = await (async () => {
          try {
            const r = await supabase
              .from("preferencias_notificacao")
              .select("utilizador_id")
              .eq("utilizador_id", me!.id)
              .maybeSingle();
            return !!(r as any).data;
          } catch {
            return false;
          }
        })();
        if (temPref) {
          await (supabase as any)
            .from("preferencias_notificacao")
            .update({ eventos: notif, canais: canal })
            .eq("utilizador_id", me!.id);
        } else {
          await (supabase as any).from("preferencias_notificacao").insert([prefRow]);
        }

        // config_relatorio (entidade)
        const temRel = await (async () => {
          try {
            const r = await supabase
              .from("config_relatorio")
              .select("entidade_id")
              .eq("entidade_id", entidadeId)
              .maybeSingle();
            return !!(r as any).data;
          } catch {
            return false;
          }
        })();
        const relUpdate: Record<string, unknown> = {
          ativo: relat.ativo,
          dia_semana: relat.dia_semana,
          hora: relat.hora,
          destinatarios: relat.destinatarios,
        };
        if (temRel) {
          await (supabase as any)
            .from("config_relatorio")
            .update(relUpdate)
            .eq("entidade_id", entidadeId);
        } else {
          await (supabase as any)
            .from("config_relatorio")
            .insert([{ entidade_id: entidadeId, ...relUpdate }]);
        }
      }
      setSavedAt(new Date());
    } catch (e: any) {
      setErroCarregar(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function onRepor() {
    if (aCarregar || !inicial) return;
    setPerfil(inicial.perfil);
    setNotif(inicial.notif);
    setCanal(inicial.canal);
    setRelat({
      ...inicial.relat,
      destinatarios: [...inicial.relat.destinatarios],
    });
    setPrazos(inicial.prazos);
    setEntrada(inicial.entrada);
    setAviso(inicial.aviso);
    setVarsArr(inicial.varsArr.map((v) => ({ ...v })));
    setSavedAt(null);
    setErroCarregar(null);
  }

  function convidarMembro() {
    if (!novoEmail.trim() || !novoEmail.includes("@")) return;
    setNovoEmail("");
  }

  function adicionarDestinatario() {
    if (!novoDestEmail.trim() || !novoDestEmail.includes("@")) return;
    const e = novoDestEmail.trim();
    if (relat.destinatarios.includes(e)) return;
    setRelat({ ...relat, destinatarios: [...relat.destinatarios, e] });
    setNovoDestEmail("");
  }

  function removerDestinatario(idx: number) {
    setRelat({ ...relat, destinatarios: relat.destinatarios.filter((_, i) => i !== idx) });
  }

  function atualizarVar(idx: number, val: string) {
    setVarsArr((prev) => {
      const copia = prev.map((v, i) => (i === idx ? { ...v, v: val } : v));
      const alvo = copia[idx];
      if (alvo?.local) escreverLocalVar(alvo.k, val);
      return copia;
    });
  }

  const gruposVars = [...new Set(varsArr.map((v) => v.g))];
  const varsFaltam = varsArr.filter((v) => !v.v.trim()).length;

  const fonteAtiva = cfgEnt.fonte_tipo ?? null;
  const ligado = !!fonteAtiva && !!cfgEnt.fonte_base;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "28px 30px 120px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {me?.entidade_nome ?? "Entidade"}
          </div>
          <h1 style={{ fontSize: 26, margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>
            definições
          </h1>
          {aCarregar ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>A carregar…</div>
          ) : me ? (
            <div style={{ fontSize: 13, color: "var(--soft)", marginTop: 2 }}>
              {me.funcao === "staff" && !me.entidade_nome
                ? "Estás em modo administração da plataforma (TheStarter). Para editar as definições de uma entidade cliente, usa Entrar na respetiva entidade."
                : "Ajusta conta, equipa, notificações, prazos, credenciais e ligações de dados da entidade."}
            </div>
          ) : null}
        </div>

        {erroCarregar ? (
          <Card style={{ padding: 16, color: "var(--red)", fontSize: 13 }}>
            {erroCarregar}
          </Card>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {TABS.map((t) => (
              <Tab key={t.value} value={t.value}>
                {t.label}
              </Tab>
            ))}
          </TabsList>

          <Card style={{ padding: 24, position: "relative" }}>
            {aCarregar ? (
              <div style={{ padding: 40, color: "var(--muted)" }}>A carregar configuração…</div>
            ) : (
              <>
                <TabPanel value="perfil">
                  <Section title="Perfil" desc="Os teus dados nesta conta.">
                    <div style={{ marginBottom: 14 }}>
                      <FieldLabel>Nome</FieldLabel>
                      <input
                        value={perfil.nome}
                        onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
                        placeholder="O teu nome"
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <FieldLabel>Email</FieldLabel>
                      <input
                        type="email"
                        value={perfil.email}
                        onChange={(e) => setPerfil({ ...perfil, email: e.target.value })}
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <FieldLabel>Entidade</FieldLabel>
                      <input value={perfil.entidade} disabled style={{ opacity: 0.55 }} />
                      <FieldHint>Só um administrador pode alterar o nome da entidade.</FieldHint>
                    </div>
                  </Section>
                </TabPanel>

                <TabPanel value="equipa">
                  <Section
                    title="Equipa"
                    desc="Quem tem acesso ao quadro. Administradores podem convidar e remover pessoas."
                  >
                    {equipa.length === 0 ? (
                      <Note tone="neutral" title="Ainda sem membros na equipa">
                        Convida o primeiro colega usando o campo abaixo. Ele recebe um email com um link
                        para definir a palavra-passe.
                      </Note>
                    ) : (
                      equipa.map((m, i) => (
                        <div
                          key={m.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "13px 0",
                            borderBottom:
                              i === equipa.length - 1
                                ? "0.5px solid var(--line)"
                                : "0.5px solid var(--line)",
                            borderTop: i === 0 ? "0.5px solid var(--line)" : undefined,
                          }}
                        >
                          <Avatar inicial={iniciaisDe(m.nome, m.email)} size="sm" />
                          <ListRowBody
                            title={
                              <>
                                {m.nome ?? m.email ?? "Utilizador"}
                                {me && m.id === me.id && (
                                  <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                                    {" "}
                                    (tu)
                                  </span>
                                )}
                              </>
                            }
                            subtitle={
                              m.email
                                ? m.ultimo_acesso
                                  ? `${m.email} · último acesso ${new Date(m.ultimo_acesso).toLocaleDateString("pt-PT")}`
                                  : `${m.email} · ainda não entrou`
                                : undefined
                            }
                          />
                          <Pill active={m.funcao === "admin" || m.funcao === "staff"}>
                            {m.funcao}
                          </Pill>
                        </div>
                      ))
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18 }}>
                      <input
                        placeholder="email@entidade.pt"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && convidarMembro()}
                      />
                      <Button variant="primary" size="sm" onClick={convidarMembro}>
                        Convidar
                      </Button>
                    </div>
                    <FieldHint>
                      A pessoa recebe um email com o link de acesso. O link expira ao fim de 7 dias.
                    </FieldHint>
                  </Section>
                </TabPanel>

                <TabPanel value="notif">
                  <Section
                    title="Notificações"
                    desc="O que te avisa. Cada pessoa define as suas."
                  >
                    {!me?.id ? (
                      <Note tone="neutral" title="Inicia sessão primeiro">
                        As preferências são guardadas por utilizador.
                      </Note>
                    ) : (
                      <div style={{ borderTop: "0.5px solid var(--line)" }}>
                        {NOTIF_ITEMS.map((item) => (
                          <ListRow key={item.k}>
                            <ListRowBody title={item.l} />
                            <Toggle
                              on={!!notif[item.k]}
                              onChange={() =>
                                setNotif({ ...notif, [item.k]: !notif[item.k] })
                              }
                            />
                          </ListRow>
                        ))}
                      </div>
                    )}
                  </Section>

                  <Section title="Canais" desc="Onde queres receber estes avisos.">
                    <div style={{ borderTop: "0.5px solid var(--line)" }}>
                      {CANAIS.map((c) => (
                        <ListRow key={c.k}>
                          <ListRowBody title={c.l} />
                          <Toggle
                            on={!!canal[c.k]}
                            onChange={() => setCanal({ ...canal, [c.k]: !canal[c.k] })}
                          />
                        </ListRow>
                      ))}
                    </div>
                  </Section>
                </TabPanel>

                <TabPanel value="relat">
                  <Section
                    title="Relatório semanal"
                    desc="Um email com o estado de todas as ações: atrasadas, para esta semana, bloqueadas e concluídas. Enviado para os endereços abaixo, mesmo que não tenham conta no Fluxo."
                  >
                    <div style={{ borderTop: "0.5px solid var(--line)" }}>
                      <ListRow>
                        <ListRowBody
                          title="Enviar relatório semanal"
                          subtitle={
                            relat.ativo
                              ? `${relat.dia_semana} às ${relat.hora} · ${relat.destinatarios.length} destinatários`
                              : "Desativado"
                          }
                        />
                        <Toggle on={relat.ativo} onChange={() => setRelat({ ...relat, ativo: !relat.ativo })} />
                      </ListRow>
                    </div>

                    <div style={{ display: "flex", gap: 10, margin: "18px 0 20px" }}>
                      <div style={{ flex: 1 }}>
                        <FieldLabel>Dia</FieldLabel>
                        <select
                          value={relat.dia_semana ?? "Segunda"}
                          onChange={(e) => setRelat({ ...relat, dia_semana: e.target.value })}
                        >
                          {DIAS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <FieldLabel>Hora</FieldLabel>
                        <select
                          value={relat.hora ?? "09:00"}
                          onChange={(e) => setRelat({ ...relat, hora: e.target.value })}
                        >
                          {HORAS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <FieldLabel>Destinatários</FieldLabel>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 11,
                      }}
                    >
                      {relat.destinatarios.length === 0 ? (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          Sem destinatários configurados.
                        </span>
                      ) : (
                        relat.destinatarios.map((e, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: 12,
                              border: "0.5px solid var(--ls)",
                              borderRadius: 4,
                              padding: "4px 9px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                            }}
                          >
                            {e}
                            <button
                              onClick={() => removerDestinatario(i)}
                              style={{
                                color: "var(--muted)",
                                fontSize: 13,
                                lineHeight: 1,
                                cursor: "pointer",
                                padding: 0,
                                border: "none",
                                background: "none",
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        placeholder="email@entidade.pt"
                        value={novoDestEmail}
                        onChange={(e) => setNovoDestEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && adicionarDestinatario()}
                      />
                      <Button variant="primary" size="sm" onClick={adicionarDestinatario}>
                        Adicionar
                      </Button>
                    </div>
                    <FieldHint>
                      Podes adicionar qualquer email, incluindo direção ou contabilidade.
                    </FieldHint>

                    <div style={{ marginTop: 20 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => alert("Pré-visualização do relatório semanal.")}
                      >
                        Ver pré-visualização
                      </Button>
                    </div>
                  </Section>
                </TabPanel>

                <TabPanel value="prazos">
                  <Section
                    title="Entrada no quadro"
                    desc="A partir de quando é que uma ação aparece no quadro (contando do início da formação)."
                  >
                    <select
                      value={entrada}
                      onChange={(e) => setEntrada(Number(e.target.value))}
                      style={{ maxWidth: 240 }}
                    >
                      {DIAS_ENTRADA.map((d) => (
                        <option key={d} value={d}>
                          {d} dias antes
                        </option>
                      ))}
                    </select>
                  </Section>

                  <Section
                    title="Prazos por flow"
                    desc="Prazo padrão para fechar cada flow (dias)."
                  >
                    {PRAZOS_LINHAS.map((p) => (
                      <div
                        key={p.n}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "28px 1.6fr 140px 1fr",
                          gap: 10,
                          alignItems: "center",
                          padding: "10px 0",
                          borderBottom: "0.5px solid var(--line)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--fg)",
                          }}
                        >
                          {p.n}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.ref}</div>
                        </div>
                        <select
                          value={prazos[p.n] ?? PRAZOS_DEFAULTS[p.n]}
                          onChange={(e) =>
                            setPrazos({ ...prazos, [p.n]: Number(e.target.value) })
                          }
                        >
                          {DIAS_PRAZO.map((d) => (
                            <option key={d} value={d}>
                              {d} {d === 1 ? "dia" : "dias"}
                            </option>
                          ))}
                        </select>
                        <div />
                      </div>
                    ))}
                  </Section>

                  <Section
                    title="Antecedência do aviso"
                    desc="Quando deve avisar que um prazo está quase a chegar."
                  >
                    <select
                      value={aviso}
                      onChange={(e) => setAviso(Number(e.target.value))}
                      style={{ maxWidth: 240 }}
                    >
                      {DIAS_AVISO.map((d) => (
                        <option key={d} value={d}>
                          {d} {d === 1 ? "dia" : "dias"} antes
                        </option>
                      ))}
                    </select>
                  </Section>
                </TabPanel>

                <TabPanel value="vars">
                  <Section
                    title="Credenciais e variáveis"
                    desc="Aqui ficam todas as variáveis usadas pelo Fluxo e pela documentação."
                  >
                    {varsFaltam > 0 ? (
                      <Note tone="danger" title={`Faltam ${varsFaltam} de ${varsArr.length} variáveis`}>
                        Preenche todas antes de ativar a ligação de dados.
                      </Note>
                    ) : (
                      <Note tone="ok" title="Todas as variáveis estão preenchidas">
                        A ligação de dados já tem tudo o que precisa a partir daqui.
                      </Note>
                    )}
                    <Note tone="neutral" title="Onde ficam guardadas">
                      SIGO_PALAVRA e CRM_TOKEN só existem neste navegador (localStorage, {""}
                      sem envio por rede). O resto é cifrado e guardado na tua entidade.
                    </Note>
                  </Section>

                  {gruposVars.map((g) => (
                    <Section key={g} title={g}>
                      {varsArr
                        .filter((v) => v.g === g)
                        .map((v, idxGlobal) => {
                          const idx = varsArr.indexOf(v);
                          return (
                            <div
                              key={v.k}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 240px",
                                gap: 12,
                                padding: "13px 0",
                                borderBottom: "0.5px solid var(--line)",
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 4,
                                }}
                              >
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{v.r}</div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <code style={{ fontSize: 11 }}>{v.k}</code>
                                  {v.local && (
                                    <Pill active={false} tone="neutral">
                                      só neste navegador
                                    </Pill>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <input
                                  type={v.secret ? "password" : "text"}
                                  value={varsArr[idx].v}
                                  onChange={(e) => atualizarVar(idx, e.target.value)}
                                  placeholder={v.local ? "não é enviado ao servidor" : "vazio"}
                                />
                                <div />
                                {idxGlobal === 0 && false ? null : null}
                              </div>
                            </div>
                          );
                        })}
                    </Section>
                  ))}
                </TabPanel>

                <TabPanel value="dados">
                  <Section
                    title="Ligação de dados"
                    desc="O Fluxo só le a tua fonte e só guarda referências. A leitura dos formandos está sempre bloqueada (cumprimento)."
                  >
                    {!ligado ? (
                      <Note tone="danger" title="Ainda sem ligação ativa">
                        Para ativar, escolhe um tipo de fonte e preenche os identificadores nas
                        Credenciais.
                      </Note>
                    ) : (
                      <Note tone="ok" title={`Ligação ativa · ${fonteAtiva}`}>
                        Base {cfgEnt.fonte_base}. O cron de prazos já inclui esta entidade.
                      </Note>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 90px",
                        gap: 1,
                        background: "var(--line)",
                        border: "0.5px solid var(--line)",
                        borderRadius: 6,
                        overflow: "hidden",
                        margin: "18px 0",
                      }}
                    >
                      {[
                        ["Ações de formação", fonteAtiva ? "Ativa" : "Inativa", !!fonteAtiva],
                        ["Registos (logs)", fonteAtiva ? "Ativa" : "Inativa", !!fonteAtiva],
                        ["Formandos", "Bloqueada", false],
                      ].map(([nome, estado, ok], i) => (
                        <React.Fragment key={String(nome)}>
                          <div
                            style={{
                              background: "var(--bg)",
                              padding: "12px 14px",
                              fontSize: 13,
                            }}
                          >
                            {nome as string}
                          </div>
                          <div
                            style={{
                              background: "var(--bg)",
                              padding: "12px 14px",
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            {estado as string}
                          </div>
                          <div style={{ background: "var(--bg)", padding: "12px 14px" }}>
                            <Pill
                              tone={(ok as boolean) ? "ok" : estado === "Bloqueada" ? "neutral" : "neutral"}
                              dot={false}
                            >
                              {(ok as boolean) ? "sim" : estado === "Bloqueada" ? "sempre" : "não"}
                            </Pill>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </Section>

                  <Section
                    title="Permissões da credencial"
                    desc="Resumo de o que a chave que guardaste consegue fazer."
                  >
                    <ListRow>
                      <ListRowBody title="Ler ações" subtitle="Necessário para aparecerem no quadro." />
                      <Pill tone="ok">sim</Pill>
                    </ListRow>
                    <ListRow>
                      <ListRowBody title="Ler registos" subtitle="Necessário para derivar prazos." />
                      <Pill tone="ok">sim</Pill>
                    </ListRow>
                    <ListRow>
                      <ListRowBody
                        title="Ler formandos"
                        subtitle="Nunca. Os dados de dados pessoais ficam na tua fonte."
                      />
                      <Pill tone="neutral">nunca</Pill>
                    </ListRow>
                    <ListRow>
                      <ListRowBody title="Escrever na fonte" subtitle="Apenas no modo avançado." />
                      <Pill tone="neutral">desligado</Pill>
                    </ListRow>
                  </Section>

                  <Section title="Ações">
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="secondary" size="sm">
                        Sincronizar agora
                      </Button>
                      <Button variant="ghost" size="sm">
                        Simular falha
                      </Button>
                    </div>
                  </Section>

                  <Section title="Mudar de fonte">
                    {[
                      ["Airtable", cfgEnt.fonte_tipo === "Airtable", "ativa"],
                      ["Google Sheets", false, "disponível"],
                      ["Hubspot", false, "sob pedido"],
                      ["Excel local", false, "sob pedido"],
                    ].map(([nome, ativa, tag]) => (
                      <ListRow key={nome as string}>
                        <ListRowBody title={nome as string} />
                        <Pill active={ativa as boolean} tone="ok">
                          {tag as string}
                        </Pill>
                      </ListRow>
                    ))}
                  </Section>
                </TabPanel>

                <TabPanel value="priv">
                  <Section title="O que lemos na tua fonte">
                    Apenas as tabelas que escolheste nas variáveis: ações de formação e registos
                    de execução. Sempre em modo de leitura mínima (só os campos do mapeamento),
                    por ordem do flow ativo.
                  </Section>
                  <Section title="O que nunca lemos">
                    A tabela de formandos está bloqueada no adaptador — mesmo que a coloques
                    nas variáveis, o código do Fluxo recusa ler a tabela. Os restantes dados
                    pessoais (emails, contactos, moradas) só são tratados se tu explicitamente
                    os adicionares ao mapeamento.
                  </Section>
                  <Section
                    title="O que a TheStarter vê"
                    desc="Equipa técnica e suporte."
                  >
                    Como operador da plataforma, a TheStarter acede: à lista de entidades e
                    utilizadores para onboarding e troubleshooting; aos problemas que reportares
                    para investigar; aos logs do cron de prazos. Não temos acesso ao conteúdo
                    das ações nem dos registos a menos que explicitamente partilhes o token de
                    leitura.
                  </Section>
                  <Section
                    title="O que guardamos"
                    desc="Só o necessário para o funcionamento."
                  >
                    Contas, preferências, estado das notificações e configuração da entidade
                    (identificadores de base, prazos, relatório). As duas variáveis locais —
                    SIGO_PALAVRA e CRM_TOKEN — não são guardadas nos nossos servidores.
                  </Section>
                  <Section title="Onde ficam">
                    Os teus dados estão numa base de dados Supabase na União Europeia (Frankfurt).
                    Os anexos de problemas ficam no storage bucket da mesma região (UE) com
                    encriptação em repouso e acesso RLS à própria entidade ou staff.
                  </Section>
                  <Section title="Se deixares de usar">
                    Ao eliminar a entidade, todos os dados associados são apagados em cascata
                    no mesmo dia: contas, convites, configurações, preferências, histórico de
                    notificações, problemas e anexos. Os documentos globais da plataforma são
                    mantidos. O pedido de eliminação pode ser feito a partir do botão Remover
                    na lista de entidades (exige confirmação escrita do nome da empresa).
                  </Section>
                </TabPanel>
              </>
            )}
          </Card>
        </Tabs>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "var(--panel)",
          borderTop: "0.5px solid var(--line)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "12px 30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {savedAt ? (
              <>
                <span style={{ color: "#2f7d4b", fontWeight: 600 }}>Guardado.</span>
                <span>
                  às {savedAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  .
                </span>
              </>
            ) : saving ? (
              <span>A guardar…</span>
            ) : (
              <span>
                Alterações só são gravadas quando clicares em Guardar (não há autosave).
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              onClick={onRepor}
              disabled={saving || aCarregar || !inicial}
            >
              Repor
            </Button>
            <Button
              variant="primary"
              onClick={onGuardar}
              loading={saving}
              disabled={aCarregar || saving}
            >
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
