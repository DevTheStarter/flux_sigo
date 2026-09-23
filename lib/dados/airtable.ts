import type { Acao, EstadoLigacao, FonteDeDados, Registo } from "./interface";
import { log } from "../log";
import { MAPA_PADRAO, nomeNaFonte } from "./mapa";

/**
 * Adaptador Airtable read-only.
 *
 * ❗ NÃO REMOVER a query `fields[]` dos pedidos. ❗
 * A documentação do flow Airtable proíbe fields[] em writes porque pode
 * limpar anexos num PATCH; esse risco NÃO EXISTE em GET read-only, e aqui
 * fields[] É EXATAMENTE o mecanismo de whitelist que garante que a tabela
 * de Formandos (ou qualquer outra coluna não autorizada) NUNCA é lida,
 * mesmo que o token do cliente dê acesso a tudo. Ver §7.3 última nota.
 */

export interface AirtableCfg {
  baseId: string;
  token: string;
  tabelaAcoes?: string;
  tabelaRegistos?: string;
  /** só para verificarLigacao(): se estiver acessível é um aviso de configuração (§7.2) */
  tabelaFormandos?: string;
  /** nome do nosso campo → nome do campo no Airtable da entidade */
  mapaCampos?: Record<string, string>;
  /** { campo: valor } ou { campo: { $neq: valor } } ou { campo: { $in: [x,y] } } */
  filtros?: Record<string, unknown>;
  /** defaults TheStarter: se for cliente, mapa_campos e filtros vêm de config_entidade. */
}

const CAMPOS_NOSSOS_ACAO = [
  "nome",
  "codigoCurso",
  "dataInicio",
  "dataFim",
  "tipo",
  "formato",
  "diasSemana",
  "estado",
  "ano",
  "formandos",
  "temAvaliacoes",
] as const;

const CAMPOS_NOSSOS_REGISTO = [
  "r_acaoId",
  "r_flow",
  "r_estado",
  "r_detalhe",
] as const;


const FLOW: Record<string, number> = {
  "Flow 0 (Data Collection)": 0,
  "Flow 0": 0,
  "Flow 1 (Profile)": 1,
  "Flow 1": 1,
  "Flow 2 (Course)": 2,
  "Flow 2": 2,
  "Flow 3 (Ação)": 3,
  "Flow 3": 3,
  "Flow 4 (Enrollment)": 4,
  "Flow 4": 4,
  "Flow 5 (PDF & Concluir)": 5,
  "Flow 5": 5,
};

const ESTADO: Record<string, "success" | "missing_data" | "error"> = {
  Success: "success",
  "Missing Data": "missing_data",
  Error: "error",
};

const TBL_ACOES_PADRAO = "Ações de formação";
const TBL_REGISTOS_PADRAO = "Logs de execução";

const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry<T> = { data: T; ate: number; lida: number };
const cache = new Map<string, CacheEntry<unknown>>();

/** Limpa a cache de uma base (Definições → "Sincronizar agora"). Só memória. */
export function invalidarCache(baseId: string) {
  cache.delete(`at:${baseId}`);
}

/** Instante da última leitura em cache para esta base, ou null. Best-effort em serverless. */
export function ultimaLeituraDe(baseId: string): string | null {
  const e = cache.get(`at:${baseId}`);
  return e ? new Date(e.lida).toISOString() : null;
}

function cacheGet<T>(k: string): T | undefined {
  const e = cache.get(k) as CacheEntry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() > e.ate) {
    cache.delete(k);
    return undefined;
  }
  return e.data;
}
function cacheSet<T>(k: string, data: T, ttl: number = CACHE_TTL_MS) {
  cache.set(k, { data, ate: Date.now() + ttl, lida: Date.now() });
}

function urlB64(s: string): string {
  return encodeURIComponent(s);
}

function buildFieldsQuery(mapa: Record<string, string>, nossos: readonly string[]): string {
  const parts: string[] = [];
  for (const n of nossos) {
    const campo = mapa[n] ?? MAPA_PADRAO[n];
    if (!campo) continue;
    parts.push(`fields[]=${urlB64(campo)}`);
  }
  return parts.join("&");
}

function mapBack(
  rec: { fields: Record<string, unknown>; id: string; createdTime?: string },
  mapa: Record<string, string>,
  nossos: readonly string[]
): { id: string; ours: Record<string, unknown>; createdTime?: string } {
  const invert: Record<string, string> = {};
  for (const n of nossos) invert[mapa[n] ?? MAPA_PADRAO[n] ?? n] = n;
  const ours: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec.fields)) {
    if (invert[k]) ours[invert[k]] = v;
  }
  return { id: rec.id, ours, createdTime: rec.createdTime };
}

function dataAirtableParaIso(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    return v;
  }
  if (Array.isArray(v) && v.length) return dataAirtableParaIso(v[0]);
  return String(v ?? "");
}

function numero(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim();
  const n = Number(s.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function booleano(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "nao" && s !== "não" && s !== "false" && s !== "no";
}

/**
 * Conta formandos a partir de 9 colunas de links separadas por vírgulas
 * (campos Formandos, Formandos 2 … Formandos 9). Se a entidade criou o
 * campo calculado "Nº Formandos", devolve esse valor diretamente.
 */
function contarFormandos(raw: Record<string, unknown>, mapa: Record<string, string>): number {
  const key = mapa["formandos"] ?? MAPA_PADRAO["formandos"];
  if (key && raw[key] !== undefined && raw[key] !== null && raw[key] !== "") {
    const n = numero(raw[key], -1);
    if (n >= 0) return n;
  }
  // fallback: contar por vírgulas nos 9 campos individuais
  let total = 0;
  for (let i = 1; i <= 9; i++) {
    const colName = i === 1 ? "Formandos" : `Formandos ${i}`;
    const rawVal = raw[colName];
    if (!rawVal) continue;
    const s = Array.isArray(rawVal) ? rawVal.join(",") : String(rawVal);
    if (!s.trim()) continue;
    total += (s.match(/,/g) ?? []).length + 1;
  }
  return total;
}

function temAvaliacoesField(raw: Record<string, unknown>, mapa: Record<string, string>): boolean {
  const key = mapa["temAvaliacoes"] ?? MAPA_PADRAO["temAvaliacoes"];
  if (key && raw[key] !== undefined) return booleano(raw[key]);
  return Object.keys(raw).some(
    (k) => /avaliaç[õo]es/i.test(k) && raw[k] !== undefined && raw[k] !== null && raw[k] !== ""
  );
}

function converterRegisto(
  linha: { fields: Record<string, unknown>; id: string; createdTime?: string },
  mapa: Record<string, string>,
  acaoNameToId: Map<string, string>
): Registo | null {
  const { ours, createdTime } = mapBack(linha, mapa, CAMPOS_NOSSOS_REGISTO);
  const raw = linha.fields;
  let acaoId: string | undefined;
  const linkField = mapa["r_acaoId"] ?? MAPA_PADRAO["r_acaoId"];
  const linkVal = raw[linkField];
  if (Array.isArray(linkVal)) {
    const primeiro = linkVal[0];
    if (primeiro && typeof primeiro === "object" && (primeiro as any).id) {
      acaoId = (primeiro as any).id;
    } else if (primeiro) {
      acaoId = acaoNameToId.get(String(primeiro));
    }
  } else if (typeof linkVal === "string" && linkVal) {
    acaoId = acaoNameToId.get(linkVal);
  }
  if (!acaoId) return null;

  const flowRaw = ours["r_flow"] ?? raw[mapa["r_flow"] ?? MAPA_PADRAO["r_flow"]];
  let flowNum: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
  if (typeof flowRaw === "number" && flowRaw >= 0 && flowRaw <= 5) {
    flowNum = flowRaw as 0 | 1 | 2 | 3 | 4 | 5;
  } else if (typeof flowRaw === "string" && FLOW[flowRaw] !== undefined) {
    flowNum = FLOW[flowRaw] as 0 | 1 | 2 | 3 | 4 | 5;
  }
  if (flowNum === undefined) {
    log.warn("Airtable flow desconhecido", { flow: flowRaw, linha: linha.id });
    return null;
  }

  const estadoRaw = ours["r_estado"] ?? raw[mapa["r_estado"] ?? MAPA_PADRAO["r_estado"]];
  const estado =
    typeof estadoRaw === "string" && ESTADO[estadoRaw] !== undefined
      ? ESTADO[estadoRaw]
      : ("error" as const);
  if (typeof estadoRaw === "string" && !ESTADO[estadoRaw]) {
    log.warn("Airtable estado log desconhecido", { raw: estadoRaw, linha: linha.id });
  }

  const detalhe = String(ours["r_detalhe"] ?? "");
  let data = "";
  if (createdTime) data = createdTime.slice(0, 10);
  if (!data) data = new Date().toISOString().slice(0, 10);

  return { acaoId, flow: flowNum, estado, data, detalhe };
}

async function airtableFetch(
  token: string,
  path: string
): Promise<{ records: any[]; offset?: string }> {
  const url = `https://api.airtable.com/v0${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Airtable HTTP ${res.status} ${res.statusText} — ${corpo.slice(0, 200)}`);
  }
  return res.json();
}

async function listarTodos(
  token: string,
  baseId: string,
  tabela: string,
  fieldsQuery: string,
  filtros?: Record<string, unknown>,
  cellFormatJson = false,
  mapa: Record<string, string> = {}
): Promise<any[]> {
  const todos: any[] = [];
  let offset: string | undefined;
  do {
    const extra = new URLSearchParams();
    if (offset) extra.set("offset", offset);
    if (cellFormatJson) extra.set("cellFormat", "json");
    if (filtros && Object.keys(filtros).length) {
      const formula = filtrosParaFormula(filtros, mapa);
      if (formula) extra.set("filterByFormula", formula);
    }
    const qs = [fieldsQuery, extra.toString()].filter(Boolean).join("&");
    const sep = qs ? "?" : "";
    const path = `/${encodeURIComponent(baseId)}/${encodeURIComponent(tabela)}${sep}${qs}`;
    const r = await airtableFetch(token, path);
    todos.push(...(r.records ?? []));
    offset = r.offset;
  } while (offset);
  return todos;
}

/**
 * As chaves dos filtros são os nossos nomes de campo (§7.3: estado, formato) e
 * são traduzidas pelo mapa da entidade. Chaves desconhecidas passam tal como estão.
 */
function filtrosParaFormula(filtros: Record<string, unknown>, mapa: Record<string, string>): string {
  const partes: string[] = [];
  for (const [chave, v] of Object.entries(filtros)) {
    if (v === null || v === undefined || v === "") continue;
    const campo = nomeNaFonte(mapa, chave);
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      if ("$in" in obj && Array.isArray(obj["$in"])) {
        const opts = (obj["$in"] as unknown[]);
        const joined = opts.map((x) => `'${escapeAirtable(String(x))}'`).join(",");
        partes.push(`FIND({${campo}},${joined}&"")>0`);
      } else if ("$neq" in obj) {
        partes.push(`{${campo}} != '${escapeAirtable(String(obj["$neq"]))}'`);
      }
      continue;
    }
    partes.push(`{${campo}} = '${escapeAirtable(String(v))}'`);
  }
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0];
  return `AND(${partes.join(",")})`;
}

function escapeAirtable(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function criarAirtable(cfg: AirtableCfg): FonteDeDados {
  const mapa = cfg.mapaCampos ?? {};
  const baseId = cfg.baseId;
  const token = cfg.token;
  const tblAcoes = cfg.tabelaAcoes ?? TBL_ACOES_PADRAO;
  const tblRegistos = cfg.tabelaRegistos ?? TBL_REGISTOS_PADRAO;
  const filtros = cfg.filtros;

  const cacheKey = `at:${baseId}`;

  function converterAcaoLocal(linha: { fields: Record<string, unknown>; id: string }): Acao {
    const raw = linha.fields;
    const { ours } = mapBack(linha, mapa, CAMPOS_NOSSOS_ACAO);
    const id = linha.id;
    const ano = numero(ours["ano"]);
    return {
      id,
      nome: String(ours["nome"] ?? raw["Name"] ?? ""),
      codigoCurso: String(ours["codigoCurso"] ?? ""),
      dataInicio: dataAirtableParaIso(ours["dataInicio"]) || dataAirtableParaIso(raw["Start date"]),
      dataFim: dataAirtableParaIso(ours["dataFim"]) || dataAirtableParaIso(raw["End Date"]),
      tipo: String(ours["tipo"] ?? ""),
      formato: String(ours["formato"] ?? ""),
      diasSemana: ours["diasSemana"] !== undefined ? String(ours["diasSemana"]) : null,
      estado: String(ours["estado"] ?? "Desconhecido"),
      ano: ano || new Date().getFullYear(),
      formandos: contarFormandos(raw, mapa),
      temAvaliacoes: temAvaliacoesField(raw, mapa),
      urlOrigem: `https://airtable.com/${urlB64(baseId)}/${urlB64(tblAcoes)}/${id}`,
    };
  }

  const self: FonteDeDados = {
    async obterAcoes(): Promise<Acao[]> {
      const cached = cacheGet<{ acoes: Acao[]; acaoNameId: Map<string, string> }>(cacheKey);
      if (cached) return cached.acoes;
      const camposQs = buildFieldsQuery(mapa, CAMPOS_NOSSOS_ACAO);
      // Colunas de recurso da base TheStarter (Formandos 1..9, Tabela Avaliações),
      // só quando a entidade não mapeou os dois campos calculados. Numa base com
      // outros nomes, pedir colunas inexistentes faria a leitura falhar.
      const extras: string[] = [];
      if (!mapa["formandos"] && !mapa["temAvaliacoes"]) {
        for (let i = 1; i <= 9; i++) extras.push(`fields[]=${urlB64(i === 1 ? "Formandos" : `Formandos ${i}`)}`);
        extras.push(`fields[]=${urlB64("Tabela Avaliações")}`);
      }
      const qsAcoes = [camposQs, ...extras].filter(Boolean).join("&");
      const recs = await listarTodos(token, baseId, tblAcoes, qsAcoes, filtros, false, mapa);
      const acoes: Acao[] = [];
      const acaoNameId = new Map<string, string>();
      for (const rec of recs) {
        const a = converterAcaoLocal(rec);
        acoes.push(a);
        acaoNameId.set(a.nome, a.id);
      }
      cacheSet(cacheKey, { acoes, acaoNameId });
      return acoes;
    },

    async obterRegistos(): Promise<Registo[]> {
      const cached = cacheGet<{ acoes: Acao[]; acaoNameId: Map<string, string> }>(cacheKey);
      let acaoNameId: Map<string, string>;
      if (cached) acaoNameId = cached.acaoNameId;
      else {
        await self.obterAcoes();
        const refetch = cacheGet<{ acoes: Acao[]; acaoNameId: Map<string, string> }>(cacheKey);
        acaoNameId = refetch!.acaoNameId;
      }
      const camposQs = buildFieldsQuery(mapa, CAMPOS_NOSSOS_REGISTO);
      const recs = await listarTodos(token, baseId, tblRegistos, camposQs, undefined, true);
      const out: Registo[] = [];
      for (const rec of recs) {
        const r = converterRegisto(rec, mapa, acaoNameId);
        if (r) out.push(r);
      }
      return out;
    },

    async contarAcoes(): Promise<number> {
      return (await self.obterAcoes()).length;
    },

    async verificarLigacao(): Promise<EstadoLigacao> {
      try {
        const agora = new Date().toISOString();
        const path = `/${encodeURIComponent(baseId)}/${encodeURIComponent(tblAcoes)}?maxRecords=1`;
        await airtableFetch(token, path);
        const pathLogs = `/${encodeURIComponent(baseId)}/${encodeURIComponent(tblRegistos)}?maxRecords=1`;
        await airtableFetch(token, pathLogs);
        // §7.2: a tabela de formandos estar acessível é um aviso de configuração, não sucesso.
        // Nada é lido dela: maxRecords=1 e a resposta é descartada.
        let aviso: string | null = null;
        if (cfg.tabelaFormandos) {
          try {
            const pathF = `/${encodeURIComponent(baseId)}/${encodeURIComponent(cfg.tabelaFormandos)}?maxRecords=1&fields[]=`;
            await airtableFetch(token, pathF);
            aviso =
              "A credencial consegue ler a tabela de formandos. Recomendamos um token só de leitura restrito às duas tabelas.";
          } catch {
            aviso = null;
          }
        }
        return { ok: true, ultimaLeitura: agora, erro: null, aviso };
      } catch (e: any) {
        return { ok: false, ultimaLeitura: null, erro: e?.message ?? String(e), aviso: null };
      }
    },
  };
  return self;
}
