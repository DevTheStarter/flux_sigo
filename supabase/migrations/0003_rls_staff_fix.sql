-- Fluxo 0003: Corrige recursão infinita RLS helpers auth_uid / minha_entidade_id / eu_sou_staff
-- + atualiza policies para permitir queries de staff cross-entity em todas tabelas.
-- (Causa do bug "Sem entidade ligada" em staff: função minha_entidade_id() lê
--  utilizadores que tem RLS que por sua vez chama eu_sou_staff() que volta a ler
--  utilizadores — recursão infinita → RLS retorna vazio → layout não recebe papel
--  + entidade → TopBar renderiza sem tag TheStarter.)

-- ====================================================================
-- Helpers reescritos como SECURITY DEFINER (bypassam RLS no próprio corpo)
-- com search_path seguro.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.auth_uid() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.minha_entidade_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    SELECT entidade_id FROM public.utilizadores WHERE id = public.auth_uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.eu_sou_staff() RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.utilizadores
        WHERE id = public.auth_uid() AND funcao = 'staff'
    );
$$;

-- ====================================================================
-- Atualizar policies que cobrem cross-entity leitura (apenas staff altera tudo,
-- admin/gestor só vê e altera a própria entidade).
-- (Os policies anteriores já tinham a cláusula OR. Mantemo-nos idempotentes
--  explicitamente DROP + CREATE para garantir o estado final desejado.)
-- ====================================================================

DROP POLICY IF EXISTS utilizadores_select ON public.utilizadores;
DROP POLICY IF EXISTS utilizadores_write ON public.utilizadores;

CREATE POLICY utilizadores_select ON public.utilizadores FOR SELECT USING (
    public.eu_sou_staff() OR id = public.auth_uid() OR entidade_id = public.minha_entidade_id()
);
CREATE POLICY utilizadores_write ON public.utilizadores FOR ALL USING (
    public.eu_sou_staff() OR (entidade_id = public.minha_entidade_id() AND funcao <> 'staff')
) WITH CHECK (
    public.eu_sou_staff() OR (entidade_id = public.minha_entidade_id() AND funcao <> 'staff')
);

DROP POLICY IF EXISTS entidades_select ON public.entidades;
DROP POLICY IF EXISTS entidades_update_staff ON public.entidades;
DROP POLICY IF EXISTS entidades_insert_staff ON public.entidades;
DROP POLICY IF EXISTS entidades_delete_staff ON public.entidades;

CREATE POLICY entidades_select ON public.entidades FOR SELECT USING (
    public.eu_sou_staff() OR id = public.minha_entidade_id()
);
CREATE POLICY entidades_update ON public.entidades FOR UPDATE USING (
    public.eu_sou_staff() OR id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR id = public.minha_entidade_id()
);
CREATE POLICY entidades_insert_staff ON public.entidades FOR INSERT WITH CHECK (
    public.eu_sou_staff()
);
-- DELETE policy existe mas SEMPRE bloqueado no endpoint (DELETE CASCADE aprovação user pendente)
CREATE POLICY entidades_delete_staff ON public.entidades FOR DELETE USING (
    public.eu_sou_staff()
);

DROP POLICY IF EXISTS convites_all ON public.convites;
CREATE POLICY convites_all ON public.convites FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR (entidade_id = public.minha_entidade_id() AND funcao <> 'staff')
);

DROP POLICY IF EXISTS config_entidade_all ON public.config_entidade;
CREATE POLICY config_entidade_all ON public.config_entidade FOR ALL USING (
    entidade_id = public.minha_entidade_id()
) WITH CHECK (
    entidade_id = public.minha_entidade_id()
);
-- Staff NÃO lê config_entidade por RLS. Apenas entidade própria ou service role.

DROP POLICY IF EXISTS vistas_all ON public.vistas;
CREATE POLICY vistas_all ON public.vistas FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);

DROP POLICY IF EXISTS pref_notif_all ON public.preferencias_notificacao;
CREATE POLICY pref_notif_all ON public.preferencias_notificacao FOR ALL USING (
    utilizador_id = public.auth_uid()
) WITH CHECK (
    utilizador_id = public.auth_uid()
);

DROP POLICY IF EXISTS config_relatorio_all ON public.config_relatorio;
CREATE POLICY config_relatorio_all ON public.config_relatorio FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);

DROP POLICY IF EXISTS notificacoes_all ON public.notificacoes;
CREATE POLICY notificacoes_all ON public.notificacoes FOR ALL USING (
    public.eu_sou_staff()
    OR entidade_id = public.minha_entidade_id()
    OR destinatario_id = public.auth_uid()
) WITH CHECK (
    public.eu_sou_staff()
    OR entidade_id = public.minha_entidade_id()
    OR remetente_id = public.auth_uid()
);

DROP POLICY IF EXISTS problemas_all ON public.problemas_reportados;
CREATE POLICY problemas_all ON public.problemas_reportados FOR ALL USING (
    public.eu_sou_staff()
    OR entidade_id = public.minha_entidade_id()
    OR reportado_por = public.auth_uid()
) WITH CHECK (
    public.eu_sou_staff()
    OR entidade_id = public.minha_entidade_id()
    OR reportado_por = public.auth_uid()
);

DROP POLICY IF EXISTS problema_anexos_all ON public.problemas_anexos;
CREATE POLICY problema_anexos_all ON public.problemas_anexos FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.problemas_reportados p
        WHERE p.id = problema_id
        AND (
            public.eu_sou_staff()
            OR p.entidade_id = public.minha_entidade_id()
            OR p.reportado_por = public.auth_uid()
        )
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.problemas_reportados p
        WHERE p.id = problema_id
        AND (
            public.eu_sou_staff()
            OR p.entidade_id = public.minha_entidade_id()
            OR p.reportado_por = public.auth_uid()
        )
    )
);

DROP POLICY IF EXISTS documentos_all ON public.documentos;
CREATE POLICY documentos_all ON public.documentos FOR ALL USING (
    public.eu_sou_staff()
) WITH CHECK (
    public.eu_sou_staff()
);

DROP POLICY IF EXISTS doc_variacao_all ON public.documentos_variacao;
CREATE POLICY doc_variacao_all ON public.documentos_variacao FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);

DROP POLICY IF EXISTS estado_notif_all ON public.estado_notificacoes;
CREATE POLICY estado_notif_all ON public.estado_notificacoes FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);

-- ====================================================================
-- Storage bucket policies (problemas-anexos) — já existem no 0001; reescrever
-- idempotente apenas para garantir mesma semântica cross-entity staff.
-- ====================================================================
-- Mantém as já inseridas no 0001. Não é necessário DROP/CREATE.
