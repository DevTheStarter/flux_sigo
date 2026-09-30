import { describe, expect, it } from "vitest";
import type { CartaoQuadro } from "../app/api/quadro/route";
import { cumpre, lerCondicoes, normalizarCondicoes, textoCondicao, type Condicao } from "../lib/cliente/vistas";

function cartao(formato: string, estado: CartaoQuadro["estado"] = "ok", diasSemana = "Seg, Qua"): CartaoQuadro {
  return { acao: { formato, ano: 2026, tipo: "Curso", diasSemana }, estado } as unknown as CartaoQuadro;
}

describe("cumpre", () => {
  const curso = cartao("Curso");
  const lite = cartao("Curso Lite");
  const imersao = cartao("Imersão");

  it("sem condições aceita tudo", () => {
    expect(cumpre(curso, [])).toBe(true);
  });

  it("'em' com vários valores aceita qualquer um deles", () => {
    const conds: Condicao[] = [{ campo: "formato", op: "em", vals: ["Curso", "Curso Lite"] }];
    expect(cumpre(curso, conds)).toBe(true);
    expect(cumpre(lite, conds)).toBe(true);
    expect(cumpre(imersao, conds)).toBe(false);
  });

  it("'fora' exclui todos os valores listados", () => {
    const conds: Condicao[] = [{ campo: "formato", op: "fora", vals: ["Curso", "Curso Lite"] }];
    expect(cumpre(curso, conds)).toBe(false);
    expect(cumpre(lite, conds)).toBe(false);
    expect(cumpre(imersao, conds)).toBe(true);
  });

  it("condições diferentes combinam em AND", () => {
    const conds: Condicao[] = [
      { campo: "formato", op: "em", vals: ["Curso"] },
      { campo: "estado", op: "em", vals: ["late", "today"] },
    ];
    expect(cumpre(cartao("Curso", "late"), conds)).toBe(true);
    expect(cumpre(cartao("Curso", "ok"), conds)).toBe(false);
    expect(cumpre(cartao("Imersão", "late"), conds)).toBe(false);
  });

  it("condição sem valores é ignorada", () => {
    expect(cumpre(imersao, [{ campo: "formato", op: "em", vals: [] }])).toBe(true);
  });

  it("valores com vírgula (Dias) comparam por inteiro", () => {
    expect(cumpre(cartao("Curso", "ok", "Seg, Qua"), [{ campo: "diasSemana", op: "em", vals: ["Seg, Qua"] }])).toBe(true);
    expect(cumpre(cartao("Curso", "ok", "Seg"), [{ campo: "diasSemana", op: "em", vals: ["Seg, Qua"] }])).toBe(false);
  });
});

describe("lerCondicoes", () => {
  it("lê o formato atual", () => {
    expect(lerCondicoes([{ campo: "formato", op: "fora", vals: ["Curso", "Curso Lite"] }])).toEqual([
      { campo: "formato", op: "fora", vals: ["Curso", "Curso Lite"] },
    ]);
  });

  it("converte o formato antigo com '=' e '≠'", () => {
    expect(lerCondicoes([{ campo: "formato", op: "=", val: "Curso" }, { campo: "tipo", op: "≠", val: "Workshop" }])).toEqual([
      { campo: "formato", op: "em", vals: ["Curso"] },
      { campo: "tipo", op: "fora", vals: ["Workshop"] },
    ]);
  });

  it("converte 'em' antigo separado por vírgulas (vista semeada)", () => {
    expect(lerCondicoes([{ campo: "estado", op: "em", val: "late,today,blocked,error" }])).toEqual([
      { campo: "estado", op: "em", vals: ["late", "today", "blocked", "error"] },
    ]);
  });

  it("converte o formato em arrays", () => {
    expect(lerCondicoes([["ano", "=", 2026]])).toEqual([{ campo: "ano", op: "em", vals: ["2026"] }]);
  });

  it("descarta campos desconhecidos e entradas inválidas", () => {
    expect(lerCondicoes([{ campo: "xpto", op: "=", val: "a" }, null, 3, "x"])).toEqual([]);
    expect(lerCondicoes("nada")).toEqual([]);
  });
});

describe("normalizarCondicoes", () => {
  it("funde condições com o mesmo campo e operador", () => {
    const out = normalizarCondicoes([
      { campo: "formato", op: "em", vals: ["Curso"] },
      { campo: "formato", op: "em", vals: ["Curso Lite", "Curso"] },
    ]);
    expect(out).toEqual([{ campo: "formato", op: "em", vals: ["Curso", "Curso Lite"] }]);
  });

  it("mantém 'em' e 'fora' do mesmo campo separados e descarta condições vazias", () => {
    const out = normalizarCondicoes([
      { campo: "formato", op: "em", vals: ["Curso"] },
      { campo: "formato", op: "fora", vals: [" Imersão "] },
      { campo: "tipo", op: "em", vals: ["", "  "] },
    ]);
    expect(out).toEqual([
      { campo: "formato", op: "em", vals: ["Curso"] },
      { campo: "formato", op: "fora", vals: ["Imersão"] },
    ]);
  });
});

describe("textoCondicao", () => {
  it("descreve um ou vários valores", () => {
    expect(textoCondicao({ campo: "formato", op: "em", vals: ["Curso"] })).toBe("Formato é Curso");
    expect(textoCondicao({ campo: "formato", op: "em", vals: ["Curso", "Curso Lite"] })).toBe("Formato é Curso ou Curso Lite");
    expect(textoCondicao({ campo: "estado", op: "fora", vals: ["late", "error", "done"] })).toBe("Estado não é atrasada, com erro nem concluída");
  });
});
