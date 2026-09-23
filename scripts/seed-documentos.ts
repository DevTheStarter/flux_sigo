/**
 * Seed dos documentos base (§13.3).
 *
 *   npm run seed:docs            # lê docs/flows/*.md e publica
 *   npm run seed:docs -- --dry   # só valida e mostra o que faria
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 *
 * Cada ficheiro em docs/flows/ é convertido de markdown para o subconjunto de
 * HTML dos documentos e inserido ou atualizado em `documentos` pelo nome
 * (sem extensão). A versão vem da primeira linha `<!-- versao: v1.2 -->` ou,
 * na falta dela, de `v1.0`. O flow vem do nome `flow-N-...`.
 *
 * O script FALHA se algum ficheiro contiver algo parecido com uma credencial
 * real: id de base ou tabela do Airtable, token pessoal, palavra-passe ou URL
 * de login do SIGO. Os ficheiros têm de estar templatizados com {{CHAVE}} (§8.2).
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { mdParaHtml } from "../lib/docs/markdown";
import { sanitizarHtml } from "../lib/docs/sanitizar";

const PASTA = join(__dirname, "..", "docs", "flows");
const DRY = process.argv.includes("--dry");

const PADROES_PROIBIDOS: [string, RegExp][] = [
  ["id de base Airtable", /\bapp[A-Za-z0-9]{14}\b/],
  ["id de tabela Airtable", /\btbl[A-Za-z0-9]{14}\b/],
  ["id de vista Airtable", /\bviw[A-Za-z0-9]{14}\b/],
  ["token pessoal Airtable", /\bpat[A-Za-z0-9.]{20,}/],
  ["token key Airtable", /\bkey[A-Za-z0-9]{14}\b/],
  ["URL do SIGO", /https?:\/\/[^\s)]*sigo[^\s)]*/i],
  ["palavra-passe em claro", /(palavra-passe|password|senha)\s*[:=]\s*\S{4,}/i],
];

const CHAVES_CONHECIDAS = new Set([
  "SIGO_URL", "SIGO_UTILIZADOR", "SIGO_PALAVRA", "CRM_TIPO", "CRM_BASE", "CRM_TOKEN",
  "TBL_ACOES", "TBL_FORMANDOS", "TBL_LOGS", "AREA_FORMACAO", "REGIME",
]);

function versaoDe(md: string): string {
  const m = /<!--\s*versao:\s*(v[\d.]+)\s*-->/i.exec(md);
  return m ? m[1] : "v1.0";
}

function flowDe(nome: string): number | null {
  const m = /^flow-(\d)/.exec(nome);
  return m ? Number(m[1]) : null;
}

function validar(nome: string, md: string): string[] {
  const erros: string[] = [];
  for (const [rotulo, rx] of PADROES_PROIBIDOS) {
    const m = rx.exec(md);
    if (m) erros.push(`${nome}: ${rotulo} em claro ("${m[0].slice(0, 24)}…")`);
  }
  for (const m of md.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) {
    if (!CHAVES_CONHECIDAS.has(m[1])) erros.push(`${nome}: variável desconhecida {{${m[1]}}} (não está em §8.2)`);
  }
  return erros;
}

async function main() {
  let ficheiros: string[];
  try {
    ficheiros = readdirSync(PASTA).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md").sort();
  } catch {
    console.error(`Pasta ${PASTA} não existe. Coloca lá os sete ficheiros templatizados.`);
    process.exit(1);
  }
  if (!ficheiros.length) {
    console.error(`Sem ficheiros .md em ${PASTA}.`);
    process.exit(1);
  }

  const docs: { nome: string; versao: string; flow: number | null; corpo: string }[] = [];
  const erros: string[] = [];
  for (const f of ficheiros) {
    const md = readFileSync(join(PASTA, f), "utf8");
    const nome = basename(f, ".md");
    erros.push(...validar(nome, md));
    docs.push({ nome, versao: versaoDe(md), flow: flowDe(nome), corpo: sanitizarHtml(mdParaHtml(md)) });
  }
  if (erros.length) {
    console.error("Seed recusado. Nada foi escrito.\n" + erros.map((e) => `  - ${e}`).join("\n"));
    process.exit(2);
  }

  for (const d of docs) console.log(`${DRY ? "[dry] " : ""}${d.nome} · ${d.versao} · flow ${d.flow ?? "-"} · ${d.corpo.length} chars`);
  if (DRY) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.");
    process.exit(1);
  }
  const sb = createClient(url, chave, { auth: { persistSession: false } });
  const agora = new Date().toISOString();
  for (const d of docs) {
    const existente = await sb.from("documentos").select("id, versao").eq("nome", d.nome).maybeSingle();
    if (existente.error) throw existente.error;
    const row = { nome: d.nome, versao: d.versao, flow: d.flow, corpo: d.corpo, publicado: true, atualizado_em: agora };
    const r = existente.data
      ? await sb.from("documentos").update(row).eq("id", (existente.data as { id: string }).id)
      : await sb.from("documentos").insert(row);
    if (r.error) throw r.error;
    console.log(`${existente.data ? "atualizado" : "criado"}: ${d.nome} (${(existente.data as { versao?: string } | null)?.versao ?? "novo"} → ${d.versao})`);
  }
  // Placeholders da migração 0004 que não tenham ficheiro correspondente ficam como estão.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
