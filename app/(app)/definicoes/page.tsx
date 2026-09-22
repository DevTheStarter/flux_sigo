import { Definicoes } from "../../../components/definicoes/Definicoes";

export const dynamic = "force-dynamic";

export default function DefinicoesPage({ searchParams }: { searchParams?: { tab?: string } }) {
  return <Definicoes tab={searchParams?.tab ?? "perfil"} />;
}
