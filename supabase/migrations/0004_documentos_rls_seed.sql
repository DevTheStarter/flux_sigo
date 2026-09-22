-- Migration 0004 v3: Documentação (RLS + colunas em falta + seed 7 MDs placeholder)
-- Data: 2026-09-22
-- Compatibilidade: PostgreSQL 14 / 15 / 16 (Supabase standard)
--
-- Correções de compatibilidade aplicadas nesta revisão:
--   1. CREATE POLICY IF NOT EXISTS NÃO EXISTE em Postgres < 17.
--      Usamos blocos DO que consultam pg_policy antes de CREATE POLICY.
--   2. CREATE OR REPLACE FUNCTION pg_temp.* não sobrevive bem entre
--      batches separados do SQL Editor. Helper inline em cada bloco.
--   3. ADD COLUMN IF NOT EXISTS é suportado desde Postgres 14, por isso
--      usamos a forma nativa e retiramos os DO blocks com exception.
--   4. RENAME COLUMN só existe sem IF; protegido por information_schema.
--   5. ALTER TABLE ... ENABLE ROW LEVEL SECURITY é idempotente (no-op
--      quando já está enabled; error safe no Postgres moderno).
--
-- NÃO contém DELETE/DROP/TRUNCATE de dados de entidades ou clientes.

-- ============================================================
-- Bloco 1: colunas em falta em public.config_entidade
-- (ADD COLUMN IF NOT EXISTS suportado Postgres 14+)
-- ============================================================
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS fonte_tabela_acoes TEXT;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS fonte_tabela_formandos TEXT;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS fonte_tabela_registos TEXT;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS prazo_entrada_dias INTEGER DEFAULT 15;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS aviso_prazo_dias INTEGER DEFAULT 3;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS area_formacao_default TEXT;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS regime_default TEXT;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS sigo_url TEXT;
ALTER TABLE public.config_entidade ADD COLUMN IF NOT EXISTS sigo_utilizador TEXT;

-- ============================================================
-- Bloco 2: config_relatorio.dia → dia_semana
--   RENAME sem IF; check em information_schema
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'config_relatorio'
          AND column_name  = 'dia'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'config_relatorio'
          AND column_name  = 'dia_semana'
    ) THEN
        ALTER TABLE public.config_relatorio RENAME COLUMN dia TO dia_semana;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'config_relatorio'
          AND column_name  = 'dia_semana'
    ) THEN
        ALTER TABLE public.config_relatorio ADD COLUMN dia_semana TEXT DEFAULT 'segunda';
    END IF;
END $$;

-- ============================================================
-- Bloco 3: RLS + policies em documentos e documentos_variacao
-- ============================================================
ALTER TABLE IF EXISTS public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documentos_variacao ENABLE ROW LEVEL SECURITY;

-- 3a. tabela `documentos`
DO $$
DECLARE policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'documentos'
          AND p.polname = 'documentos_select_autenticados'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
        CREATE POLICY documentos_select_autenticados
            ON public.documentos FOR SELECT
            USING (auth_uid() IS NOT NULL);
    END IF;
END $$;

DO $$
DECLARE policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'documentos'
          AND p.polname = 'documentos_insert_staff'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
        CREATE POLICY documentos_insert_staff
            ON public.documentos FOR INSERT
            WITH CHECK (eu_sou_staff());
    END IF;
END $$;

DO $$
DECLARE policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'documentos'
          AND p.polname = 'documentos_update_staff'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
        CREATE POLICY documentos_update_staff
            ON public.documentos FOR UPDATE
            USING (eu_sou_staff()) WITH CHECK (eu_sou_staff());
    END IF;
END $$;

-- 3b. tabela `documentos_variacao`
DO $$
DECLARE policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'documentos_variacao'
          AND p.polname = 'documentos_variacao_select_own_or_staff'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
        CREATE POLICY documentos_variacao_select_own_or_staff
            ON public.documentos_variacao FOR SELECT
            USING (eu_sou_staff() OR entidade_id = minha_entidade_id());
    END IF;
END $$;

DO $$
DECLARE policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'documentos_variacao'
          AND p.polname = 'documentos_variacao_insert_staff'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
        CREATE POLICY documentos_variacao_insert_staff
            ON public.documentos_variacao FOR INSERT
            WITH CHECK (eu_sou_staff());
    END IF;
END $$;

DO $$
DECLARE policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'documentos_variacao'
          AND p.polname = 'documentos_variacao_update_staff'
    ) INTO policy_exists;
    IF NOT policy_exists THEN
        CREATE POLICY documentos_variacao_update_staff
            ON public.documentos_variacao FOR UPDATE
            USING (eu_sou_staff()) WITH CHECK (eu_sou_staff());
    END IF;
END $$;

-- Índices (CREATE INDEX IF NOT EXISTS existe Postgres 9.5+)
CREATE INDEX IF NOT EXISTS idx_documentos_nome
    ON public.documentos(nome);
CREATE INDEX IF NOT EXISTS idx_documentos_variacao_doc_ent
    ON public.documentos_variacao(documento_id, entidade_id);

-- ============================================================
-- Bloco 4: Seed 7 documentos (placeholder v1, idempotente)
-- ============================================================
INSERT INTO public.documentos (id, nome, versao, flow, corpo, publicado, atualizado_em)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'flow-0',
    'placeholder-v1',
    0,
    E'# Flow 0 — Recolha de dados\n\n*Conteúdo a carregar pelo Fluxo-Admin (entrega dos 7 MDs originais).*\n\n## Objectivo\n\n{{ENTIDADE_NOME}} — preencher esta página quando os documentos originais forem carregados na tabela `documentos` pela equipa TheStarter.\n',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'flow-1',
    'placeholder-v1',
    1,
    E'# Flow 1 — Perfis de formandos\n\n*Conteúdo a carregar pelo Fluxo-Admin.*\n\n{{ENTIDADE_NOME}}\n',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'flow-2',
    'placeholder-v1',
    2,
    E'# Flow 2 — Curso e módulos\n\n*Conteúdo a carregar pelo Fluxo-Admin.*\n',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'flow-3',
    'placeholder-v1',
    3,
    E'# Flow 3 — Criação da ação\n\n*Conteúdo a carregar pelo Fluxo-Admin.*\n',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'flow-4',
    'placeholder-v1',
    4,
    E'# Flow 4 — Inscrição e certificação\n\n*Conteúdo a carregar pelo Fluxo-Admin.*\n',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    'flow-5',
    'placeholder-v1',
    5,
    E'# Flow 5 — Conclusão\n\n*Conteúdo a carregar pelo Fluxo-Admin.*\n',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000007',
    'ajuda-inicio',
    'placeholder-v1',
    NULL,
    E'# Ajuda · primeiro acesso\n\n*Conteúdo a carregar pelo Fluxo-Admin.*\n\nBem-vindo ao Fluxo. Esta secção explica primeiro acesso, Ligação de dados e {{CRM_BASE_URL}}.\n',
    true,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
