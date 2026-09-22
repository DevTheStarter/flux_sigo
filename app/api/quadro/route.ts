import { NextResponse } from "next/server";
import { createClientServer } from "../../../lib/supabase/server";
import { desencriptar } from "../../../lib/cifra";
import { criarAirtable, type AirtableCfg } from "../../../lib/dados/airtable";
import {
  derivar,
  NOMES_FASES,
  type Cartao,
} from "../../../lib/dados/derivar";
import type { Acao, Registo } from "../../../lib/dados/interface";
import { log } from "../../../lib/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ColunaKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export async function GET(_req: Request) {
  try {
    const supabase = await createClientServer();
    let user: { id: string } | null = null;
    try {
      const authRes = await supabase.auth.getUser();
      user = (authRes.data as any)?.user ?? null;
    } catch {
      user = null;
    }
    if (!user || !user.id) {
      return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
    }

    let me: { funcao: string; entidade_id: string } | null = null;
    try {
      const res = await supabase
        .from("utilizadores")
        .select("funcao, entidade_id")
        .eq("id", user.id)
        .single();
      me = res.data as
        | { funcao: string; entidade_id: string }
        | null;
    } catch {
      me = null;
    }
    if (!me) {
      return NextResponse.json({ erro: "Sem perfil" }, { status: 403 });
    }

    let cfg: {
      fonte_tipo?: string;
      fonte_credencial?: unknown;
      fonte_base?: string | null;
      mapa_campos?: unknown;
      filtros?: unknown;
      prazos?: unknown;
    } | null = null;
    try {
      const res = await supabase
        .from("config_entidade")
        .select(
          "fonte_tipo,fonte_credencial,fonte_base,mapa_campos,filtros,prazos",
        )
        .eq("entidade_id", me.entidade_id)
        .maybeSingle();
      cfg = (res.data as any) ?? null;
    } catch {
      cfg = null;
    }

    const colsBase = [0, 1, 2, 3, 4, 5] as const;
    const cols: { id: ColunaKey; nome: string; ordem: ColunaKey }[] = colsBase
      .map((k) => ({
        id: k as ColunaKey,
        nome: NOMES_FASES[k] ?? `Fase ${k}`,
        ordem: k as ColunaKey,
      }))
      .concat([{ id: 6, nome: "Concluídas", ordem: 6 as const }]);

    const semLigacao =
      !cfg ||
      !cfg.fonte_base ||
      !((cfg.fonte_credencial as Record<string, unknown>)?.crm_token);

    if (semLigacao) {
      return NextResponse.json({
        colunas: cols,
        acoes: [] as Cartao[],
        contadores: { atrasadas: 0, hoje: 0, bloqueadas: 0, todas: 0 },
        sem_ligacao: true,
      });
    }
    if (!cfg) {
      return NextResponse.json({
        colunas: cols,
        acoes: [] as Cartao[],
        contadores: { atrasadas: 0, hoje: 0, bloqueadas: 0, todas: 0 },
        sem_ligacao: true,
      });
    }
    const cfgNonNull = cfg;

    const credencialCifrada = (
      cfgNonNull.fonte_credencial as Record<string, unknown>
    ).crm_token as string;
    let token: string | null;
    try {
      token = await desencriptar(credencialCifrada);
    } catch (e) {
      log.error("quadro decifra falhou", {
        err: (e as Error).message,
        user_id: user.id,
        entidade_id: me.entidade_id,
      });
      return NextResponse.json(
        { erro: "Não foi possível desencriptar a credencial" },
        { status: 500 },
      );
    }
    if (!token) {
      return NextResponse.json(
        { erro: "Não foi possível desencriptar a credencial" },
        { status: 500 },
      );
    }

    const airCfg: AirtableCfg = {
      baseId: cfgNonNull.fonte_base as string,
      token,
      mapaCampos: (cfgNonNull.mapa_campos as Record<string, string> | null) ?? undefined,
      filtros: (cfgNonNull.filtros as Record<string, unknown> | null) ?? undefined,
    };
    const fonte = criarAirtable(airCfg);

    let acoes: Acao[];
    let registos: Registo[];
    try {
      [acoes, registos] = await Promise.all([
        fonte.obterAcoes(),
        fonte.obterRegistos(),
      ]);
    } catch (e) {
      log.error("quadro airtable falhou", {
        err: (e as Error).message,
        user_id: user.id,
        entidade_id: me.entidade_id,
      });
      return NextResponse.json(
        { erro: `Falha ao ler Airtable: ${(e as Error).message}` },
        { status: 502 },
      );
    }

    const prazosCfg = cfgNonNull.prazos as Record<string, number> | null;
    const derivado: Cartao[] = [];
    for (const a of acoes) {
      try {
        derivado.push(derivar(a, registos, prazosCfg ?? undefined));
      } catch {
        // skip
      }
    }

    const contadores = {
      atrasadas: derivado.filter((c) => c.prazo === "late").length,
      hoje: derivado.filter((c) => c.prazo === "today").length,
      bloqueadas: derivado.filter((c) => c.prazo === "bloqueada").length,
      todas: derivado.length,
    };

    return NextResponse.json({
      colunas: cols,
      acoes: derivado,
      contadores,
      sem_ligacao: false,
    });
  } catch (e) {
    log.error("quadro erro inesperado", {
      err: (e as Error).message,
    });
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
