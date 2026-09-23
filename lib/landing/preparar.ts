/**
 * Prepara o HTML da landing para ser servido sob a CSP do middleware (§19):
 * cada <script> tem de levar o nonce do pedido. O ficheiro tem o marcador
 * `nonce="__NONCE__"`; sem nonce (middleware ausente), o atributo cai.
 */
const MARCADOR = ' nonce="__NONCE__"';

export function prepararLanding(html: string, nonce: string | null | undefined): string {
  const atributo = nonce ? ` nonce="${nonce}"` : "";
  return html.split(MARCADOR).join(atributo);
}
