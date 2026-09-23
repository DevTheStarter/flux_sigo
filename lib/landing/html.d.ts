// app/landing.html é importada como texto (regra webpack em next.config.mjs).
declare module "*.html" {
  const conteudo: string;
  export default conteudo;
}
