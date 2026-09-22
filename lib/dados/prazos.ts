import type { Acao, Flow, Registo } from "./interface";

export interface PrazosCfg {
  entrada: number;
  aviso: number;
  "0": number;
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
}

export const PRAZOS_DEFAULTS: PrazosCfg = {
  entrada: 15,
  aviso: 3,
  "0": 3,
  "1": 1,
  "2": 1,
  "3": 21,
  "4": 7,
  "5": 3,
};

export function mergePrazos(parcial: Partial<PrazosCfg> | null | undefined): PrazosCfg {
  return { ...PRAZOS_DEFAULTS, ...(parcial ?? {}) };
}

/** Conversão UTC-only para evitar off-by-one por DST/TZ. YYYY-MM-DD → ms em UTC 00:00. */
function parseDateUTC(dataIso: string): number {
  const p = dataIso.split("-").map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]);
}

function dateISOUTC(ms: number): string {
  const d = new Date(ms);
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    "-" +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    "-" +
    d.getUTCDate().toString().padStart(2, "0")
  );
}

function hojeUTC(hoje: Date): number {
  return Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

const MS_DIA = 86400000;

/** Dias de diferença (inteiro UTC). Positivo = futuro, negativo = passado. */
export function diasAte(dataIso: string, hoje: Date = new Date()): number {
  return Math.round((parseDateUTC(dataIso) - hojeUTC(hoje)) / MS_DIA);
}

export function diasDesde(dataIso: string, hoje: Date = new Date()): number {
  return -diasAte(dataIso, hoje);
}

/**
 * Regras §5:
 * 0,1,2: dias antes de dataFim
 * 3: dias após dataFim
 * 4: dias após success flow 3
 * 5: dias após success flow 4
 * Sem data de referência → undefined (sem prazo calculado).
 */
export function calcularPrazo(
  a: Acao,
  col: Flow,
  logs: Registo[],
  cfg: PrazosCfg
): string | undefined {
  const porChave = cfg as unknown as Record<string, number>;
  let offset = porChave[String(col)];
  if (offset === undefined || offset === null) return undefined;

  let anchorMs: number;
  if (col <= 3) {
    anchorMs = parseDateUTC(a.dataFim);
    if (col <= 2) offset = -offset;
  } else {
    const faseAnterior: Flow = (col - 1) as Flow;
    const sucessoAnterior = logs
      .filter((l) => l.flow === faseAnterior && l.estado === "success")
      .sort((x, y) => (x.data < y.data ? 1 : -1))[0];
    if (!sucessoAnterior) return undefined;
    anchorMs = parseDateUTC(sucessoAnterior.data);
  }
  return dateISOUTC(anchorMs + offset * MS_DIA);
}
