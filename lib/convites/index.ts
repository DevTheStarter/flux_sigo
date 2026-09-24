import { enviarEmail } from "../email";
import { escaparHtml } from "../cron/quadro";

/** URL pública da aplicação, para links em emails (§16). */
export function urlBase(): string {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicita) return explicita.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function linkConvite(token: string): string {
  return `${urlBase()}/definir?convite=${encodeURIComponent(token)}`;
}

const ROTULO_FUNCAO: Record<string, string> = {
  admin: "administrador",
  gestor: "gestor",
  leitura: "leitura",
};

/**
 * Email de convite (§15, §16). Link válido 7 dias, uso único.
 * Devolve se o envio foi aceite pelo Resend. Sem RESEND_API_KEY, é só registado no log.
 */
export async function enviarEmailConvite(args: {
  para: string;
  token: string;
  entidadeNome: string;
  funcao: string;
  convidadoPor?: string | null;
}): Promise<{ ok: boolean; link: string }> {
  const link = linkConvite(args.token);
  const entidade = escaparHtml(args.entidadeNome);
  const funcao = ROTULO_FUNCAO[args.funcao] ?? args.funcao;
  const quem = args.convidadoPor ? ` por ${escaparHtml(args.convidadoPor)}` : "";

  const html =
    `<div style="font-family:Inter,Arial,sans-serif;color:#111;max-width:520px">` +
    `<p style="font-size:14px;margin:0 0 12px"><b>Foste convidado para o Fluxo</b></p>` +
    `<p style="font-size:13px;margin:0 0 12px">Tens acesso ao quadro de <b>${entidade}</b> como ${funcao}${quem}.</p>` +
    `<p style="font-size:13px;margin:0 0 18px">Para começar, define a tua palavra-passe:</p>` +
    `<p style="margin:0 0 18px"><a href="${link}" style="display:inline-block;padding:10px 16px;border:0.5px solid #111;border-radius:6px;color:#111;text-decoration:none;font-size:13px">Definir palavra-passe</a></p>` +
    `<p style="font-size:12px;color:#636363;margin:0 0 6px">Se o botão não funcionar, copia este link para o browser:</p>` +
    `<p style="font-size:12px;word-break:break-all;margin:0 0 18px"><a href="${link}" style="color:#111">${link}</a></p>` +
    `<p style="font-size:12px;color:#8d8d8d;margin:0">O link é válido 7 dias e só pode ser usado uma vez. Se não esperavas este email, ignora-o.</p>` +
    `</div>`;

  const texto =
    `Foste convidado para o Fluxo.\n\n` +
    `Tens acesso ao quadro de ${args.entidadeNome} como ${funcao}${args.convidadoPor ? ` por ${args.convidadoPor}` : ""}.\n\n` +
    `Define a tua palavra-passe aqui (válido 7 dias, uso único):\n${link}\n\n` +
    `Se não esperavas este email, ignora-o.`;

  const r = await enviarEmail({ para: args.para, assunto: `Fluxo · convite para ${args.entidadeNome}`, html, texto });
  return { ok: r.ok, link };
}
