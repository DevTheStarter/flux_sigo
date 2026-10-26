const BASE: Record<number, [number, number]> = {
  0: [3, 10],
  1: [3, 10],
  2: [3, 10],
  3: [3, 10],
  4: [2, 2],
  5: [1, 1],
};

export interface Estimativa {
  min: number;
  max: number;
}

/**
 * Duração estimada de um flow (minutos).
 * Fases 4 e 5 escalam com formandos (min*N, max*N): 2 min e 1 min por formando.
 * Outras são fixas.
 */
export function estimar(fase: number, formandos: number): Estimativa {
  const par = BASE[fase] ?? [3, 10];
  const [min, max] = par;
  if (fase === 4 || fase === 5) {
    return { min: min * formandos, max: max * formandos };
  }
  return { min, max };
}

export function formatarDuracao(e: Estimativa): string {
  const fmt = (m: number): string => {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (rem === 0) return `${h}h`;
    return `${h}h${rem.toString().padStart(2, "0")}`;
  };
  if (e.min === e.max) return fmt(e.min);
  return `${fmt(e.min)} a ${fmt(e.max)}`;
}
