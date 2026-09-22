import { Leitor } from "../../../../components/documentacao/Leitor";

export const dynamic = "force-dynamic";

export default function DocumentoPage({
  params,
  searchParams,
}: {
  params: { nome: string };
  searchParams?: { entidade?: string };
}) {
  const nome = decodeURIComponent(params.nome).replace(/\.md$/i, "");
  return <Leitor nome={nome} entidadeParam={searchParams?.entidade ?? null} />;
}
