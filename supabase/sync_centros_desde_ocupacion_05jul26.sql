-- Sincroniza el dato vivo de `centros` desde los partes del 05-jul-2026
-- en `ocupaciones_centros` (43 centros con reporte).
--
-- Aplicado vía MCP execute_sql el 05-jul-2026.
--
-- Qué copia por centro con parte del día:
--   data.ocupacion      ← snapshot (incl. discapacidad desde _discapacidad_total)
--   data.familias_ocupadas
--   data.total_afectados
--
-- Además:
--   - Centros SIN parte del 05-jul: ocupación/familias/total → 0
--   - Si desglose < total_afectados (solo centro-18): +Δ en adultos_h
--
-- Totales esperados en el tablero (48 campamentos activos, 43 con dato del día):
--   Refugiados 4.008 · Familias 1.304 · Mascotas 71
--   Embarazadas 46 · Niños/niñas 1.184 · Discapacidad 63
--   Funcionarios 69 (no viene del snapshot; queda en data.personal)

WITH snap AS (
  SELECT
    o.centro_id,
    o.familias,
    o.total_afectados,
    CASE
      WHEN coalesce((o.ocupacion->>'discapacidad_h')::int, 0)
         + coalesce((o.ocupacion->>'discapacidad_m')::int, 0) = 0
       AND coalesce((o.ocupacion->>'_discapacidad_total')::int, 0) > 0
      THEN o.ocupacion || jsonb_build_object(
        'discapacidad_m', coalesce((o.ocupacion->>'_discapacidad_total')::int, 0)
      )
      ELSE o.ocupacion
    END AS ocupacion_sync
  FROM ocupaciones_centros o
  WHERE o.dia = '2026-07-05'
)
UPDATE centros c
SET
  data = jsonb_set(
    jsonb_set(
      jsonb_set(c.data, '{ocupacion}', s.ocupacion_sync, true),
      '{familias_ocupadas}', to_jsonb(coalesce(s.familias, 0)), true
    ),
    '{total_afectados}', to_jsonb(coalesce(s.total_afectados, 0)), true
  ),
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'admin'
FROM snap s
WHERE s.centro_id = c.id AND NOT c.deleted;

-- Ajuste desglose vs total (centro-18)
WITH fix AS (
  SELECT o.centro_id, o.total_afectados,
    coalesce((o.ocupacion->>'recien_nacidos_h')::int,0)+
    coalesce((o.ocupacion->>'recien_nacidos_m')::int,0)+
    coalesce((o.ocupacion->>'ninos')::int,0)+
    coalesce((o.ocupacion->>'ninas')::int,0)+
    coalesce((o.ocupacion->>'adolescentes_h')::int,0)+
    coalesce((o.ocupacion->>'adolescentes_m')::int,0)+
    coalesce((o.ocupacion->>'adultos_h')::int,0)+
    coalesce((o.ocupacion->>'adultos_m')::int,0)+
    coalesce((o.ocupacion->>'adultos_mayores_h')::int,0)+
    coalesce((o.ocupacion->>'adultos_mayores_m')::int,0) AS desglose
  FROM ocupaciones_centros o WHERE o.dia = '2026-07-05'
)
UPDATE centros c
SET data = jsonb_set(
  c.data, '{ocupacion,adultos_h}',
  to_jsonb(coalesce((c.data->'ocupacion'->>'adultos_h')::int,0) + (f.total_afectados - f.desglose)),
  true
)
FROM fix f
WHERE f.centro_id = c.id AND f.desglose > 0 AND f.total_afectados > f.desglose;

-- Centros sin parte del día → cero
UPDATE centros c
SET
  data = jsonb_set(
    jsonb_set(jsonb_set(c.data, '{ocupacion}', '{}'::jsonb, true),
      '{familias_ocupadas}', '0'::jsonb, true),
    '{total_afectados}', '0'::jsonb, true
  ),
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'admin'
WHERE NOT c.deleted
  AND NOT EXISTS (
    SELECT 1 FROM ocupaciones_centros o
    WHERE o.centro_id = c.id AND o.dia = '2026-07-05'
  );
