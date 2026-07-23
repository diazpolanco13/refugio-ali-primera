-- Recalcula ocupaciones_centros.incidencias_salud = COUNT fichas del día.
-- Fuente de verdad: casos_salud_centros.reportado_dia (cualquier estatus).
-- Aplicado 2026-07-23 (corrige conteos huérfanos, p. ej. centro-10 / 2026-07-14 = 18).

UPDATE ocupaciones_centros o
SET incidencias_salud = COALESCE((
  SELECT COUNT(*)::int
  FROM casos_salud_centros c
  WHERE c.centro_id = o.centro_id AND c.reportado_dia = o.dia
), 0),
updated_at = (EXTRACT(EPOCH FROM now()) * 1000)::bigint
WHERE o.incidencias_salud IS DISTINCT FROM COALESCE((
  SELECT COUNT(*)::int
  FROM casos_salud_centros c
  WHERE c.centro_id = o.centro_id AND c.reportado_dia = o.dia
), 0);
