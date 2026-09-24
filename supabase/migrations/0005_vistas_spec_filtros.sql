-- ============================================================
-- 0005: vistas semeadas conforme a spec (§4.5) e filtros por defeito (§7.3)
-- ============================================================
-- A spec semeia duas vistas por entidade: "Todas" (sem condições, fixa) e
-- "A precisar de atenção" (estado em late, today, blocked, error). O trigger
-- anterior criava "Ativas" e "Concluídas", ambas sem condições.
-- Formato das condições: [{"campo":"estado","op":"em","val":"late,today,blocked,error"}]
-- (lib/cliente/vistas.ts lerCondicoes).

-- 1. Trigger de defaults da entidade
CREATE OR REPLACE FUNCTION tg_entidade_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vistas (entidade_id, nome, condicoes, fixa)
  VALUES (NEW.id, 'Todas', '[]'::jsonb, true)
  ON CONFLICT (entidade_id, nome) DO NOTHING;

  INSERT INTO vistas (entidade_id, nome, condicoes, fixa)
  VALUES (
    NEW.id,
    'A precisar de atenção',
    '[{"campo":"estado","op":"em","val":"late,today,blocked,error"}]'::jsonb,
    true
  )
  ON CONFLICT (entidade_id, nome) DO NOTHING;

  -- Filtros por defeito (§7.3): Estado ≠ Descontinuado, Formato = PT.
  -- Chaves são os nossos nomes de campo; o adaptador traduz via mapa_campos.
  INSERT INTO config_entidade (entidade_id, filtros)
  VALUES (NEW.id, '{"estado":{"$neq":"Descontinuado"},"formato":"PT"}'::jsonb)
  ON CONFLICT (entidade_id) DO NOTHING;

  INSERT INTO config_relatorio (entidade_id, ativo, dia_semana, hora, destinatarios)
  VALUES (NEW.id, true, 'segunda', '09:00', '{}'::text[])
  ON CONFLICT (entidade_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_entidade_defaults ON entidades;
CREATE TRIGGER trg_entidade_defaults
AFTER INSERT ON entidades
FOR EACH ROW EXECUTE FUNCTION tg_entidade_defaults();

-- O trigger de 0001 (sem SECURITY DEFINER) esbarrava na RLS de config_entidade
-- quando a entidade era criada com a sessão do staff. Fica só um trigger.
DROP TRIGGER IF EXISTS tg_entidade_defaults ON public.entidades;
DROP FUNCTION IF EXISTS public.entidade_recor_criar_defaults();

-- 2. Entidades existentes: "Ativas" (fixa, sem condições) passa a "Todas";
--    "Concluídas" (fixa, sem condições) desaparece por ser um duplicado;
--    "A precisar de atenção" é acrescentada onde falta.
UPDATE vistas v
SET nome = 'Todas'
WHERE v.nome = 'Ativas' AND v.fixa = true AND v.condicoes = '[]'::jsonb
  AND NOT EXISTS (SELECT 1 FROM vistas t WHERE t.entidade_id = v.entidade_id AND t.nome = 'Todas');

DELETE FROM vistas v
WHERE v.nome = 'Concluídas' AND v.fixa = true AND v.condicoes = '[]'::jsonb;

INSERT INTO vistas (entidade_id, nome, condicoes, fixa)
SELECT e.id, 'Todas', '[]'::jsonb, true
FROM entidades e
ON CONFLICT (entidade_id, nome) DO NOTHING;

INSERT INTO vistas (entidade_id, nome, condicoes, fixa)
SELECT e.id, 'A precisar de atenção', '[{"campo":"estado","op":"em","val":"late,today,blocked,error"}]'::jsonb, true
FROM entidades e
ON CONFLICT (entidade_id, nome) DO NOTHING;

-- 3. estado_notificacoes: o cron guarda também uma linha "__sync" por entidade
--    com o estado da última leitura (ok/falha). Nada a alterar no schema.
