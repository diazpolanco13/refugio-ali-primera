-- ⚠️ PENDIENTE DE APLICAR (09-jul-2026, unificación de incidencias).
--
-- Retira el sistema viejo de incidencias: la tabla `incidencias_centros`
-- quedó vacía (0 filas) y sin consumidores en la app desde que el
-- seguimiento pasó a `casos_salud_centros` + `eventos_reportes`. El frontend
-- ya no la referencia (se eliminaron useIncidencias, ListaIncidencias,
-- domain/incidencias y el CRUD de reposReportes).
--
-- Aplicar vía MCP `apply_migration` (nombre sugerido:
-- `drop_incidencias_centros_legacy`) o desde el SQL Editor de Supabase.
-- El DROP arrastra índices, policies y la membresía en supabase_realtime.

drop table if exists public.incidencias_centros;
