import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { log } from "../log";

/**
 * Envio de email. Dois transportes, escolhidos pelas variáveis de ambiente:
 *
 * 1. SMTP (o mesmo que o Hub TheStarter usa): SMTP_USER e SMTP_PASS definidos.
 *    Por defeito smtp.gmail.com:587 com a conta people@thestarter.io e uma
 *    palavra-passe de aplicação do Google. SMTP_HOST, SMTP_PORT e SMTP_SECURE
 *    são opcionais.
 * 2. Resend: RESEND_API_KEY definida e sem SMTP.
 *
 * Sem nenhum dos dois, o email é só registado no log (desenvolvimento).
 * O remetente é EMAIL_DE, ou "Fluxo <SMTP_USER>", ou fluxo@<domínio>.
 */

type EnviarArgs = {
  para: string | string[];
  assunto: string;
  html?: string;
  texto?: string;
  cc?: string | string[];
  bcc?: string | string[];
  origem?: string;
};

let transporteSmtp: Transporter | null = null;

function smtp(): Transporter | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  if (!transporteSmtp) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    // As palavras-passe de aplicação do Google são mostradas com espaços; o Gmail ignora-os.
    const passLimpa = /gmail|google/i.test(host) ? pass.replace(/\s+/g, "") : pass;
    transporteSmtp = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: passLimpa },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporteSmtp;
}

function resend(): Resend | null {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return null;
  return new Resend(chave);
}

function remetente(args: EnviarArgs): string {
  if (args.origem) return args.origem;
  const explicito = process.env.EMAIL_DE?.trim();
  if (explicito) return explicito;
  const user = process.env.SMTP_USER?.trim();
  if (user) return `Fluxo <${user}>`;
  return `Fluxo <fluxo@${vercelDominio()}>`;
}

function lista(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export type Transporte = "smtp" | "resend" | "nenhum";

export interface ResultadoEnvio {
  ok: boolean;
  id?: string;
  transporte: Transporte;
  /** mensagem de erro do transporte, para diagnóstico (nunca inclui credenciais) */
  erro?: string;
  remetente: string;
}

/** Que transporte está configurado, sem enviar nada. */
export function transporteConfigurado(): Transporte {
  if (process.env.SMTP_USER?.trim() && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "nenhum";
}

export async function enviarEmail(args: EnviarArgs): Promise<ResultadoEnvio> {
  const de = remetente(args);
  const texto = args.texto ?? htmlParaTexto(args.html);

  const viaSmtp = smtp();
  if (viaSmtp) {
    try {
      const info = await viaSmtp.sendMail({
        from: de,
        to: lista(args.para),
        cc: lista(args.cc),
        bcc: lista(args.bcc),
        subject: args.assunto,
        text: texto,
        html: args.html,
      });
      const aceites = Array.isArray(info.accepted) ? info.accepted.length : 0;
      if (!aceites) {
        log.warn("smtp sem destinatários aceites", { assunto: args.assunto, resposta: info.response });
        return { ok: false, transporte: "smtp", erro: `SMTP não aceitou o destinatário: ${String(info.response ?? "")}`, remetente: de };
      }
      return { ok: true, id: info.messageId ? String(info.messageId) : undefined, transporte: "smtp", remetente: de };
    } catch (e) {
      const msg = (e as Error).message;
      log.error("smtp erro", { err: msg, assunto: args.assunto });
      return { ok: false, transporte: "smtp", erro: msg, remetente: de };
    }
  }

  const cliente = resend();
  if (!cliente) {
    log.warn("Sem SMTP_USER/SMTP_PASS nem RESEND_API_KEY — email simulado (dev)", {
      para: args.para,
      assunto: args.assunto,
    });
    return {
      ok: process.env.NODE_ENV !== "production",
      id: "DEV-SEM-TRANSPORTE",
      transporte: "nenhum",
      erro: "Sem transporte configurado: define SMTP_USER e SMTP_PASS (ou RESEND_API_KEY) e volta a fazer deploy.",
      remetente: de,
    };
  }

  try {
    const argsEnvio: Record<string, unknown> = {
      from: de,
      to: lista(args.para),
      subject: args.assunto,
      text: texto,
    };
    if (args.cc) argsEnvio.cc = lista(args.cc);
    if (args.bcc) argsEnvio.bcc = lista(args.bcc);
    if (args.html) argsEnvio.html = args.html;
    const resultado = await (cliente.emails.send as any)(argsEnvio);
    if ((resultado as any).error) {
      log.error("resend erro", { err: (resultado as any).error });
      const err = (resultado as any).error;
      return { ok: false, transporte: "resend", erro: typeof err?.message === "string" ? err.message : JSON.stringify(err), remetente: de };
    }
    return { ok: true, id: resultado.data?.id ?? undefined, transporte: "resend", remetente: de };
  } catch (e) {
    log.error("resend excecao", { err: e });
    return { ok: false, transporte: "resend", erro: (e as Error).message, remetente: de };
  }
}

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
