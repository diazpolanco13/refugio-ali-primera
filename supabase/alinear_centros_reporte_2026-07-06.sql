-- Alineación con reporte campamentos_damnificados_2026-07-06 (61 campamentos).
-- Aplicado vía MCP execute_sql el 06-jul-2026.
--
-- Retira de la red activa centro-15 (ETI Rafael Vega), que no figura en el
-- reporte oficial. Los obsoletos centro-07, centro-22 y centro-47 ya estaban
-- en borrado suave desde alinear_centros_reporte_051430JUL26.sql.
--
-- Resultado esperado: 61 activos, 4 eliminados.

UPDATE centros c
SET
  deleted = true,
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'admin',
  data = jsonb_set(
    c.data,
    '{notas}',
    to_jsonb(
      coalesce(nullif(c.data->>'notas', ''), '') ||
      CASE WHEN coalesce(c.data->>'notas', '') = '' THEN '' ELSE ' | ' END ||
      'Retirado de la red operativa 06-jul-2026: no figura en reporte campamentos_damnificados_2026-07-06 (61 campamentos).'
    ),
    true
  )
WHERE c.id = 'centro-15'
  AND c.deleted = false;

UPDATE perfiles p
SET centros_asignados = COALESCE(
  (
    SELECT array_agg(x ORDER BY x)
    FROM unnest(p.centros_asignados) AS x
    WHERE x NOT IN ('centro-07', 'centro-15', 'centro-22', 'centro-47')
  ),
  '{}'::text[]
)
WHERE p.centros_asignados && ARRAY['centro-07', 'centro-15', 'centro-22', 'centro-47']::text[];
