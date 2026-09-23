import { NextResponse } from "next/server";

/**
 * Autorização dos crons (§10.3, §12): `Authorization: Bearer CRON_SECRET`.
 * A Vercel Cron chama as rotas com GET e envia este cabeçalho quando a
 * variável CRON_SECRET existe no projeto. Sem segredo configurado, nada corre.
 */
export function cronAutorizado(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const partes = header.split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== "bearer") return false;
  return partes[1] === esperado;
}

export function respostaNaoAutorizado() {
  return NextResponse.json({ erro: "Autorização inválida" }, { status: 401 });
}
