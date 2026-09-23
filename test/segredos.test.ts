import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CartaoQuadro } from "../app/api/quadro/route";
import { CHAVE_LOCAL } from "../lib/cliente/segredos";

/**
 * §8.4: SIGO_PALAVRA e CRM_TOKEN vivem só no navegador e nunca entram num pedido.
 * Estes testes falham se algum caminho de saída de dados (instrução curta, linha
 * de update de config_entidade) contiver os valores, e se código do servidor
 * passar a conhecer os nomes destas chaves.
 */

const PALAVRA = "palavra-secreta-sigo-XYZ";
const TOKEN = "patSegredoDosFlows.abcdefghijklmnopqrstuvwxyz";

function localStorageFalso(dados: Record<string, string>) {
  const store = new Map(Object.entries(dados));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

const cartao: CartaoQuadro = {
  id: "recA",
  col: 1,
  estado: "ok",
  dias: 3,
  feitas: {},
  acao: {
    id: "recA",
    nome: "Ação de teste",
    codigoCurso: "C-1",
    dataInicio: "2026-01-05",
    dataFim: "2026-03-01",
    tipo: "Presencial",
    formato: "PT",
    diasSemana: null,
    estado: "Ativa",
    ano: 2026,
    formandos: 10,
    temAvaliacoes: true,
    urlOrigem: null,
  },
};

describe("§8.4 segredos só no navegador", () => {
  beforeEach(() => {
    (globalThis as any).window = {
      localStorage: localStorageFalso({ [CHAVE_LOCAL]: JSON.stringify({ SIGO_PALAVRA: PALAVRA, CRM_TOKEN: TOKEN }) }),
    };
  });
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("a instrução curta nunca contém a palavra-passe nem o token, mesmo com valores e localStorage preenchidos", async () => {
    const { instrucaoCurta } = await import("../lib/cliente/instrucao");
    const valores = { SIGO_URL: "https://sigo.example", SIGO_UTILIZADOR: "u", CRM_TIPO: "Airtable", CRM_BASE: "appX", SIGO_PALAVRA: PALAVRA, CRM_TOKEN: TOKEN };
    const { texto } = instrucaoCurta(cartao, valores);
    expect(texto).not.toContain(PALAVRA);
    expect(texto).not.toContain(TOKEN);
    expect(texto).toContain("https://sigo.example");
  });

  it("substituir sem incluirSegredos deixa as etiquetas, mesmo que os valores tragam os segredos", async () => {
    const { substituir } = await import("../lib/cliente/variaveis");
    const doc = "Login {{SIGO_UTILIZADOR}} / {{SIGO_PALAVRA}} · token {{CRM_TOKEN}}";
    const r = substituir(doc, { SIGO_UTILIZADOR: "u", SIGO_PALAVRA: PALAVRA, CRM_TOKEN: TOKEN }, false);
    expect(r.texto).toBe("Login u / {{SIGO_PALAVRA}} · token {{CRM_TOKEN}}");
  });

  it("só a cópia de um documento completo (cliente) substitui os segredos, e lê-os do navegador", async () => {
    const { substituir } = await import("../lib/cliente/variaveis");
    const r = substituir("{{SIGO_PALAVRA}}|{{CRM_TOKEN}}", {}, true);
    expect(r.texto).toBe(`${PALAVRA}|${TOKEN}`);
  });

  it("a linha de update de config_entidade nunca leva os segredos", async () => {
    const { updateDaConfig } = await import("../lib/cliente/variaveis");
    const row = updateDaConfig({ SIGO_URL: "https://sigo.example", SIGO_PALAVRA: PALAVRA, CRM_TOKEN: TOKEN });
    const json = JSON.stringify(row);
    expect(json).not.toContain(PALAVRA);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("SIGO_PALAVRA");
    expect(json).not.toContain("CRM_TOKEN");
  });
});

function ficheiros(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(p, out);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

describe("o servidor não conhece os segredos do navegador", () => {
  it("nenhum ficheiro de app/api, lib/dados, lib/cron ou lib/email refere SIGO_PALAVRA ou CRM_TOKEN", () => {
    const raiz = join(__dirname, "..");
    const alvo = ["app/api", "lib/dados", "lib/cron", "lib/email", "lib/supabase"].flatMap((d) => ficheiros(join(raiz, d)));
    expect(alvo.length).toBeGreaterThan(5);
    const culpados = alvo.filter((f) => /SIGO_PALAVRA|CRM_TOKEN/.test(readFileSync(f, "utf8")));
    expect(culpados).toEqual([]);
  });

  it("o único componente que lê os segredos grava no servidor apenas via updateDaConfig", () => {
    const raiz = join(__dirname, "..");
    const src = readFileSync(join(raiz, "components/definicoes/Credenciais.tsx"), "utf8");
    expect(src).toContain("lerSegredos");
    const escritas = src.match(/\.(upsert|insert|update)\(([^)]*)\)/g) ?? [];
    expect(escritas.length).toBeGreaterThan(0);
    for (const e of escritas) expect(e).toContain("updateDaConfig(");
    // qualquer fetch aqui é uma leitura de estado, sem corpo
    for (const f of src.match(/fetch\([^)]*\)/g) ?? []) {
      expect(f).not.toMatch(/method|body/);
    }
  });
});
