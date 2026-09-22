/**
 * Vistas (§4.5): lista de condições, todas obrigatórias (AND).
 * Campos: ano, formato, tipo, estado, diasSemana. Operadores: =, ≠, em.
 */
import type { CartaoQuadro } from "../../app/api/quadro/route";

export type CampoVista = "ano" | "formato" | "tipo" | "estado" | "diasSemana";
export type OperadorVista = "=" | "≠" | "em";

export interface Condicao {
  campo: CampoVista;
  op: OperadorVista;
  /** para `em`, lista separada por vírgulas */
  val: string;
}

export interface Vista {
  id: string;
  nome: string;
  condicoes: Condicao[];
  fixa: boolean;
}

export const CAMPOS_VISTA: { k: CampoVista; rotulo: string }[] = [
  { k: "ano", rotulo: "Ano" },
  { k: "formato", rotulo: "Formato" },
  { k: "tipo", rotulo: "Tipo" },
  { k: "estado", rotulo: "Estado" },
  { k: "diasSemana", rotulo: "Dias" },
];

export const ESTADOS_VISTA = ["ok", "today", "late", "blocked", "error", "done", "futura"];

export const ROTULO_ESTADO: Record<string, string> = {
  ok: "no prazo",
  today: "hoje",
  late: "atrasada",
  blocked: "bloqueada",
  error: "com erro",
  done: "concluída",
  futura: "futura",
};

export function rotuloCampo(k: string): string {
  return CAMPOS_VISTA.find((c) => c.k === k)?.rotulo ?? k;
}

function valorCampo(c: CartaoQuadro, campo: CampoVista): string {
  switch (campo) {
    case "ano": return String(c.acao.ano ?? "");
    case "formato": return c.acao.formato ?? "";
    case "tipo": return c.acao.tipo ?? "";
    case "estado": return c.estado;
    case "diasSemana": return c.acao.diasSemana ?? "";
  }
}

export function cumpre(c: CartaoQuadro, condicoes: Condicao[]): boolean {
  return condicoes.every((cond) => {
    const v = valorCampo(c, cond.campo);
    if (cond.op === "=") return v === cond.val;
    if (cond.op === "≠") return v !== cond.val;
    return cond.val.split(",").map((x) => x.trim()).filter(Boolean).includes(v);
  });
}

/** Normaliza o JSON guardado em `vistas.condicoes` (aceita o formato antigo em arrays). */
export function lerCondicoes(raw: unknown): Condicao[] {
  if (!Array.isArray(raw)) return [];
  const out: Condicao[] = [];
  for (const item of raw) {
    if (Array.isArray(item) && item.length === 3) {
      out.push({ campo: item[0] as CampoVista, op: item[1] as OperadorVista, val: Array.isArray(item[2]) ? item[2].join(",") : String(item[2]) });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const campo = String(o.campo ?? o.f ?? "");
      if (!CAMPOS_VISTA.some((c) => c.k === campo)) continue;
      const op = String(o.op ?? "=") as OperadorVista;
      const val = Array.isArray(o.val) ? (o.val as unknown[]).join(",") : String(o.val ?? "");
      out.push({ campo: campo as CampoVista, op: op === "≠" || op === "em" ? op : "=", val });
    }
  }
  return out;
}

/** Valores possíveis por campo, derivados dos cartões carregados. */
export function opcoesCampo(campo: CampoVista, cartoes: CartaoQuadro[]): string[] {
  if (campo === "estado") return ESTADOS_VISTA;
  const set = new Set<string>();
  for (const c of cartoes) {
    const v = valorCampo(c, campo);
    if (v) set.add(v);
  }
  return [...set].sort();
}

export function textoCondicao(c: Condicao): string {
  const val = c.campo === "estado" ? c.val.split(",").map((v) => ROTULO_ESTADO[v.trim()] ?? v).join(", ") : c.val;
  return `${rotuloCampo(c.campo)} ${c.op} ${val}`;
}

export type FiltroRapido = "late" | "today" | "blocked";

export function cumpreFiltroRapido(c: CartaoQuadro, f: FiltroRapido | null): boolean {
  if (!f) return true;
  if (f === "late") return c.estado === "late" || c.estado === "error";
  return c.estado === f;
}
