-- Migration: Schema inicial Fluxo v1.0
-- Fonte verdade canónica: FLUXO-SPEC.md §6 + correção user (tabela obrigatória estado_notificacoes)
-- Apenas CREATEs idempotentes, sem DROP nem DELETE.
-- Projeto Supabase CRIADO em região EU. Storage bucket = EU (inherited).
-- Data: 2026-09-21
--
-- IMPORTANTE ANTES DE EXECUTAR:
--   (a) Seed de documentos §13 (flow-0..flow-5 + ajuda-inicio) só é executado
--       DEPOIS de converter os 7 MDs originais para {{VARIÁVEIS}}.
--       Ver subtarefa T16.1.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Tabelas (13)
-- ============================================================

-- 1 entidades
CREATE TABLE IF NOT EXISTS public.entidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nipc TEXT,
    ativa BOOLEAN DEFAULT true,
    suporte BOOLEAN DEFAULT false,
    setup_em DATE,
    contrato_assinado BOOLEAN DEFAULT false,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2 utilizadores
CREATE TABLE IF NOT EXISTS public.utilizadores (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    funcao TEXT NOT NULL CHECK (funcao IN ('staff','admin','gestor','leitura')) DEFAULT 'gestor',
    ultimo_acesso TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_utilizadores_entidade ON public.utilizadores(entidade_id);
CREATE INDEX IF NOT EXISTS idx_utilizadores_funcao ON public.utilizadores(funcao);

-- 3 convites
CREATE TABLE IF NOT EXISTS public.convites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    funcao TEXT NOT NULL CHECK (funcao IN ('admin','gestor','leitura')),
    token TEXT NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_convites_token ON public.convites(token);
CREATE INDEX IF NOT EXISTS idx_convites_entidade ON public.convites(entidade_id);

-- 4 config_entidade (fonte, prazos, variáveis, mapa campos, filtros)
CREATE TABLE IF NOT EXISTS public.config_entidade (
    entidade_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
    fonte_tipo TEXT DEFAULT 'airtable',
    fonte_credencial TEXT,
    fonte_base TEXT,
    mapa_campos JSONB NOT NULL DEFAULT '{}',
    filtros JSONB NOT NULL DEFAULT '{}',
    prazos JSONB NOT NULL DEFAULT '{}',
    variaveis JSONB NOT NULL DEFAULT '{}',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5 vistas
CREATE TABLE IF NOT EXISTS public.vistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
    criada_por UUID REFERENCES public.utilizadores(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    condicoes JSONB NOT NULL DEFAULT '[]',
    fixa BOOLEAN DEFAULT false,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entidade_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_vistas_entidade ON public.vistas(entidade_id);

-- 6 preferencias_notificacao (por utilizador)
CREATE TABLE IF NOT EXISTS public.preferencias_notificacao (
    utilizador_id UUID PRIMARY KEY REFERENCES public.utilizadores(id) ON DELETE CASCADE,
    eventos JSONB NOT NULL DEFAULT '{"notificado":true,"prazo":true,"bloqueio":true,"concluido":false,"falha_sync":true}',
    canais JSONB NOT NULL DEFAULT '{"app":true,"email":true}'
);

-- 7 config_relatorio
CREATE TABLE IF NOT EXISTS public.config_relatorio (
    entidade_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT true,
    dia TEXT DEFAULT 'segunda',
    hora TEXT DEFAULT '09:00',
    destinatarios TEXT[] DEFAULT '{}'
);

-- 8 notificacoes (push/bell)
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_id UUID REFERENCES public.entidades(id) ON DELETE CASCADE,
    destinatario_id UUID REFERENCES public.utilizadores(id) ON DELETE CASCADE,
    remetente_id UUID REFERENCES public.utilizadores(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL,
    corpo TEXT NOT NULL,
    acao_ref TEXT,
    lida BOOLEAN DEFAULT false,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario ON public.notificacoes(destinatario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_entidade ON public.notificacoes(entidade_id);

-- 9 problemas_reportados
CREATE TABLE IF NOT EXISTS public.problemas_reportados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
    reportado_por UUID REFERENCES public.utilizadores(id) ON DELETE SET NULL,
    flow INT NOT NULL,
    acao_ref TEXT,
    acao_nome TEXT,
    descricao TEXT NOT NULL,
    estado TEXT DEFAULT 'aberto' CHECK (estado IN ('aberto','resolvido')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_problemas_estado ON public.problemas_reportados(estado);
CREATE INDEX IF NOT EXISTS idx_problemas_entidade ON public.problemas_reportados(entidade_id);

-- 10 problemas_anexos (1:N para problemas_reportados; path aponta para storage)
CREATE TABLE IF NOT EXISTS public.problemas_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problema_id UUID NOT NULL REFERENCES public.problemas_reportados(id) ON DELETE CASCADE,
    caminho TEXT NOT NULL,
    nome TEXT NOT NULL,
    tamanho INT NOT NULL,
    apagar_em DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anexos_problema ON public.problemas_anexos(problema_id);
CREATE INDEX IF NOT EXISTS idx_anexos_apagar ON public.problemas_anexos(apagar_em);

-- 11 documentos (base global, publicado)
CREATE TABLE IF NOT EXISTS public.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    versao TEXT NOT NULL,
    flow INT,
    corpo TEXT NOT NULL,
    publicado BOOLEAN DEFAULT false,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12 documentos_variacao (por entidade, sobrepõe base)
CREATE TABLE IF NOT EXISTS public.documentos_variacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
    entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
    corpo TEXT NOT NULL,
    nota TEXT,
    versao_base TEXT NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (documento_id, entidade_id)
);
CREATE INDEX IF NOT EXISTS idx_docvar_entidade ON public.documentos_variacao(entidade_id);

-- 13 estado_notificacoes (OBRIGATÓRIA por user problema #2)
-- Serverless safe: PK composta (entidade_id, acao_ref)
-- Guarda (coluna, estado) da última vez que o cron notificou sobre esta ação.
-- Evita notificações duplicadas em cold starts independentes (Vercel).
CREATE TABLE IF NOT EXISTS public.estado_notificacoes (
    entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
    acao_ref TEXT NOT NULL,
    coluna TEXT NOT NULL,
    estado TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entidade_id, acao_ref)
);
CREATE INDEX IF NOT EXISTS idx_estado_notif_entidade ON public.estado_notificacoes(entidade_id);

-- ============================================================
-- 2. ROW LEVEL SECURITY em TODAS as tabelas
-- ============================================================

ALTER TABLE public.entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilizadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_entidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_relatorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problemas_reportados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problemas_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_variacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estado_notificacoes ENABLE ROW LEVEL SECURITY;

-- Helpers imutáveis (criar uma vez)
CREATE OR REPLACE FUNCTION public.auth_uid() RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.minha_entidade_id() RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT entidade_id FROM public.utilizadores WHERE id = public.auth_uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.eu_sou_staff() RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.utilizadores
        WHERE id = public.auth_uid() AND funcao = 'staff'
    );
$$;

-- ---------- entidades ----------
CREATE POLICY entidades_select ON public.entidades FOR SELECT USING (
    public.eu_sou_staff() OR id = public.minha_entidade_id()
);
CREATE POLICY entidades_update_staff ON public.entidades FOR UPDATE USING (public.eu_sou_staff());
CREATE POLICY entidades_insert_staff ON public.entidades FOR INSERT WITH CHECK (public.eu_sou_staff());
-- Nota: DELETE entidades requer confirmação explícita do user (operação SQL CASCADE destrutiva).
--       Policy aqui existe mas o endpoint /api/admin/entidades DELETE está bloqueado.
CREATE POLICY entidades_delete_staff ON public.entidades FOR DELETE USING (public.eu_sou_staff());

-- ---------- utilizadores ----------
CREATE POLICY utilizadores_select ON public.utilizadores FOR SELECT USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);
CREATE POLICY utilizadores_write ON public.utilizadores FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);

-- ---------- convites ----------
CREATE POLICY convites_all ON public.convites FOR ALL USING (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
) WITH CHECK (
    public.eu_sou_staff() OR entidade_id = public.minha_entidade_id()
);

-- ---------- config_entidade ----------
-- Staff NÃO acede. Apenas entidade e service role server-side.
-- (§8.4 valores cifrados nunca chegam ao cliente nem a staff.)
CREATE POLICY config_entidade_propria ON public.config_entidade FOR ALL USING (
    entidade_id = public.minha_entidade_id()
) WITH CHECK (
    entidade_id = public.minha_entidade_id()
);

-- ---------- vistas ----------
CREATE POLICY vistas_entidade ON public.vistas FOR ALL USING (
    entidade_id = public.minha_entidade_id() OR public.eu_sou_staff()
) WITH CHECK (
    entidade_id = public.minha_entidade_id() OR public.eu_sou_staff()
);

-- ---------- preferencias_notificacao ----------
CREATE POLICY pref_proprias ON public.preferencias_notificacao FOR ALL USING (
    utilizador_id = public.auth_uid()
) WITH CHECK (
    utilizador_id = public.auth_uid()
);

-- ---------- config_relatorio ----------
CREATE POLICY relatorio_entidade ON public.config_relatorio FOR ALL USING (
    entidade_id = public.minha_entidade_id()
) WITH CHECK (
    entidade_id = public.minha_entidade_id()
);

-- ---------- notificacoes ----------
CREATE POLICY notif_proprias ON public.notificacoes FOR SELECT USING (
    destinatario_id = public.auth_uid() OR
    entidade_id = public.minha_entidade_id()
);
CREATE POLICY notif_lidas ON public.notificacoes FOR UPDATE USING (
    destinatario_id = public.auth_uid()
);

-- ---------- problemas_reportados ----------
CREATE POLICY problemas_select ON public.problemas_reportados FOR SELECT USING (
    public.eu_sou_staff() OR
    reportado_por = public.auth_uid() OR
    entidade_id = public.minha_entidade_id()
);
CREATE POLICY problemas_write ON public.problemas_reportados FOR INSERT WITH CHECK (
    reportado_por = public.auth_uid()
);
CREATE POLICY problemas_update_staff ON public.problemas_reportados FOR UPDATE USING (
    public.eu_sou_staff()
);

-- ---------- problemas_anexos ----------
-- Acesso é feito via storage policies; a tabela só guarda metadados.
CREATE POLICY anexos_select ON public.problemas_anexos FOR SELECT USING (
    public.eu_sou_staff() OR EXISTS (
        SELECT 1 FROM public.problemas_reportados p
        WHERE p.id = problema_id
          AND (p.reportado_por = public.auth_uid() OR p.entidade_id = public.minha_entidade_id())
    )
);

-- ---------- documentos ----------
-- Global publicado: todos autenticados lêem. Staff escreve.
CREATE POLICY doc_read ON public.documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY doc_write_staff ON public.documentos FOR ALL USING (public.eu_sou_staff()) WITH CHECK (public.eu_sou_staff());

-- ---------- documentos_variacao ----------
CREATE POLICY docvar_entidade ON public.documentos_variacao FOR ALL USING (
    entidade_id = public.minha_entidade_id()
) WITH CHECK (
    entidade_id = public.minha_entidade_id()
);

-- ---------- estado_notificacoes ----------
-- Apenas entidade (ou service role via bypass) lê/escreve.
CREATE POLICY estado_notif_entidade ON public.estado_notificacoes FOR ALL USING (
    entidade_id = public.minha_entidade_id()
) WITH CHECK (
    entidade_id = public.minha_entidade_id()
);

-- ============================================================
-- 3. Trigger: ao criar entidade → seed 2 vistas + defaults config
-- ============================================================

CREATE OR REPLACE FUNCTION public.entidade_recor_criar_defaults()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
    -- vistas seeded: "Todas" e "A precisar de atenção" (§4.5)
    INSERT INTO public.vistas (entidade_id, nome, condicoes, fixa)
    VALUES
        (NEW.id, 'Todas', '[]'::jsonb, true),
        (NEW.id, 'A precisar de atenção',
            jsonb_build_array(
                jsonb_build_object('campo','estado','op','em','val',jsonb_build_array('late','today','blocked','error'))
            ),
            false)
    ON CONFLICT (entidade_id, nome) DO NOTHING;

    -- config_entidade vazia placeholder (garante EXISTS por entidade)
    INSERT INTO public.config_entidade (entidade_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

    -- config_relatorio defaults
    INSERT INTO public.config_relatorio (entidade_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_entidade_defaults ON public.entidades;
CREATE TRIGGER tg_entidade_defaults
AFTER INSERT ON public.entidades
FOR EACH ROW EXECUTE FUNCTION public.entidade_recor_criar_defaults();

-- ============================================================
-- 4. Storage bucket (problemas-anexos, private, EU region)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'problemas-anexos',
    'problemas-anexos',
    FALSE,
    5242880,
    ARRAY['image/png','image/jpeg','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Policies: utilizador só vê/cria/apaga os seus; staff vê tudo.
CREATE POLICY "anexos_upload_proprio" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (
        bucket_id = 'problemas-anexos'
        AND (storage.foldername(name))[1] = public.auth_uid()::text
    );

CREATE POLICY "anexos_ler_proprio_ou_staff" ON storage.objects
    FOR SELECT TO public
    USING (
        bucket_id = 'problemas-anexos' AND (
            public.eu_sou_staff()
            OR (storage.foldername(name))[1] = public.auth_uid()::text
        )
    );

CREATE POLICY "anexos_apagar_proprio" ON storage.objects
    FOR DELETE TO public
    USING (
        bucket_id = 'problemas-anexos'
        AND (storage.foldername(name))[1] = public.auth_uid()::text
    );

-- ============================================================
-- 5. Seed de documentos globais (FLOW 0..5 + ajuda-inicio)
--    SÓ executar DEPOIS de converter MDs originais → {{VARIÁVEIS}}.
--    Atualizar os campos abaixo quando os 7 MDs forem recebidos
--    e a subtarefa T16.1 estiver concluída.
--
--    Placeholders obrigatórios para não introduzir credenciais literais:
--      {{SIGO_URL}}
--      {{SIGO_UTILIZADOR}}
--      {{CRM_TIPO}}
--      {{CRM_BASE}}
--      {{CRM_TOKEN}}
--      {{TBL_ACOES}}
--      {{TBL_FORMANDOS}}
--      {{TBL_LOGS}}
--      {{AREA_FORMACAO}}
--      {{REGIME}}
-- ============================================================
--
-- INSERT INTO public.documentos (nome, versao, flow, corpo, publicado)
-- VALUES
--   ('flow-0',         '1.0', 0,  '…MD convertido para placeholders…', true),
--   ('flow-1',         '1.0', 1,  '…',                                    true),
--   ('flow-2',         '1.0', 2,  '…',                                    true),
--   ('flow-3',         '1.0', 3,  '…',                                    true),
--   ('flow-4',         '1.0', 4,  '…',                                    true),
--   ('flow-5',         '1.0', 5,  '…',                                    true),
--   ('ajuda-inicio',   '1.0', NULL, '…',                                  true)
-- ON CONFLICT (nome) DO NOTHING;
--

-- Fim migration v1.
