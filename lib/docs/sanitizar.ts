/**
 * Limpeza mínima do subconjunto de HTML dos documentos antes de o injetar no leitor.
 * Remove scripts, estilos, handlers inline e URLs javascript:.
 */
const TAGS_PERMITIDAS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "b", "strong", "i", "em", "code", "pre",
  "a", "hr", "br", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "blockquote",
]);

export function sanitizarHtml(html: string): string {
  let s = html.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!TAGS_PERMITIDAS.has(t)) return "";
    if (m.startsWith("</")) return `</${t}>`;
    let limpos = "";
    const rx = /([a-z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
    let a: RegExpExecArray | null;
    while ((a = rx.exec(attrs))) {
      const nome = a[1].toLowerCase();
      const valor = a[2].replace(/^["']|["']$/g, "");
      if (nome.startsWith("on")) continue;
      if (nome === "href" && /^\s*javascript:/i.test(valor)) continue;
      if (!["href", "class", "title", "target", "rel", "colspan", "rowspan"].includes(nome)) continue;
      limpos += ` ${nome}="${valor.replace(/"/g, "&quot;")}"`;
    }
    if (t === "a" && /href=/.test(limpos)) limpos += ' target="_blank" rel="noopener noreferrer"';
    return `<${t}${limpos}>`;
  });
  return s;
}

/** Texto simples a partir do HTML: fecho de blocos vira nova linha. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<\/(p|h[1-6]|li|tr|div|pre|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " · ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** O corpo pode vir em markdown (seed) ou no subconjunto de HTML. */
export function pareceHtml(corpo: string): boolean {
  return /<(h[1-6]|p|ul|ol|div|table)\b/i.test(corpo);
}
