import { describe, expect, it } from "vitest";
import type { Acao, Registo } from "../lib/dados/interface";
import { derivar } from "../lib/dados/derivar";
import { calcularPrazo, PRAZOS_DEFAULTS, diasAte } from "../lib/dados/prazos";
import { estimar, formatarDuracao } from "../lib/dados/estimar";

function dataISO(offsetDias: number, ref: Date = new Date(2026, 5, 1)) {
  const ms =
    Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()) +
    offsetDias * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

const HOJE = new Date(2026, 5, 1);

const BASE_ACAO: Acao = {
  id: "A1",
  nome: "Ação teste",
  codigoCurso: "C001",
  dataInicio: dataISO(-60),
  dataFim: dataISO(15),
  tipo: "Presencial",
  formato: "PT",
  diasSemana: "2;4",
  estado: "Ativa",
  ano: 2026,
  formandos: 12,
  temAvaliacoes: true,
  urlOrigem: null,
};

function mkAcao(override: Partial<Acao> = {}): Acao {
  return { ...BASE_ACAO, ...override };
}

function mkRegisto(
  acaoId: string,
  flow: number,
  estado: string,
  dataOffset: number,
  detalhe = ""
): Registo {
  return {
    acaoId,
    flow: flow as 0 | 1 | 2 | 3 | 4 | 5,
    estado: estado as "success" | "missing_data" | "error",
    data: dataISO(dataOffset),
    detalhe,
  };
}

describe("§4.2 derivar()", () => {
  it("1. col 4 sem temAvaliacoes → blocked motivo 'Falta tabela de avaliações'", () => {
    const a = mkAcao({ dataFim: dataISO(10), temAvaliacoes: false });
    const logs = [0, 1, 2, 3].map((f) => mkRegisto(a.id, f, "success", -10));
    const r = derivar(a, logs, {}, HOJE);
    expect(r.col).toBe(4);
    expect(r.estado).toBe("blocked");
    expect(r.motivo).toBe("Falta tabela de avaliações");
  });

  it("2. dataFim > entrada dias → futura entraEm calculado", () => {
    const a = mkAcao({ dataFim: dataISO(20) });
    const r = derivar(a, [], {}, HOJE);
    expect(r.estado).toBe("futura");
    // 20 - 15 (entrada default) = 5
    expect(r.entraEm).toBe(5);
  });

  it("3. prazo flow 0 já passou → late 2 dias", () => {
    // dataFim daqui a 1 dia
    const a = mkAcao({ dataFim: dataISO(1) });
    // prazo 0 default = 3 dias ANTES de dataFim = dataISO(1) - 3 = dataISO(-2)
    // hoje = dataISO(0). Prazo está 2 dias atrás.
    const r = derivar(a, [], {}, HOJE);
    expect(r.col).toBe(0);
    expect(r.estado).toBe("late");
    expect(r.dias).toBe(2);
  });

  it("4. último log error → estado error com motivo", () => {
    const a = mkAcao({ dataFim: dataISO(10) });
    const logs = [mkRegisto(a.id, 0, "error", -2, "Timeout ao ler BD")];
    const r = derivar(a, logs, {}, HOJE);
    expect(r.estado).toBe("error");
    expect(r.motivo).toBe("Timeout ao ler BD");
    expect(r.col).toBe(0);
  });

  it("5. último log missing_data → blocked com motivo", () => {
    const a = mkAcao({ dataFim: dataISO(10) });
    const logs = [mkRegisto(a.id, 1, "missing_data", -1, "Falta NIF da Ana")];
    // primeiro flow 0 success para cair em col 1
    logs.push(mkRegisto(a.id, 0, "success", -10));
    const r = derivar(a, logs, {}, HOJE);
    expect(r.col).toBe(1);
    expect(r.estado).toBe("blocked");
    expect(r.motivo).toBe("Falta NIF da Ana");
  });

  it("6. todos flows success → col 6 done com concluidaHa", () => {
    const a = mkAcao({ dataFim: dataISO(-20) });
    const logs = [0, 1, 2, 3, 4, 5].map((f) =>
      mkRegisto(a.id, f, "success", f === 5 ? -5 : -30)
    );
    const r = derivar(a, logs, {}, HOJE);
    expect(r.col).toBe(6);
    expect(r.estado).toBe("done");
    expect(r.concluidaHa).toBe(5);
  });

  it("7. col 4, hoje = dia do prazo → today", () => {
    const a = mkAcao({ dataFim: dataISO(-20) });
    // phase 3 success há 7 dias → phase 4 prazo = +7 dias → hoje
    const logs = [0, 1, 2, 3].map((f) =>
      mkRegisto(a.id, f, "success", f === 3 ? -7 : -30)
    );
    const r = derivar(a, logs, {}, HOJE);
    expect(r.col).toBe(4);
    expect(r.estado).toBe("today");
  });

  it("8. phase 5 com anchor phase 4 ontem → ok dias=2 (prazo 5=3)", () => {
    const a = mkAcao({ dataFim: dataISO(-20) });
    const logs = [0, 1, 2, 3, 4].map((f) =>
      mkRegisto(a.id, f, "success", f === 4 ? -1 : -30)
    );
    const r = derivar(a, logs, {}, HOJE);
    expect(r.col).toBe(5);
    expect(r.estado).toBe("ok");
    expect(r.dias).toBe(2);
  });
});

describe("§5 calcularPrazo & PRAZOS_DEFAULTS", () => {
  it("9. calcularPrazo col 4 sem anchor (sem success 3) → undefined", () => {
    const a = mkAcao();
    const p = calcularPrazo(a, 4, [], PRAZOS_DEFAULTS);
    expect(p).toBeUndefined();
  });

  it("10. PRAZOS_DEFAULTS valores exatos §5", () => {
    expect(PRAZOS_DEFAULTS).toEqual({
      entrada: 15,
      aviso: 3,
      "0": 3,
      "1": 1,
      "2": 1,
      "3": 21,
      "4": 7,
      "5": 3,
    });
  });

  it("11. diasAte() sinal correto", () => {
    expect(diasAte(dataISO(5), HOJE)).toBe(5);
    expect(diasAte(dataISO(0), HOJE)).toBe(0);
    expect(diasAte(dataISO(-3), HOJE)).toBe(-3);
  });
});

describe("§4.8 estimar()", () => {
  it("12. phase 4 escala com formandos (min*N, max*N)", () => {
    expect(estimar(4, 2)).toEqual({ min: 10, max: 14 });
    expect(estimar(4, 10)).toEqual({ min: 50, max: 70 });
    // outros flows fixos
    expect(estimar(0, 99)).toEqual({ min: 3, max: 10 });
    expect(estimar(5, 0)).toEqual({ min: 3, max: 7 });
    // formatar
    expect(formatarDuracao({ min: 5, max: 7 })).toBe("5 min a 7 min");
    expect(formatarDuracao({ min: 70, max: 90 })).toBe("1h10 a 1h30");
    expect(formatarDuracao({ min: 60, max: 60 })).toBe("1h");
  });
});
