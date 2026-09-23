import { describe, expect, it } from "vitest";
import { avisoDoCartao } from "../lib/cron/avisos";
import { corpoRelatorio } from "../lib/cron/relatorio";
import { agoraEmLisboa } from "../lib/cron/quadro";
import type { Cartao } from "../lib/dados/derivar";

function cartao(p: Partial<Cartao>): Cartao {
  return {
    id: "rec1",
    col: 1,
    estado: "ok",
    acao: { id: "rec1", nome: "Ação X", codigoCurso: "C1", dataInicio: "2026-01-01", dataFim: "2026-02-01", tipo: "t", formato: "PT", diasSemana: null, estado: "Ativa", ano: 2026, formandos: 5, temAvaliacoes: true, urlOrigem: null },
    ...p,
  };
}

describe("§10.3 transições do cron de prazos", () => {
  it("primeira execução: regista sem avisar", () => {
    expect(avisoDoCartao(cartao({ estado: "late", dias: 3 }), undefined)).toBeNull();
  });
  it("sem mudança: nada", () => {
    expect(avisoDoCartao(cartao({ estado: "late", dias: 3 }), { acao_ref: "rec1", coluna: "1", estado: "late" })).toBeNull();
  });
  it("ok → late: prazo", () => {
    const a = avisoDoCartao(cartao({ estado: "late", dias: 2 }), { acao_ref: "rec1", coluna: "1", estado: "ok" });
    expect(a?.evento).toBe("prazo");
    expect(a?.corpo).toContain("há 2 dias");
  });
  it("ok → blocked e ok → error: bloqueio", () => {
    expect(avisoDoCartao(cartao({ estado: "blocked", motivo: "Falta X" }), { acao_ref: "rec1", coluna: "1", estado: "ok" })?.evento).toBe("bloqueio");
    expect(avisoDoCartao(cartao({ estado: "error", motivo: "boom" }), { acao_ref: "rec1", coluna: "1", estado: "ok" })?.evento).toBe("bloqueio");
  });
  it("coluna avança: concluido, mesmo que o novo estado seja late", () => {
    const a = avisoDoCartao(cartao({ col: 3, estado: "late", dias: 1 }), { acao_ref: "rec1", coluna: "2", estado: "ok" });
    expect(a?.evento).toBe("concluido");
    expect(a?.corpo).toContain("Flow 2");
  });
  it("fase 5 feita: concluido, uma vez", () => {
    expect(avisoDoCartao(cartao({ col: 6, estado: "done", concluidaHa: 0 }), { acao_ref: "rec1", coluna: "5", estado: "ok" })?.evento).toBe("concluido");
    expect(avisoDoCartao(cartao({ col: 6, estado: "done", concluidaHa: 1 }), { acao_ref: "rec1", coluna: "6", estado: "done" })).toBeNull();
  });
  it("late → ok (prazo alterado) não avisa", () => {
    expect(avisoDoCartao(cartao({ estado: "ok", dias: 4 }), { acao_ref: "rec1", coluna: "1", estado: "late" })).toBeNull();
  });
});

describe("§12 relatório semanal", () => {
  it("agrupa e não inclui detalhe de registos fora do motivo", () => {
    const r = corpoRelatorio("Escola", [
      cartao({ estado: "late", dias: 2, col: 3 }),
      cartao({ id: "b", estado: "blocked", motivo: "Falta tabela", col: 4 }),
      cartao({ id: "c", estado: "ok", dias: 5 }),
      cartao({ id: "d", estado: "ok", dias: 20 }),
      cartao({ id: "e", estado: "done", concluidaHa: 2, col: 6 }),
      cartao({ id: "f", estado: "done", concluidaHa: 30, col: 6 }),
    ], "01/01/2026");
    expect(r.assunto).toContain("1 atrasada");
    expect(r.assunto).toContain("1 bloqueada");
    expect(r.html).toContain("Atrasadas (1)");
    expect(r.html).toContain("Bloqueadas (1)");
    expect(r.html).toContain("Para esta semana (1)");
    expect(r.html).toContain("Concluídas esta semana (1)");
    expect(r.html).toContain("fala com o administrador da tua entidade");
    expect(r.html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe("hora de Lisboa", () => {
  it("converte UTC para o dia e hora locais", () => {
    // 2026-07-15T08:30Z é 09:30 em Lisboa (verão, UTC+1), quarta-feira
    const a = agoraEmLisboa(new Date("2026-07-15T08:30:00Z"));
    expect(a).toEqual({ data: "2026-07-15", hora: 9, diaSemana: "quarta" });
    // 2026-01-05T23:30Z é segunda 23:30 em Lisboa (inverno, UTC+0)
    expect(agoraEmLisboa(new Date("2026-01-05T23:30:00Z"))).toEqual({ data: "2026-01-05", hora: 23, diaSemana: "segunda" });
  });
});
