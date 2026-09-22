import { redirect } from "next/navigation";
import { createClientServer } from "../../../lib/supabase/server";
import {
  renderizarDocumento,
  SupabaseDocLookup,
  obterVariaveisEntidade,
  DOCUMENTOS_MENU,
} from "../../../lib/docs";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentacaoPage() {
  const supabase = await createClientServer();
  const u = await supabase.auth.getUser();
  const user = u.data.user;
  if (!user) redirect("/entrar?erro=1");

  let meuPerfil: any = null;
  try {
    const r = await supabase
      .from("utilizadores")
      .select("id, entidade_id, funcao")
      .eq("id", user.id)
      .single();
    meuPerfil = r.data;
  } catch {
    meuPerfil = null;
  }
  if (!meuPerfil?.entidade_id) redirect("/entrar?erro=1");

  const lookup = new SupabaseDocLookup(supabase as any);
  const vars = await obterVariaveisEntidade(supabase as any, meuPerfil.entidade_id);

  const inicial = DOCUMENTOS_MENU[0];
  const resultado = await renderizarDocumento(
    inicial.slug,
    meuPerfil.entidade_id,
    vars,
    lookup
  );

  return <DocumentacaoShell ativo={inicial.slug} variou={resultado.variou}>{resultado.html}</DocumentacaoShell>;
}

function DocumentacaoShell({
  ativo,
  variou,
  children,
}: {
  ativo: string;
  variou?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "28px 30px",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        gap: 28,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <aside
        aria-label="menu documentação"
        style={{
          position: "sticky",
          top: 70,
          alignSelf: "start",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--panel)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--muted)",
            padding: "6px 8px 10px",
          }}
        >
          documentação
        </div>
        {DOCUMENTOS_MENU.map((d) => {
          const is = ativo === d.slug;
          return (
            <Link
              key={d.slug}
              href={`/documentacao/${d.slug}`}
              style={{
                padding: "8px 10px",
                borderRadius: 5,
                textDecoration: "none",
                color: is ? "var(--fg)" : "var(--muted)",
                fontWeight: is ? 600 : 400,
                background: is ? "var(--row)" : "transparent",
                border: "1px solid " + (is ? "var(--border)" : "transparent"),
                fontSize: 13,
                lineHeight: 1.3,
                transition: "none",
                cursor: "pointer",
              }}
            >
              {d.titulo}
            </Link>
          );
        })}
      </aside>

      <article
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {ativo}
          </div>
          {variou ? (
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                padding: "4px 8px",
                borderRadius: 999,
              }}
            >
              variante · entidade
            </span>
          ) : null}
        </header>

        <section
          className="doc-article"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--panel)",
            padding: "28px 32px",
            color: "var(--fg)",
            fontSize: 14,
            lineHeight: 1.55,
          }}
          dangerouslySetInnerHTML={{ __html: typeof children === "string" ? children : "" }}
        />
      </article>
    </div>
  );
}
