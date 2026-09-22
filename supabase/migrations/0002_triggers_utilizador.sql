-- Fluxo 0002 (v2, corrige 4 mismatches com 0001_schema_inicial.sql canonical):
--   a) entidades: colunas corretas (nome, nipc, ativa, suporte, setup_em, contrato_assinado)
--      => uso no INSERT externo; esta migration não toca entidades
--   b) utilizadores.funcao (antes papel errado) + utilizadores.nome é NOT NULL
--   c) preferencias_notificacao PK = só utilizador_id (não composta),
--      JSON defaults eventos = {"notificado":true,"prazo":true,"bloqueio":true,"concluido":false,"falha_sync":true}
--      e canais = {"app":true,"email":true}
--   d) convites.expira_em TIMESTAMPTZ (antes data_expiracao DATE errado)
--   e) config_relatorio PK = só entidade_id (não composta por user+ent)
--      => por isso não inserimos por user, só seed uma vez por entidade no trigger tg_entidade_defaults.

-- ====================================================================
-- TRIGGER 1: utilizadores.onInsert -> preferencias_notificacao default (1 row / user)
-- ====================================================================
CREATE OR REPLACE FUNCTION tg_utilizador_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO preferencias_notificacao (utilizador_id, eventos, canais)
  VALUES (
    NEW.id,
    '{"notificado":true,"prazo":true,"bloqueio":true,"concluido":false,"falha_sync":true}'::jsonb,
    '{"app":true,"email":true}'::jsonb
  )
  ON CONFLICT (utilizador_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_utilizador_defaults ON utilizadores;
CREATE TRIGGER trg_utilizador_defaults
AFTER INSERT ON utilizadores
FOR EACH ROW EXECUTE FUNCTION tg_utilizador_defaults();

-- ====================================================================
-- TRIGGER 2: convites.onInsert -> expira_em default 7 dias a partir de agora (TIMESTAMPTZ)
-- ====================================================================
CREATE OR REPLACE FUNCTION tg_convite_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expira_em IS NULL THEN
    NEW.expira_em := NOW() + INTERVAL '7 days';
  END IF;
  -- Sempre definir token se não vier (UUIDv4 em base64url safe reduzido).
  IF NEW.token IS NULL THEN
    NEW.token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_convite_defaults ON convites;
CREATE TRIGGER trg_convite_defaults
BEFORE INSERT ON convites
FOR EACH ROW EXECUTE FUNCTION tg_convite_defaults();

-- ====================================================================
-- TRIGGER 3: entidades.onInsert -> 2 vistas padrão (Ativas, Concluídas) + config_relatorio default
-- (migração 0001 já tinha tg_entidade_defaults; substituímos por versão compatível com schema real)
-- ====================================================================
CREATE OR REPLACE FUNCTION tg_entidade_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_ativas_condicoes jsonb;
  v_concluidas_condicoes jsonb;
BEGIN
  v_ativas_condicoes := '[]'::jsonb;
  v_concluidas_condicoes := '[]'::jsonb;

  INSERT INTO vistas (entidade_id, nome, condicoes, fixa)
  VALUES (NEW.id, 'Ativas', v_ativas_condicoes, true)
  ON CONFLICT (entidade_id, nome) DO NOTHING;

  INSERT INTO vistas (entidade_id, nome, condicoes, fixa)
  VALUES (NEW.id, 'Concluídas', v_concluidas_condicoes, true)
  ON CONFLICT (entidade_id, nome) DO NOTHING;

  INSERT INTO config_entidade (entidade_id)
  VALUES (NEW.id)
  ON CONFLICT (entidade_id) DO NOTHING;

  INSERT INTO config_relatorio (entidade_id, ativo, dia, hora, destinatarios)
  VALUES (NEW.id, true, 'segunda', '09:00', '{}'::text[])
  ON CONFLICT (entidade_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_entidade_defaults ON entidades;
CREATE TRIGGER trg_entidade_defaults
AFTER INSERT ON entidades
FOR EACH ROW EXECUTE FUNCTION tg_entidade_defaults();
