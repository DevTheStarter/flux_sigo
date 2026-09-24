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
