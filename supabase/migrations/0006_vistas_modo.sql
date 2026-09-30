-- ============================================================
-- 0006: modo das condições de uma vista (§4.5)
-- ============================================================
-- 'e'  = a ação tem de cumprir todas as condições (AND, comportamento até aqui)
-- 'ou' = basta cumprir uma das condições (OR)

ALTER TABLE public.vistas
  ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'e'
  CHECK (modo IN ('e', 'ou'));
