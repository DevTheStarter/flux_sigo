import { Resend } from "resend";
import { log } from "../log";

type EnviarArgs = {
  para: string | string[];
  assunto: string;
  html?: string;
  texto?: string;
  cc?: string | string[];
  bcc?: string | string[];
  origem?: string;
};

function resend(): Resend | null {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return null;
  return new Resend(chave);
}

export async function enviarEmail(args: EnviarArgs): Promise<{ ok: boolean; id?: string }> {
  const cliente = resend();
  if (!cliente) {
    log.warn("RESEND_API_KEY não definida — email simulado (dev)", {
      para: args.para,
      assunto: args.assunto,
    });
    return { ok: true, id: "DEV-NO-RESEND" };
  }

  try {
    const de = args.origem ?? process.env.EMAIL_DE?.trim() ?? `Fluxo <fluxo@${vercelDominio()}>`;
    const texto = args.texto ?? htmlParaTexto(args.html);
    const argsEnvio: Record<string, unknown> = {
      from: de,
      to: Array.isArray(args.para) ? args.para : [args.para],
      subject: args.assunto,
      text: texto,
    };
    if (args.cc) argsEnvio.cc = Array.isArray(args.cc) ? args.cc : [args.cc];
    if (args.bcc) argsEnvio.bcc = Array.isArray(args.bcc) ? args.bcc : [args.bcc];
    if (args.html) argsEnvio.html = args.html;
    const resultado = await (cliente.emails.send as any)(argsEnvio);
    if ((resultado as any).error) {
      log.error("resend erro", { err: (resultado as any).error });
      return { ok: false };
    }
    return { ok: true, id: resultado.data?.id ?? undefined };
  } catch (e) {
    log.error("resend excecao", { err: e });
    return { ok: false };
  }
}

/**
 * Remetente por defeito quando EMAIL_DE não está definido. O Resend só aceita
 * domínios verificados, por isso em produção EMAIL_DE deve ser algo como
 * "Fluxo <fluxo@thestarter.io>" com o domínio verificado no Resend.
 */
function vercelDominio(): string {
  if (process.env.VERCEL_URL) {
    try {
      return new URL(`https://${process.env.VERCEL_URL}`).hostname;
    } catch {
      return "thestarter.io";
    }
  }
  return "thestarter.io";
}

function htmlParaTexto(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
