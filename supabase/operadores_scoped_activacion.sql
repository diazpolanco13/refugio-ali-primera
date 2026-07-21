-- =============================================================================
-- Fase 1a del plan de migración de operadores a credencial propia
-- (docs/plan-migracion-operadores-password.md §4.1–§4.2) — REFERENCIA de la
-- migración aplicada: `operadores_scoped_activacion` (21-jul-2026).
--
-- 1) RLS `perfiles_select_operadores_terreno` reescrita:
--    * Antes solo cubría `username like 'operador-%'` (dejaba fuera a los
--      `op-<cédula>` del flujo v3) y daba lectura de TODA la red a
--      admin/analista/autoridad/supervisor por igual.
--    * Ahora: cualquier fila con `rol = 'operador'` (sin filtrar por prefijo).
--      Admin, autoridad y analista de red siguen viendo todos; supervisor y
--      analista con ámbito cuerpo/centros solo ven operadores cuyos
--      `centros_asignados` solapan con `mis_centros()`.
--
-- 2) Columna `perfiles.activado_ts` (bigint, null = sin credencial propia):
--    señal de avance de la migración. La escribe la Fase 2 (flujo "reclamar
--    cuenta" vía token); en Fase 1 solo se lee para el tablero.
--
-- No se recrea ninguna función SECURITY DEFINER (solo policy + columna), así
-- que el gotcha #1 de CLAUDE.md (re-grant tras CREATE OR REPLACE FUNCTION)
-- no aplica aquí.
-- =============================================================================

alter table public.perfiles
  add column if not exists activado_ts bigint;

comment on column public.perfiles.activado_ts is
  'Epoch ms en que el operador activó su credencial propia (contraseña). Null = aún entra solo por token de terreno.';

drop policy if exists perfiles_select_operadores_terreno on public.perfiles;

create policy perfiles_select_operadores_terreno
  on public.perfiles
  for select
  to authenticated
  using (
    rol = 'operador'
    and (
      (select public.mi_rol()) in ('admin', 'autoridad')
      or (select public.es_analista_total())
      or (
        (select public.mi_rol()) in ('analista_sae', 'supervisor')
        and centros_asignados && (select public.mis_centros())
      )
    )
  );
