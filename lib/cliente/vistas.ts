/**
 * Vistas (§4.5): lista de condições, todas obrigatórias (AND).
 * Campos: ano, formato, tipo, estado, diasSemana.
 * Cada condição aceita vários valores: `em` (é um de) ou `fora` (não é nenhum de).
 */
import type { CartaoQuadro } from "../../app/api/quadro/route";

export type CampoVista = "ano" | "formato" | "tipo" | "estado" | "diasSemana";
export type OperadorVista = "em" | "fora";

export interface Condicao {
  campo: CampoVista;
  op: OperadorVista;
  /** valores aceites (em) ou excluídos (fora); vazio = sem efeito */
  vals: string[];
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

export const OPERADORES_VISTA: { k: OperadorVista; rotulo: string }[] = [
  { k: "em", rotulo: "é" },
  { k: "fora", rotulo: "não é" },
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
    if (cond.vals.length === 0) return true;
    const tem = cond.vals.includes(valorCampo(c, cond.campo));
    return cond.op === "fora" ? !tem : tem;
  });
}

function ehCampo(k: string): k is CampoVista {
  return CAMPOS_VISTA.some((c) => c.k === k);
}

function limpar(vals: string[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * Normaliza o JSON guardado em `vistas.condicoes`. Aceita:
 * - formato atual: {campo, op: "em"|"fora", vals: string[]}
 * - formato antigo: {campo, op: "="|"≠"|"em", val: string} (em: separado por vírgulas)
 * - formato mais antigo: [campo, op, val]
 */
export function lerCondicoes(raw: unknown): Condicao[] {
  if (!Array.isArray(raw)) return [];
  const out: Condicao[] = [];
  for (const item of raw) {
    let campo: string;
    let op: string;
    let val: unknown;
    if (Array.isArray(item) && item.length === 3) {
      [campo, op, val] = item as [string, string, unknown];
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      campo = String(o.campo ?? o.f ?? "");
      op = String(o.op ?? "=");
      val = o.vals ?? o.val ?? [];
    } else {
      continue;
    }
    if (!ehCampo(campo)) continue;
    let vals: string[];
    if (Array.isArray(val)) vals = (val as unknown[]).map(String);
    else if (op === "em" || op === "fora") vals = String(val ?? "").split(",");
    else vals = [String(val ?? "")];
    out.push({ campo, op: op === "≠" || op === "fora" ? "fora" : "em", vals: limpar(vals) });
  }
  return out;
}

/**
 * Prepara as condições para guardar: remove valores vazios e duplicados, descarta
 * condições sem valores e funde condições com o mesmo campo e operador
 * (duas linhas "Formato é Curso" + "Formato é Curso Lite" viram uma só).
 */
export function normalizarCondicoes(condicoes: Condicao[]): Condicao[] {
  const out: Condicao[] = [];
  for (const c of condicoes) {
    const vals = limpar(c.vals);
    if (vals.length === 0) continue;
    const igual = out.find((o) => o.campo === c.campo && o.op === c.op);
    if (igual) igual.vals = limpar([...igual.vals, ...vals]);
    else out.push({ campo: c.campo, op: c.op, vals });
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

export function rotuloValor(campo: CampoVista, v: string): string {
  return campo === "estado" ? ROTULO_ESTADO[v] ?? v : v;
}

export function textoCondicao(c: Condicao): string {
  const vals = c.vals.map((v) => rotuloValor(c.campo, v));
  const lista = vals.length <= 1 ? vals.join("") : `${vals.slice(0, -1).join(", ")} ${c.op === "fora" ? "nem" : "ou"} ${vals[vals.length - 1]}`;
  return `${rotuloCampo(c.campo)} ${c.op === "fora" ? "não é" : "é"} ${lista}`;
}

export type FiltroRapido = "late" | "today" | "blocked";

export function cumpreFiltroRapido(c: CartaoQuadro, f: FiltroRapido | null): boolean {
  if (!f) return true;
  if (f === "late") return c.estado === "late" || c.estado === "error";
  return c.estado === f;
}
