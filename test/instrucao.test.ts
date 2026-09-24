import { describe, expect, it } from "vitest";
import type { CartaoQuadro } from "../app/api/quadro/route";
import { instrucaoCurta } from "../lib/cliente/instrucao";

function cartao(col: number): CartaoQuadro {
  return {
    id: "recTi2UkI4fJqWliR",
    col,
    estado: "ok",
    feitas: {},
    acao: {
      id: "recTi2UkI4fJqWliR",
      nome: "Imersão UX",
      codigoCurso: "IUX-01",
      dataInicio: "2026-07-06",
      dataFim: "2026-09-02",
      tipo: "B2C",
      formato: "Curso",
      diasSemana: null,
      estado: "Ativo",
      ano: 2026,
      formandos: 13,
      temAvaliacoes: true,
      urlOrigem: "https://airtable.com/appN5zpGoVaDyFy4W/tbl6854YSHuwz6t5K/recTi2UkI4fJqWliR",
    },
  };
}

const valores = { SIGO_URL: "https://sigo.example", SIGO_UTILIZADOR: "miguel_coelho", CRM_TIPO: "airtable", CRM_BASE: "appN5zpGoVaDyFy4W" };

describe("§4.9 instrução curta", () => {
  it("Flow 0: link da ação, sem atalho", () => {
    const { texto, faltam } = instrucaoCurta(cartao(0), valores);
    expect(texto).toBe(
      "Executa o Flow 0 (Recolha de dados) para a ação de formação https://airtable.com/appN5zpGoVaDyFy4W/tbl6854YSHuwz6t5K/recTi2UkI4fJqWliR\n\n" +
        "Código do curso: IUX-01\nDatas: 06 jul a 02 set\nFormandos: 13\n\n" +
        "SIGO: https://sigo.example · utilizador miguel_coelho\nBase de dados: airtable · appN5zpGoVaDyFy4W\n\n" +
        "Segue as instruções do Flow 0",
    );
    expect(faltam).toEqual([]);
  });
  it("Flows 1 a 5: link da ação e atalho /flow-N", () => {
    const { texto } = instrucaoCurta(cartao(3), valores);
    expect(texto.startsWith("Executa o Flow 3 (Criação da ação) para a ação de formação https://airtable.com/")).toBe(true);
    expect(texto.endsWith("Segue as instruções do /flow-3")).toBe(true);
    expect(texto).not.toContain("flow-3.md");
  });
  it("sem link na fonte, usa o nome entre aspas", () => {
    const c = cartao(1);
    c.acao.urlOrigem = null;
    expect(instrucaoCurta(c, valores).texto).toContain('para a ação de formação "Imersão UX"');
  });
});
