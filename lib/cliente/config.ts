"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../supabase/client";
import { COLUNAS_CONFIG_VARIAVEIS, variaveisDaConfig } from "./variaveis";

/** Valores não secretos das variáveis da entidade, lidos por RLS. */
export function useVariaveisEntidade(entidadeId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await supabase
        .from("config_entidade")
        .select(COLUNAS_CONFIG_VARIAVEIS)
        .eq("entidade_id", entidadeId)
        .maybeSingle();
      if (!vivo) return;
      setValores(variaveisDaConfig((r.data as unknown as Record<string, unknown> | null) ?? null));
      setCarregado(true);
    })();
    return () => { vivo = false; };
  }, [supabase, entidadeId]);

  return { valores, carregado };
}
