import { Documentacao } from "../../../components/documentacao/Documentacao";

export const dynamic = "force-dynamic";

export default function DocumentacaoPage({ searchParams }: { searchParams?: { entidade?: string } }) {
  return <Documentacao ambitoInicial={searchParams?.entidade ?? null} />;
}
