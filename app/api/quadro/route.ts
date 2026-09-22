import { NextResponse } from "next/server";
import { createClientServer } from "../../../lib/supabase/server";
import { criarAirtable, ultimaLeituraDe } from "../../../lib/dados/airtable";
import { derivar, NOMES_FASES, type Cartao } from "../../../lib/dados/derivar";
import { COLUNAS_CONFIG_FONTE, configFonte, tokenDaCredencial, type ConfigFonteRow } from "../../../lib/dados/credencial";
import type { Acao, Registo } from "../../../lib/dados/interface";
import { log } from "../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Cartão devolvido ao cliente: o derivado (§4.2) mais as datas de sucesso por fase. */
export interface CartaoQuadro extends Cartao {
  /** data (YYYY-MM-DD) do último registo Success por fase */
  feitas: Record<number, string>;
}

export interface RespostaQuadro {
  colunas: { id: number; nome: string }[];
  cartoes: CartaoQuadro[];
  contadores: { atrasadas: number; hoje: number; bloqueadas: number; total: number };
  semLigacao: boolean;
  ultimaLeitura: string | null;
  erro?: string;
}

const COLUNAS = [0, 1, 2, 3, 4, 5].map((k) => ({ id: k, nome: NOMES_FASES[k] }));

function vazio(semLigacao: boolean, erro?: string): RespostaQuadro {
  return {
    colunas: COLUNAS,
    cartoes: [],
    contadores: { atrasadas: 0, hoje: 0, bloqueadas: 0, total: 0 },
    semLigacao,
    ultimaLeitura: null,
    ...(erro ? { erro } : {}),
  };
}

export async function GET() {
  try {
    const supabase = await createClientServer();
    const authRes = await supabase.auth.getUser().catch(() => null);
    const user = authRes?.data?.user ?? null;
    if (!user) return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });

    const meRes = await supabase.from("utilizadores").select("funcao, entidade_id").eq("id", user.id).single();
    const me = meRes.data as { funcao: string; entidade_id: string } | null;
    if (!me) return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });

    const cfgRes = await supabase
      .from("config_entidade")
      .select(COLUNAS_CONFIG_FONTE)
      .eq("entidade_id", me.entidade_id)
      .maybeSingle();
    const cfg = (cfgRes.data as unknown as ConfigFonteRow | null) ?? null;
    const fonteCfg = cfg ? configFonte(cfg) : null;
    if (!cfg || !fonteCfg) return NextResponse.json(vazio(true));

    let token: string | null = null;
    try {
      token = await tokenDaCredencial(cfg.fonte_credencial);
    } catch (e) {
      log.error("quadro decifra falhou", { err: (e as Error).message, entidade_id: me.entidade_id });
      return NextResponse.json(vazio(false, "Não foi possível ler a credencial da fonte de dados."), { status: 500 });
    }
    if (!token) return NextResponse.json(vazio(true));

    const fonte = criarAirtable({ ...fonteCfg, token });
    let acoes: Acao[];
    let registos: Registo[];
    try {
      acoes = await fonte.obterAcoes();
      registos = await fonte.obterRegistos();
    } catch (e) {
      log.error("quadro leitura da fonte falhou", { err: (e as Error).message, entidade_id: me.entidade_id });
      return NextResponse.json(vazio(false, "Falha na leitura da base de dados."), { status: 502 });
    }

    const prazos = (cfg.prazos as Record<string, number> | null) ?? undefined;
    const cartoes: CartaoQuadro[] = [];
    for (const a of acoes) {
      try {
        const c = derivar(a, registos, prazos);
        const feitas: Record<number, string> = {};
        for (const r of registos) {
          if (r.acaoId !== a.id || r.estado !== "success") continue;
          if (!feitas[r.flow] || feitas[r.flow] < r.data) feitas[r.flow] = r.data;
        }
        cartoes.push({ ...c, feitas });
      } catch (e) {
        log.warn("quadro derivar falhou", { acao: a.id, err: (e as Error).message });
      }
    }

    const contadores = {
      atrasadas: cartoes.filter((c) => c.estado === "late" || c.estado === "error").length,
      hoje: cartoes.filter((c) => c.estado === "today").length,
      bloqueadas: cartoes.filter((c) => c.estado === "blocked").length,
      total: cartoes.length,
    };

    const resposta: RespostaQuadro = {
      colunas: COLUNAS,
      cartoes,
      contadores,
      semLigacao: false,
      ultimaLeitura: ultimaLeituraDe(fonteCfg.baseId) ?? new Date().toISOString(),
    };
    return NextResponse.json(resposta);
  } catch (e) {
    log.error("quadro erro inesperado", { err: (e as Error).message });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
