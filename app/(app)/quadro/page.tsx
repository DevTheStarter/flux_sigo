"use client";

import { useEffect, useMemo, useState } from "react";
import Pill from "../../../components/ui/Pill";

type EstadoCartao =
  | "ok"
  | "today"
  | "late"
  | "error"
  | "blocked"
  | "done"
  | "futura";

interface Acao {
  id: string;
  nome: string;
  codigoCurso: string;
  dataInicio: string;
  dataFim: string;
  tipo: string;
  formato: string;
  diasSemana: string | null;
  estado: string;
  ano: number;
  formandos: number;
  temAvaliacoes: boolean;
  urlOrigem: string | null;
}

interface Cartao {
  id: string;
  acao: Acao;
  col: number;
  estado: EstadoCartao;
  dias?: number;
  entraEm?: number;
  concluidaHa?: number;
  motivo?: string;
  prazo?: string;
}

interface Coluna {
  id: number;
  nome: string;
  ordem: number;
}

interface Contadores {
  atrasadas: number;
  hoje: number;
  bloqueadas: number;
  todas: number;
}

interface RespostaQuadro {
  colunas: Coluna[];
  acoes: Cartao[];
  contadores: Contadores;
  sem_ligacao: boolean;
  erro?: string;
}

const COLUNAS_FIXAS = [
  { id: 0, nome: "Dados", ordem: 0 },
  { id: 1, nome: "Perfis", ordem: 1 },
  { id: 2, nome: "Curso", ordem: 2 },
  { id: 3, nome: "Ação", ordem: 3 },
  { id: 4, nome: "Certificação", ordem: 4 },
  { id: 5, nome: "Conclusão", ordem: 5 },
];

type FiltroKey = "todas" | "atrasadas" | "hoje" | "bloqueadas";

const FORMATAR_DATA = (iso?: string) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
};

function classeCard(estado: EstadoCartao): string {
  switch (estado) {
    case "today":
      return "card urgent";
    case "late":
    case "error":
      return "card stuck";
    case "blocked":
      return "card blocked";
    case "done":
      return "card done";
    case "futura":
      return "card futura";
    default:
      return "card";
  }
}

function textoPrazo(c: Cartao): { texto: string; cls: string } {
  switch (c.estado) {
    case "late":
      return {
        texto: c.dias ? `Atrasada ${c.dias}d` : "Atrasada",
        cls: "due red",
      };
    case "today":
      return { texto: "Hoje", cls: "due hot" };
    case "blocked":
    case "error":
      return {
        texto: c.motivo?.length ? c.motivo : "Bloqueada",
        cls: "due red",
      };
    case "futura":
      return {
        texto: c.entraEm != null ? `Entra em ${c.entraEm}d` : "Futura",
        cls: "due",
      };
    case "done":
      return {
        texto:
          c.concluidaHa != null
            ? `Concluída há ${c.concluidaHa}d`
            : "Concluída",
        cls: "due",
      };
    case "ok":
    default:
      if (c.dias != null && c.dias > 0) {
        return { texto: `${c.dias}d`, cls: "due" };
      }
      return { texto: "Sem prazo", cls: "due" };
  }
}

function matchesFilter(cartao: Cartao, filtros: Set<FiltroKey>): boolean {
  if (filtros.size === 0 || filtros.has("todas")) return true;
  const correspondeA: FiltroKey[] = [];
  if (cartao.estado === "late" || cartao.estado === "error")
    correspondeA.push("atrasadas");
  if (cartao.estado === "today") correspondeA.push("hoje");
  if (cartao.estado === "blocked") correspondeA.push("bloqueadas");
  if (correspondeA.length === 0) return false;
  for (const f of filtros) {
    if (!correspondeA.includes(f)) return false;
  }
  return true;
}

export default function QuadroPage() {
  const [dados, setDados] = useState<RespostaQuadro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setAcarregar] = useState(true);
  const [filtros, setFiltros] = useState<Set<FiltroKey>>(new Set());
  const [vista, setVista] = useState("Geral");

  const carregar = async () => {
    setAcarregar(true);
    setErro(null);
    try {
      const res = await fetch("/api/quadro", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as any).erro || `Erro ${res.status} ao carregar quadro`,
        );
      }
      const json = (await res.json()) as RespostaQuadro;
      setDados(json);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAcarregar(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const alternarFiltro = (k: FiltroKey) => {
    setFiltros((prev) => {
      const next = new Set(prev);
      if (k === "todas") {
        if (next.has("todas")) return new Set();
        return new Set(["todas"]);
      }
      next.delete("todas");
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const contadores = dados?.contadores ?? {
    atrasadas: 0,
    hoje: 0,
    bloqueadas: 0,
    todas: 0,
  };

  const acoesFiltradas = useMemo(() => {
    if (!dados) return [];
    return dados.acoes.filter((c) => matchesFilter(c, filtros));
  }, [dados, filtros]);

  const colunasComCartoes = useMemo(() => {
    const map: Record<number, Cartao[]> = {};
    for (const c of COLUNAS_FIXAS) map[c.id] = [];
    for (const c of acoesFiltradas) {
      if (c.col >= 0 && c.col <= 5) {
        (map[c.col] ??= []).push(c);
      }
    }
    return COLUNAS_FIXAS.map((col) => ({
      ...col,
      cartoes: map[col.id] ?? [],
    }));
  }, [acoesFiltradas]);

  const temFiltros = filtros.size > 0;

  return (
    <div style={{ padding: "28px 30px 0", maxWidth: 1560, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 25,
              fontWeight: 500,
              letterSpacing: "-.7px",
              lineHeight: 1.1,
            }}
          >
            Quadro
          </h1>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 5,
            }}
          >
            Vista das ações de formação e progresso pelas seis fases SIGO.
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div
            onClick={() => alternarFiltro("todas")}
            style={{ cursor: "pointer", textAlign: "left" }}
            className={filtros.has("todas") ? "stat act" : "stat"}
          >
            <div
              style={{
                fontSize: 23,
                fontWeight: 500,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {aCarregar ? "—" : contadores.todas}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              Todas
            </div>
          </div>
          <div
            onClick={() => alternarFiltro("hoje")}
            style={{ cursor: "pointer", textAlign: "left" }}
            className={filtros.has("hoje") ? "stat act" : "stat"}
          >
            <div
              style={{
                fontSize: 23,
                fontWeight: 500,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {aCarregar ? "—" : contadores.hoje}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              Para hoje
            </div>
          </div>
          <div
            onClick={() => alternarFiltro("atrasadas")}
            style={{ cursor: "pointer", textAlign: "left" }}
            className={filtros.has("atrasadas") ? "stat act" : "stat"}
          >
            <div
              style={{
                fontSize: 23,
                fontWeight: 500,
                lineHeight: 1,
                color: contadores.atrasadas > 0 ? "var(--red)" : undefined,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {aCarregar ? "—" : contadores.atrasadas}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              Atrasadas
            </div>
          </div>
          <div
            onClick={() => alternarFiltro("bloqueadas")}
            style={{ cursor: "pointer", textAlign: "left" }}
            className={filtros.has("bloqueadas") ? "stat act" : "stat"}
          >
            <div
              style={{
                fontSize: 23,
                fontWeight: 500,
                lineHeight: 1,
                color: contadores.bloqueadas > 0 ? "var(--red)" : undefined,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {aCarregar ? "—" : contadores.bloqueadas}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              Bloqueadas
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <Pill
          active={filtros.has("todas")}
          onClick={() => alternarFiltro("todas")}
          count={contadores.todas}
        >
          Todas
        </Pill>
        <Pill
          active={filtros.has("hoje")}
          onClick={() => alternarFiltro("hoje")}
          count={contadores.hoje}
        >
          Hoje
        </Pill>
        <Pill
          active={filtros.has("atrasadas")}
          tone="danger"
          onClick={() => alternarFiltro("atrasadas")}
          count={contadores.atrasadas}
        >
          Atrasadas
        </Pill>
        <Pill
          active={filtros.has("bloqueadas")}
          tone="danger"
          onClick={() => alternarFiltro("bloqueadas")}
          count={contadores.bloqueadas}
        >
          Bloqueadas
        </Pill>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          borderBottom: ".5px solid var(--line)",
          flexWrap: "wrap",
          paddingBottom: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setVista("Geral")}
          style={{
            fontSize: 13,
            padding: "8px 12px",
            color: vista === "Geral" ? "var(--fg)" : "var(--muted)",
            borderBottom:
              vista === "Geral"
                ? "1.5px solid var(--fg)"
                : "1.5px solid transparent",
            marginBottom: -1,
            fontWeight: vista === "Geral" ? 500 : undefined,
            cursor: "pointer",
            fontFamily: "inherit",
            background: "none",
          }}
        >
          Geral
        </button>
        <button
          type="button"
          onClick={() => setVista("Minhas")}
          style={{
            fontSize: 13,
            padding: "8px 12px",
            color: vista === "Minhas" ? "var(--fg)" : "var(--muted)",
            borderBottom:
              vista === "Minhas"
                ? "1.5px solid var(--fg)"
                : "1.5px solid transparent",
            marginBottom: -1,
            fontWeight: vista === "Minhas" ? 500 : undefined,
            cursor: "pointer",
            fontFamily: "inherit",
            background: "none",
          }}
        >
          Minhas
        </button>
        <button
          type="button"
          style={{
            fontSize: 13,
            padding: "8px 11px",
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: "inherit",
            background: "none",
            border: "none",
          }}
        >
          + Nova vista
        </button>
      </div>

      <div
        style={{
          padding: "11px 2px 0",
          fontSize: 11,
          color: "var(--muted)",
          display: "flex",
          gap: 7,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            border: ".5px solid var(--ls)",
            borderRadius: 4,
            padding: "2px 8px",
            color: "var(--soft)",
          }}
        >
          Vista: {vista}
        </span>
        {temFiltros ? (
          <>
            {filtros.has("todas") && (
              <span
                style={{
                  border: ".5px solid var(--ls)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: "var(--soft)",
                }}
              >
                Todas as ações
              </span>
            )}
            {filtros.has("hoje") && (
              <span
                style={{
                  border: ".5px solid var(--ls)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: "var(--soft)",
                }}
              >
                Com prazo para hoje
              </span>
            )}
            {filtros.has("atrasadas") && (
              <span
                style={{
                  border: ".5px solid var(--red-b)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: "var(--red)",
                  background: "var(--red-s)",
                }}
              >
                Atrasadas
              </span>
            )}
            {filtros.has("bloqueadas") && (
              <span
                style={{
                  border: ".5px solid var(--red-b)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: "var(--red)",
                  background: "var(--red-s)",
                }}
              >
                Bloqueadas
              </span>
            )}
            <button
              type="button"
              onClick={() => setFiltros(new Set())}
              style={{
                fontSize: 11,
                color: "var(--muted)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                marginLeft: 4,
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                background: "none",
                border: "none",
              }}
            >
              Limpar filtros
            </button>
          </>
        ) : (
          <span>A mostrar todas as ações (exceto concluídas).</span>
        )}
        {!aCarregar && !erro && (
          <button
            type="button"
            onClick={carregar}
            style={{
              fontSize: 11,
              color: "var(--muted)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              marginLeft: "auto",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              background: "none",
              border: "none",
            }}
          >
            Atualizar
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 1,
          background: "var(--line)",
          marginTop: 14,
        }}
        className="board"
      >
        {colunasComCartoes.map((col) => (
          <div
            key={col.id}
            className="col"
            style={{
              background: "var(--bg)",
              padding: "17px 11px 30px",
              minHeight: 430,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12,
                padding: "0 2px",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: ".7px",
                  color: "var(--fg)",
                }}
              >
                {col.nome}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {col.cartoes.length}
              </span>
            </div>

            {aCarregar ? (
              <div
                style={{
                  border: ".5px solid var(--line)",
                  borderRadius: 6,
                  padding: 11,
                  marginBottom: 7,
                  background: "var(--bg)",
                }}
              >
                <div
                  style={{
                    height: 10,
                    width: "65%",
                    borderRadius: 3,
                    background: "var(--line)",
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    height: 8,
                    width: "100%",
                    borderRadius: 3,
                    background: "var(--line)",
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    height: 8,
                    width: "40%",
                    borderRadius: 3,
                    background: "var(--line)",
                  }}
                />
              </div>
            ) : col.cartoes.length === 0 ? (
              <div
                className="empty"
                style={{ fontSize: 11, color: "var(--muted)", padding: "8px 2px" }}
              >
                Vazio
              </div>
            ) : (
              col.cartoes.map((c) => {
                const prazo = textoPrazo(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={classeCard(c.estado)}
                    style={{
                      border:
                        c.estado === "blocked"
                          ? ".5px dashed var(--red-b)"
                          : c.estado === "late" || c.estado === "error"
                            ? ".5px solid var(--red-b)"
                            : c.estado === "today"
                              ? ".5px solid var(--fg)"
                              : c.estado === "futura"
                                ? ".5px dashed var(--line)"
                                : ".5px solid var(--line)",
                      background:
                        c.estado === "blocked" ||
                        c.estado === "late" ||
                        c.estado === "error"
                          ? "var(--red-s)"
                          : "var(--bg)",
                      opacity:
                        c.estado === "done"
                          ? 0.38
                          : c.estado === "futura"
                            ? 0.5
                            : undefined,
                      borderRadius: 6,
                      padding: 11,
                      marginBottom: 7,
                      width: "100%",
                      display: "block",
                      transition: ".12s",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      const t = e.currentTarget;
                      const isErro =
                        c.estado === "blocked" ||
                        c.estado === "late" ||
                        c.estado === "error";
                      t.style.borderColor = isErro ? "var(--red)" : "var(--fg)";
                      if (!isErro) {
                        t.style.background = "var(--hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      const t = e.currentTarget;
                      t.style.borderColor = "";
                      t.style.background = "";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 7,
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          lineHeight: 1.35,
                          color: "var(--fg)",
                        }}
                      >
                        {c.acao.nome}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--soft)",
                        marginBottom: 8,
                      }}
                    >
                      {c.acao.codigoCurso} · {c.acao.formandos} form. ·{" "}
                      {FORMATAR_DATA(c.acao.dataInicio)} →{" "}
                      {FORMATAR_DATA(c.acao.dataFim)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {c.acao.formato && (
                        <span
                          style={{
                            fontSize: 9,
                            border: ".5px solid var(--ls)",
                            padding: "1px 5px",
                            borderRadius: 3,
                            color: "var(--soft)",
                          }}
                        >
                          {c.acao.formato}
                        </span>
                      )}
                      {c.acao.tipo && (
                        <span
                          style={{
                            fontSize: 9,
                            border: ".5px solid var(--ls)",
                            padding: "1px 5px",
                            borderRadius: 3,
                            color: "var(--soft)",
                          }}
                        >
                          {c.acao.tipo}
                        </span>
                      )}
                    </div>
                    <div
                      className={prazo.cls}
                      style={{
                        fontSize: 10,
                        color:
                          prazo.cls.includes("red")
                            ? "var(--red)"
                            : prazo.cls.includes("hot")
                              ? "var(--fg)"
                              : "var(--muted)",
                        fontWeight:
                          prazo.cls.includes("red") || prazo.cls.includes("hot")
                            ? 500
                            : undefined,
                      }}
                    >
                      {prazo.texto}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>

      {aCarregar || erro || dados?.sem_ligacao ? (
        <div
          style={{
            marginTop: 14,
            padding: "14px 16px",
            fontSize: 12,
            color: "var(--soft)",
            border: ".5px solid var(--line)",
            borderRadius: 6,
            background: "var(--hover)",
          }}
        >
          {aCarregar && !erro && <span>A carregar dados da fonte…</span>}
          {erro && (
            <span style={{ color: "var(--red)" }}>
              Não foi possível carregar o quadro: {erro}.
              <button
                type="button"
                onClick={carregar}
                style={{
                  marginLeft: 8,
                  color: "var(--fg)",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 12,
                }}
              >
                Tentar novamente
              </button>
            </span>
          )}
          {!aCarregar && !erro && dados?.sem_ligacao && (
            <span>
              Ainda não há ligação à vossa fonte de dados configurada. Vai a{" "}
              <span style={{ color: "var(--fg)", fontWeight: 500 }}>
                Definições · Ligação
              </span>{" "}
              para ativar o quadro.
            </span>
          )}
        </div>
      ) : null}

      <style>{`
        @media (max-width: 1250px) and (min-width: 761px) {
          .board { grid-template-columns: repeat(6, minmax(172px, 1fr)) !important; overflow-x: auto; }
        }
        @media (max-width: 760px) {
          .board {
            display: block !important;
            background: transparent !important;
            margin-top: 18px !important;
          }
          .col {
            padding: 0 !important;
            min-height: 0 !important;
            margin-bottom: 26px;
          }
          .col > div:first-child {
            padding: 0 0 9px !important;
            border-bottom: .5px solid var(--line);
            margin-bottom: 11px !important;
            align-items: center !important;
          }
          .col-t, .col span:first-child { font-size: 11px !important; }
          .card, button.card {
            padding: 14px !important;
            margin-bottom: 9px !important;
          }
          .card-t, .card div { }
        }
      `}</style>
    </div>
  );
}
