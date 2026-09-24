import { describe, expect, it } from "vitest";
import { campoDesconhecido } from "../lib/dados/airtable";

describe("adaptador Airtable: campo inexistente (422 UNKNOWN_FIELD_NAME)", () => {
  it("lê o nome do campo do corpo JSON real do Airtable", () => {
    const corpo = '{"error":{"type":"UNKNOWN_FIELD_NAME","message":"Unknown field name: \\"Nº Formandos\\""}}';
    expect(campoDesconhecido({ status: 422, corpo })).toBe("Nº Formandos");
  });
  it("aceita o corpo como texto truncado", () => {
    const corpo = 'Airtable HTTP 422 — {"error":{"type":"UNKNOWN_FIELD_NAME","message":"Unknown field name: \\"Tem Avaliações\\"';
    expect(campoDesconhecido({ status: 422, corpo })).toBe("Tem Avaliações");
  });
  it("ignora outros erros", () => {
    expect(campoDesconhecido({ status: 403, corpo: '{"error":{"type":"INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND"}}' })).toBeNull();
    expect(campoDesconhecido({ status: 422, corpo: '{"error":{"type":"INVALID_FILTER_BY_FORMULA","message":"x"}}' })).toBeNull();
    expect(campoDesconhecido(new Error("boom"))).toBeNull();
  });
});

describe("adaptador Airtable: registos ligados à ação por id", () => {
  it("um registo cujo campo de ligação traz o id do registo da ação é atribuído a essa ação", async () => {
    const { criarAirtable } = await import("../lib/dados/airtable");
    const chamadas: string[] = [];
    const fetchFalso = async (url: string) => {
      chamadas.push(url);
      const corpo = url.includes("Logs")
        ? { records: [{ id: "recLog1AAAAAAAAAA", createdTime: "2026-07-29T23:22:43.000Z", fields: { "Ação de Formação": ["recAcao1AAAAAAAAA"], Flow: "Flow 0 (Data Collection)", Status: "Success", Details: "ok" } }] }
        : { records: [{ id: "recAcao1AAAAAAAAA", fields: { Name: "Ação X", "Código Curso": "C1", "Start date": "2026-06-29", "End Date": "2026-06-30", Estado: "Ativo", Formato: "Curso", Ano: "2026" } }] };
      return new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const original = globalThis.fetch;
    globalThis.fetch = fetchFalso as unknown as typeof fetch;
    try {
      const fonte = criarAirtable({ baseId: "appTESTE000000000", token: "t", tabelaAcoes: "Acoes", tabelaRegistos: "Logs" });
      const registos = await fonte.obterRegistos();
      expect(registos).toHaveLength(1);
      expect(registos[0]).toMatchObject({ acaoId: "recAcao1AAAAAAAAA", flow: 0, estado: "success", data: "2026-07-29" });
    } finally {
      globalThis.fetch = original;
    }
  });
});
