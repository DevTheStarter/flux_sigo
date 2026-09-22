"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { createClient } from "../../../lib/supabase/client";

type Entidade = {
  id: string;
  nome: string;
  nipc: string | null;
  ativa: boolean;
  suporte: boolean;
  setup_em: string | null;
  contrato_assinado: boolean;
  criada_em: string;
  utilizadores: { funcao: "staff" | "admin" | "gestor" | "leitura" }[];
};

type MeuPerfil = {
  id: string;
  funcao: "staff" | "admin" | "gestor" | "leitura";
  entidade_id: string | null;
  nome?: string | null;
  email?: string | null;
  entidade_nome?: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function EntidadesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Entidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [me, setMe] = useState<MeuPerfil | null>(null);
  const [aCarregarPerfil, setACarregarPerfil] = useState(true);

  const [alvoDelete, setAlvoDelete] = useState<Entidade | null>(null);
  const [confirmNome, setConfirmNome] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErro, setDeleteErro] = useState<string | null>(null);
  const [deleteOk, setDeleteOk] = useState<string | null>(null);

  const [novaEntidadeAberta, setNovaEntidadeAberta] = useState(false);
  const [novaForm, setNovaForm] = useState({
    nome: "",
    nipc: "",
    ativa: true,
    contrato_assinado: false,
    setup_em: "",
  });
  const [novaErro, setNovaErro] = useState<string | null>(null);
  const [novaOk, setNovaOk] = useState<string | null>(null);
  const [novaSubmeter, setNovaSubmeter] = useState(false);

  const carregarPerfil = useCallback(async () => {
    setACarregarPerfil(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setMe(null);
        return;
      }
      const res = await supabase
        .from("utilizadores")
        .select(
          "id, funcao, entidade_id, nome, email, entidades:entidade_id(nome)",
        )
        .eq("id", user.id)
        .single();
      if (res.error) throw res.error;
      const d = res.data as any;
      setMe({
        id: d.id,
        funcao: d.funcao,
        entidade_id: d.entidade_id,
        nome: d.nome,
        email: d.email,
        entidade_nome: d.entidades?.nome ?? null,
      });
    } catch (e: any) {
      setMe(null);
    } finally {
      setACarregarPerfil(false);
    }
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await supabase
        .from("entidades")
        .select(
          "id, nome, nipc, ativa, suporte, setup_em, contrato_assinado, criada_em," +
            "utilizadores(funcao)",
        )
        .order("criada_em", { ascending: false });
      if (res.error) throw res.error;
      setRows((res.data ?? []) as Entidade[]);
    } catch (e: any) {
      setErro(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void carregarPerfil();
    void load();
  }, [carregarPerfil, load]);

  const eStaff = me?.funcao === "staff";

  async function submeterNova() {
    setNovaErro(null);
    setNovaOk(null);
    const f = novaForm;
    if (!f.nome.trim()) {
      setNovaErro("Nome da entidade é obrigatório.");
      return;
    }
    setNovaSubmeter(true);
    try {
      const body: Record<string, unknown> = {
        nome: f.nome.trim(),
        ativa: f.ativa,
        contrato_assinado: f.contrato_assinado,
      };
      if (f.nipc.trim().length > 0) body.nipc = f.nipc.trim();
      if (f.setup_em.length >= 10) body.setup_em = f.setup_em;

      const r = await fetch("/api/admin/entidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: any = null;
      try {
        data = await r.json();
      } catch {
        data = null;
      }
      if (!r.ok) {
        throw new Error(
          data && typeof data === "object" && "erro" in data && typeof data.erro === "string"
            ? data.erro
            : `HTTP ${r.status}`,
        );
      }
      setNovaOk(`Entidade "${data.entidade.nome}" criada.`);
      setTimeout(() => {
        setNovaEntidadeAberta(false);
        setNovaForm({
          nome: "",
          nipc: "",
          ativa: true,
          contrato_assinado: false,
          setup_em: "",
        });
        setNovaOk(null);
        setNovaSubmeter(false);
        void load();
      }, 900);
      return;
    } catch (e: any) {
      setNovaErro(e?.message ?? String(e));
    } finally {
      setNovaSubmeter(false);
    }
  }

  function onRemover(e: Entidade) {
    setAlvoDelete(e);
    setConfirmNome("");
    setDeleteErro(null);
    setDeleteOk(null);
    setDeleting(false);
  }

  function fecharModal() {
    if (deleting) return;
    setAlvoDelete(null);
    setConfirmNome("");
    setDeleteErro(null);
  }

  async function confirmarDelete() {
    if (!alvoDelete || deleting) return;
    if (alvoDelete.suporte) return;
    if (confirmNome.trim() !== alvoDelete.nome.trim()) return;

    setDeleting(true);
    setDeleteErro(null);
    try {
      const r = await fetch("/api/admin/entidades", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alvoDelete.id }),
      });
      let data: any = null;
      try {
        data = await r.json();
      } catch {
        data = null;
      }
      if (!r.ok) {
        throw new Error(
          data && typeof data === "object" && "erro" in data && typeof data.erro === "string"
            ? data.erro
            : `HTTP ${r.status}`,
        );
      }
      setDeleteOk(
        `Entidade "${alvoDelete.nome}" eliminada. Todos os dados relacionados foram removidos.`,
      );
      setTimeout(() => {
        setAlvoDelete(null);
        setConfirmNome("");
        setDeleteOk(null);
        setDeleting(false);
        void load();
      }, 900);
    } catch (e: any) {
      setDeleteErro(e?.message ?? String(e));
      setDeleting(false);
    }
  }

  const clientesCount = rows.filter((r) => !r.suporte).length;
  const totalUtilizadores = rows.reduce(
    (acc, r) => acc + (r.utilizadores?.length ?? 0),
    0,
  );
  const inativasCount = rows.filter((r) => !r.ativa).length;

  if (aCarregarPerfil) {
    return (
      <div style={{ padding: 40, color: "var(--muted)" }}>A carregar…</div>
    );
  }

  if (!me) {
    return (
      <div
        style={{
          padding: 40,
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Card style={{ padding: 24, color: "var(--red)", borderColor: "var(--red-b)" }}>
          Sem sessão ativa. Inicia sessão novamente.
        </Card>
      </div>
    );
  }

  if (!eStaff) {
    const papelLabel: Record<string, string> = {
      admin: "Administrador",
      gestor: "Gestor",
      leitura: "Leitura",
    };
    return (
      <div
        style={{
          padding: "48px 32px",
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Card
          style={{
            padding: 32,
            borderColor: "var(--red-b)",
            background: "var(--red-s)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Acesso negado
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg)" }}>
            Estás a navegar como{" "}
            <strong>{papelLabel[me.funcao] ?? me.funcao}</strong> da entidade{" "}
            <strong>{me.entidade_nome ?? "(sem entidade)"}</strong>.{" "}
            <span style={{ color: "var(--muted)" }}>
              Este papel só pertence a uma empresa cliente, por isso não tens
              acesso à administração da plataforma FLUXO.
            </span>
          </div>
          <div
            style={{
              padding: 16,
              border: "0.5px solid var(--red-b)",
              borderRadius: 6,
              background: "var(--bg)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Porque isto acontece
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--soft)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div>
                <strong style={{ color: "var(--fg)" }}>
                  staff (TheStarter)
                </strong>{" "}
                — administração da plataforma. Cria entidades (empresas
                clientes), vê todas as empresas, gestão global.
              </div>
              <div>
                <strong style={{ color: "var(--fg)" }}>
                  admin / gestor / leitura (cliente)
                </strong>{" "}
                — pertencem a uma única empresa. Só veem o quadro, as
                definições e a documentação dessa entidade.
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--soft)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--fg)" }}>
              Como corrigir
            </div>
            <ol
              style={{
                paddingLeft: 18,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <li>
                Entra no Supabase dashboard → SQL Editor e corre:
                <div
                  style={{
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 5,
                    background: "var(--hover)",
                    border: "0.5px solid var(--line)",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: 12.5,
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  UPDATE utilizadores SET funcao =
                  &apos;staff&apos; WHERE id =
                  &apos;{me.id}&apos;;
                </div>
              </li>
              <li>
                Ou então termina sessão e autentica-te com o email correto da
                equipa TheStarter.
              </li>
              <li>
                Depois refresca esta página — deve aparecer a tag{" "}
                <strong style={{ color: "var(--fg)" }}>
                  TheStarter · administração
                </strong>{" "}
                no topo e a navegação passa a incluir o item{" "}
                <strong style={{ color: "var(--fg)" }}>entidades</strong>.
              </li>
            </ol>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="primary"
              onClick={() => {
                const f = document.createElement("form");
                f.method = "POST";
                f.action = "/api/auth/sair";
                document.body.appendChild(f);
                f.submit();
              }}
            >
              Terminar sessão e trocar de conta
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/quadro")}>
              Voltar ao quadro
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 30px 60px", maxWidth: 1560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <Card
        style={{
          padding: 24,
          borderColor: "var(--fg)",
          background: "var(--panel)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 780 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--fg)",
              }}
            >
              Administração da plataforma · TheStarter
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
              entidades
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--soft)", margin: 0 }}>
              Lista de todas as empresas cliente. Aqui crias novas entidades,
              geres o estado de cada uma e entras como se fosses um utilizador
              cliente para testar o setup.{" "}
              <strong style={{ color: "var(--fg)" }}>
                Todos os dados são RLS scoped por entidade_id
              </strong>{" "}
              — as empresas clientes nunca veem umas às outras.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={load} disabled={loading || novaSubmeter}>
              {loading ? "A recarregar…" : "Recarregar"}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setNovaForm({
                  nome: "",
                  nipc: "",
                  ativa: true,
                  contrato_assinado: false,
                  setup_em: "",
                });
                setNovaErro(null);
                setNovaOk(null);
                setNovaEntidadeAberta(true);
              }}
              disabled={novaSubmeter}
            >
              Nova entidade
            </Button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 1,
            background: "var(--line)",
            border: "0.5px solid var(--line)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {[
            { label: "empresas cliente", val: clientesCount },
            {
              label: "utilizadores (todas)",
              val: totalUtilizadores,
            },
            {
              label: "inativas",
              val: inativasCount,
              danger: inativasCount > 0,
            },
            {
              label: "entidade suporte",
              val: rows.find((r) => r.suporte)?.nome ?? "não configurada",
              danger: !rows.find((r) => r.suporte),
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: 0.2,
                  fontWeight: 500,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: s.danger ? "var(--red)" : "var(--fg)",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={typeof s.val === "string" ? s.val : undefined}
              >
                {typeof s.val === "number" ? s.val.toLocaleString("pt-PT") : s.val}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {erro ? (
        <Card style={{ padding: 16, color: "var(--red)" }}>{erro}</Card>
      ) : null}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.6fr 1.2fr 0.8fr 1fr 1.4fr 1.4fr 140px",
            padding: "11px 16px",
            fontSize: 11,
            letterSpacing: 0.4,
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            borderBottom: "0.5px solid var(--line)",
            background: "var(--panel)",
          }}
        >
          <div>Empresa</div>
          <div>NIPC</div>
          <div>Ativa</div>
          <div>Tipo</div>
          <div>Setup</div>
          <div>Utilizadores</div>
          <div></div>
        </div>

        {loading ? (
          <div style={{ padding: 40, color: "var(--muted)" }}>A carregar…</div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: 48,
              color: "var(--muted)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 15 }}>
              Nenhuma entidade cliente encontrada. Ainda não criaste nenhuma
              empresa.
            </div>
            <Button
              variant="primary"
              onClick={() => {
                setNovaForm({
                  nome: "",
                  nipc: "",
                  ativa: true,
                  contrato_assinado: false,
                  setup_em: "",
                });
                setNovaEntidadeAberta(true);
              }}
            >
              Criar primeira entidade
            </Button>
          </div>
        ) : (
          rows.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.6fr 1.2fr 0.8fr 1fr 1.4fr 1.4fr 140px",
                padding: "14px 16px",
                alignItems: "center",
                borderBottom: "0.5px solid var(--line)",
                fontSize: 13,
                gap: 8,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.nome}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted)",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  }}
                >
                  id {e.id.slice(0, 10)}…
                </div>
              </div>
              <div
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 12.5,
                  color: "var(--soft)",
                }}
              >
                {e.nipc ?? "—"}
              </div>
              <div>
                <Badge tone={e.ativa ? "ok" : "neutral"} dot={false}>
                  {e.ativa ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <div>
                <Badge tone={e.suporte ? "info" : "ok"} dot={false}>
                  {e.suporte ? "Suporte" : "Cliente"}
                </Badge>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--soft)" }}>
                {e.setup_em
                  ? new Date(e.setup_em).toLocaleDateString("pt-PT")
                  : "—"}
                <div style={{ fontSize: 11.5, marginTop: 2 }}>
                  Contrato: {e.contrato_assinado ? "assinado" : "pendente"}
                </div>
              </div>
              <div>
                {e.utilizadores?.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {e.utilizadores.map((u, i) => (
                      <span
                        key={i}
                        title={u.funcao}
                        style={{
                          fontSize: 10.5,
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: "0.5px solid var(--ls)",
                          color:
                            u.funcao === "admin"
                              ? "var(--fg)"
                              : "var(--soft)",
                          fontWeight: u.funcao === "admin" ? 600 : 400,
                        }}
                      >
                        {u.funcao}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    sem utilizadores
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    alert(
                      `Entrar como cliente na entidade ${e.nome} (staff impersonate) · UI futura · salta para /quadro com contexto ${e.id}.`,
                    )
                  }
                  disabled={!e.ativa}
                >
                  Entrar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRemover(e)}
                  disabled={e.suporte || !e.ativa ? false : undefined}
                  title={
                    e.suporte
                      ? "A entidade de suporte não pode ser eliminada."
                      : "Eliminar entidade em cascata"
                  }
                >
                  Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Modal
        open={novaEntidadeAberta}
        onClose={() => !novaSubmeter && setNovaEntidadeAberta(false)}
        title="Nova entidade"
        widthPx={600}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => !novaSubmeter && setNovaEntidadeAberta(false)}
              disabled={novaSubmeter}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={submeterNova}
              loading={novaSubmeter}
              disabled={novaSubmeter || !novaForm.nome.trim()}
            >
              {novaSubmeter ? "A criar…" : "Criar entidade"}
            </Button>
          </>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--soft)" }}>
            Cria uma nova empresa cliente. Os triggers do Supabase criam
            automaticamente as vistas padrão (Ativas / Concluídas), a
            configuração de relatório semanal e as preferências de notificação
            para os utilizadores que forem adicionados.
          </div>

          {novaOk ? (
            <Card style={{ padding: 14, color: "#2f7d4b" }}>{novaOk}</Card>
          ) : null}
          {novaErro ? (
            <Card style={{ padding: 14, color: "var(--red)" }}>{novaErro}</Card>
          ) : null}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
                htmlFor="nova-nome"
              >
                Nome da empresa
              </label>
              <input
                id="nova-nome"
                type="text"
                placeholder="ex: Bridgerton House Lda."
                value={novaForm.nome}
                onChange={(e) =>
                  setNovaForm((f) => ({ ...f, nome: e.target.value }))
                }
                autoFocus
              />
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Obrigatório, mínimo 2 caracteres.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
                htmlFor="nova-nipc"
              >
                NIPC (opcional)
              </label>
              <input
                id="nova-nipc"
                type="text"
                placeholder="ex: 500 000 000"
                value={novaForm.nipc}
                onChange={(e) =>
                  setNovaForm((f) => ({ ...f, nipc: e.target.value }))
                }
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
                htmlFor="nova-setup"
              >
                Data de setup (opcional)
              </label>
              <input
                id="nova-setup"
                type="date"
                value={novaForm.setup_em}
                onChange={(e) =>
                  setNovaForm((f) => ({ ...f, setup_em: e.target.value }))
                }
              />
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Quando a entidade ficou operacional.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                alignItems: "center",
                padding: "10px 0",
                borderTop: "0.5px dashed var(--line)",
                borderBottom: "0.5px dashed var(--line)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  Entidade ativa
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Desligar para bloqueá-la sem apagar.
                </div>
              </div>
              <div
                onClick={() =>
                  setNovaForm((f) => ({ ...f, ativa: !f.ativa }))
                }
                role="switch"
                aria-checked={novaForm.ativa}
                title="Clica para alternar"
                style={{
                  justifySelf: "end",
                  width: 36,
                  height: 20,
                  borderRadius: 999,
                  background: novaForm.ativa ? "var(--fg)" : "var(--ls)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 140ms ease",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: novaForm.ativa ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: novaForm.ativa ? "var(--bg)" : "var(--bg)",
                    transition: "left 140ms ease",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  Contrato assinado
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Marcar quando o contrato da empresa for assinado.
                </div>
              </div>
              <div
                onClick={() =>
                  setNovaForm((f) => ({
                    ...f,
                    contrato_assinado: !f.contrato_assinado,
                  }))
                }
                role="switch"
                aria-checked={novaForm.contrato_assinado}
                title="Clica para alternar"
                style={{
                  justifySelf: "end",
                  width: 36,
                  height: 20,
                  borderRadius: 999,
                  background: novaForm.contrato_assinado
                    ? "var(--fg)"
                    : "var(--ls)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 140ms ease",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: novaForm.contrato_assinado ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: "var(--bg)",
                    transition: "left 140ms ease",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!alvoDelete}
        onClose={fecharModal}
        title="Eliminar entidade"
        blocking
        widthPx={560}
        actions={
          alvoDelete ? (
            <>
              <Button variant="secondary" onClick={fecharModal} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={confirmarDelete}
                loading={deleting}
                disabled={
                  alvoDelete.suporte ||
                  deleting ||
                  confirmNome.trim() !== alvoDelete.nome.trim()
                }
              >
                {deleting ? "A eliminar…" : "Eliminar definitivamente"}
              </Button>
            </>
          ) : undefined
        }
      >
        {alvoDelete ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {alvoDelete.suporte ? (
              <Card style={{ padding: 14, color: "var(--red)" }}>
                <strong>Esta entidade não pode ser eliminada.</strong>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Trata-se da entidade de suporte da plataforma (TheStarter).
                </div>
              </Card>
            ) : null}

            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              Estás prestes a eliminar a entidade{" "}
              <strong style={{ color: "var(--red)" }}>{alvoDelete.nome}</strong>.
              Esta ação é irreversível e aplica em cascata a todos os dados
              associados:
            </div>

            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12.5,
                color: "var(--soft)",
              }}
            >
              <li>utilizadores, convites pendentes e preferências;</li>
              <li>
                configurações (ligações, prazos, mapa de campos, vistas,
                relatórios);
              </li>
              <li>
                histórico de notificações, estado de prazos e problemas
                reportados (incluindo anexos);
              </li>
              <li>
                variações locais de documentação (os documentos globais não são
                afetados).
              </li>
            </ul>

            {alvoDelete.utilizadores?.length ? (
              <div style={{ fontSize: 12.5, color: "var(--soft)" }}>
                Conta atualmente com{" "}
                <strong style={{ color: "var(--fg)" }}>
                  {alvoDelete.utilizadores.length}
                </strong>{" "}
                {alvoDelete.utilizadores.length === 1
                  ? "utilizador"
                  : "utilizadores"}
                .
              </div>
            ) : null}

            {deleteOk ? (
              <Card style={{ padding: 14, color: "#2f7d4b" }}>{deleteOk}</Card>
            ) : null}
            {deleteErro ? (
              <Card style={{ padding: 14, color: "var(--red)" }}>
                {deleteErro}
              </Card>
            ) : null}

            {!alvoDelete.suporte && !deleteOk ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="confirm-nome"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Confirmar nome
                </label>
                <input
                  id="confirm-nome"
                  type="text"
                  value={confirmNome}
                  onChange={(e) => setConfirmNome(e.target.value)}
                  placeholder={`Escreve "${alvoDelete.nome}" para confirmar`}
                  autoFocus
                />
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Confirmação por escrita obrigatória para evitar eliminações
                  acidentais.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
