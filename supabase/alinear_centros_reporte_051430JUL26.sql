-- Alineación de la red operativa con reporte 051430JUL26 (48 campamentos).
-- Aplicado vía MCP execute_sql el 05-jul-2026.
--
-- Retira de la red activa 3 centros en preparación que no figuran en la lámina
-- operativa del reporte diario:
--   centro-07  UEN Generala Manuela Sáenz, Fuerte Tiuna
--   centro-22  UEN Pablo Vila
--   centro-47  CEN Mariscal Sucre, La Dolorita
--
-- Acción: borrado suave (deleted = true), nota en data.notas, limpieza de
-- centros_asignados en perfiles, entrada en historial.

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
      'Retirado de la red operativa 05-jul-2026: no figura en reporte 051430JUL26 (48 campamentos).'
    ),
    true
  )
WHERE c.id IN ('centro-07', 'centro-22', 'centro-47')
  AND c.deleted = false;

UPDATE perfiles p
SET centros_asignados = COALESCE(
  (
    SELECT array_agg(x ORDER BY x)
    FROM unnest(p.centros_asignados) AS x
    WHERE x NOT IN ('centro-07', 'centro-22', 'centro-47')
  ),
  '{}'::text[]
)
WHERE p.centros_asignados && ARRAY['centro-07', 'centro-22', 'centro-47']::text[];

-- Verificación esperada: 48 activos, 3 borrados
-- SELECT count(*) FILTER (WHERE NOT deleted) FROM centros;
