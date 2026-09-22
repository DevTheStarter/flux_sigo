const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-03-02" → "02 mar" */
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MESES[Number(m[2]) - 1] ?? ""}`;
}

/** "2026-03-02" → "02 mar 2026" */
export function dataLonga(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MESES[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/** "há 4 min", "há 2 horas", "há 3 dias", "há 4 meses" */
export function relativo(iso: string | null | undefined, agora: Date = new Date()): string {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((agora.getTime() - t) / 1000));
  if (s < 45) return "agora";
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const mes = Math.round(d / 30);
  if (mes < 12) return `há ${mes} ${mes === 1 ? "mês" : "meses"}`;
  const ano = Math.round(mes / 12);
  return `há ${ano} ${ano === 1 ? "ano" : "anos"}`;
}

/** dias inteiros desde uma data (YYYY-MM-DD ou ISO) até hoje */
export function diasDesde(iso: string | null | undefined, agora: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((agora.getTime() - t) / 86400000);
}

export function plural(n: number, um: string, muitos: string): string {
  return `${n} ${n === 1 ? um : muitos}`;
}

/** "mar 2026" */
export function mesAno(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${MESES[Number(m[2]) - 1]} ${m[1]}`;
}
