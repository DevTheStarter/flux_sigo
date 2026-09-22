/**
 * Markdown super-subset, sem dependências.
 * Apenas: h1-h6, p, ul/ol, li, b, i, code inline, pre/code bloco, a,
 * hr, table thead/tbody tr th td.
 *
 * NUNCA aceita HTML cru — entidades são escapadas antes do parse.
 * Não é compliant GFM; serve para os 7 MDs de documentação do flow.
 */

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  // Inline code `x`
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${htmlEscape(c)}</code>`);
  // **negrito**
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<b>${inline(c)}</b>`);
  // __negrito__
  s = s.replace(/__([^_]+)__/g, (_m, c) => `<b>${inline(c)}</b>`);
  // *itálico*
  s = s.replace(/\*([^*\s][^*]*)\*/g, (_m, c) => `<i>${inline(c)}</i>`);
  // _itálico_
  s = s.replace(/_([^_\s][^_]*)_/g, (_m, c) => `<i>${inline(c)}</i>`);
  // [texto](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, txt, url, title) => {
      const href = htmlEscape(String(url));
      const t = title ? ` title="${htmlEscape(title)}"` : "";
      const safe = /^https?:\/\//i.test(href) || href.startsWith("#") ? href : "#";
      const rel = /^https?:\/\//i.test(safe) ? ' rel="noopener noreferrer" target="_blank"' : "";
      return `<a href="${safe}"${t}${rel}>${txt}</a>`;
    }
  );
  return s;
}

function renderTable(lines: string[]): string {
  const rows = lines
    .map((l) => l.replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").split(/\s*\|\s*/))
    .filter((r) => r.some((c) => c.trim() !== ""));
  if (!rows.length) return "";
  let header: string[] | null = null;
  let startBody = 1;
  if (rows.length > 1 && /^[-:|\s]+$/.test(rows[1].join("|"))) {
    header = rows[0];
    startBody = 2;
  }
  const head = header
    ? `<thead><tr>${header.map((c) => `<th>${inline(htmlEscape(c))}</th>`).join("")}</tr></thead>`
    : "";
  const bodyRows = rows.slice(startBody);
  const body = bodyRows.length
    ? `<tbody>${bodyRows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(htmlEscape(c))}</td>`).join("")}</tr>`)
        .join("")}</tbody>`
    : "";
  return `<table>${head}${body}</table>`;
}

export function mdParaHtml(src: string): string {
  const raw = src.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks: string[] = [];
  const linhas = raw.split(/\n\n+/);
  let i = 0;
  while (i < linhas.length) {
    let bloco = linhas[i].trim();
    if (!bloco) {
      i++;
      continue;
    }
    // Bloco código ```
    if (bloco.startsWith("```")) {
      const resto = linhas.slice(i).join("\n\n");
      const m = resto.match(/^```([\w-]*)\n([\s\S]*?)```/);
      if (m) {
        const code = htmlEscape(m[2].replace(/\n$/, ""));
        blocks.push(`<pre><code>${code}</code></pre>`);
        const consumidas = m[0].split(/\n\n+/).length;
        i += consumidas || 1;
        continue;
      }
    }
    // HR
    if (/^---+$/.test(bloco) || /^\*\*\*+$/.test(bloco)) {
      blocks.push("<hr/>");
      i++;
      continue;
    }
    // Headings
    const h = bloco.match(/^(#{1,6})\s+(.*)$/s);
    if (h) {
      const n = h[1].length;
      blocks.push(`<h${n}>${inline(htmlEscape(h[2].trim()))}</h${n}>`);
      i++;
      continue;
    }
    // Table: cada linha começa por |, tem pelo menos 1 separador no 2º bloco
    const linhasSeparadas = bloco.split("\n");
    if (linhasSeparadas.length >= 2 && linhasSeparadas.every((l) => l.includes("|"))) {
      blocks.push(renderTable(linhasSeparadas));
      i++;
      continue;
    }
    // Lista
    const linhasLista = bloco.split("\n");
    const todosListItem = linhasLista.every(
      (l) => /^\s*[-*+]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)
    );
    if (todosListItem && linhasLista.length > 0) {
      const ordered = /^\s*\d+\.\s+/.test(linhasLista[0]);
      const tag = ordered ? "ol" : "ul";
      const items = linhasLista
        .filter((l) => l.trim())
        .map((l) => {
          const conteudo = l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
          return `<li>${inline(htmlEscape(conteudo))}</li>`;
        })
        .join("");
      blocks.push(`<${tag}>${items}</${tag}>`);
      i++;
      continue;
    }
    // Parágrafo
    blocks.push(`<p>${inline(htmlEscape(bloco))}</p>`);
    i++;
  }
  return blocks.join("\n");
}
