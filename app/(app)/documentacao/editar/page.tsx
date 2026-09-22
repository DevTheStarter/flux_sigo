import { Editor } from "../../../../components/documentacao/Editor";

export const dynamic = "force-dynamic";

export default function EditarDocumentoPage({ searchParams }: { searchParams?: { doc?: string; entidade?: string } }) {
  return <Editor nomeDoc={searchParams?.doc ?? null} entidadeId={searchParams?.entidade ?? null} />;
}
