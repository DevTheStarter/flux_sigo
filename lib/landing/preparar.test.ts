import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepararLanding } from "./preparar";

const HTML = readFileSync(join(process.cwd(), "app", "landing.html"), "utf8");

describe("landing", () => {
  it("aplica o nonce a todos os scripts", () => {
    const out = prepararLanding(HTML, "abc123");
    const scripts = out.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(s).toContain('nonce="abc123"');
    expect(out).not.toContain("__NONCE__");
  });

  it("sem nonce, remove o atributo em vez de deixar o marcador", () => {
    const out = prepararLanding(HTML, null);
    expect(out).not.toContain("nonce=");
    expect(out).toContain("<script>");
  });

  it("não depende de nada que a CSP bloqueie", () => {
    // handlers inline e recursos externos são bloqueados por script-src / font-src.
    expect(HTML).not.toMatch(/\son(click|input|change|load)=/);
    expect(HTML).not.toContain("googleapis.com");
    expect(HTML).not.toContain("gstatic.com");
  });

  it("é uma cópia da base, à parte das adaptações à CSP", () => {
    const base = readFileSync(join(process.cwd(), "base", "landing_page_index.html"), "utf8");
    // O corpo (markup) só difere nos handlers inline substituídos por data-atributos.
    const corpo = (h: string) => h.slice(h.indexOf("<body>"), h.indexOf("<script", h.indexOf("<body>")));
    const normal = (h: string) =>
      corpo(h)
        .replace(/ onclick="verLogin\(\)"/g, " data-entrar")
        .replace(/ oninput="calcular\(this\.value,null,null\)"/g, ' data-cc="a"')
        .replace(/ oninput="calcular\(null,this\.value,null\)"/g, ' data-cc="f"')
        .replace(/ oninput="calcular\(null,null,this\.value\)"/g, ' data-cc="c"');
    expect(normal(HTML)).toBe(normal(base));
    // O CSS é idêntico.
    const css = (h: string) => h.slice(h.lastIndexOf("<style>"), h.indexOf("</style>", h.lastIndexOf("<style>")));
    expect(css(HTML)).toBe(css(base));
  });
});
