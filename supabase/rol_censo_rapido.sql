-- Rol `censo_rapido` — lectura del mapa y reportes diarios de toda la red
-- (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `rol_censo_rapido`, 06-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción.
--
-- Alcance UI: /centros/mapa y /centros/reportes (sin edición).
-- Alcance RLS: SELECT en tablas operativas necesarias para esas vistas
-- (mismo patrón de lectura total que `autoridad`, sin logs ni refugiados).

alter table public.perfiles drop constraint if exists perfiles_rol_check;

alter table public.perfiles add constraint perfiles_rol_check
  check (rol in (
    'admin', 'analista_sae', 'autoridad', 'supervisor', 'operador', 'censo_rapido'
  ));

-- ---- centros ---------------------------------------------------------------
drop policy if exists centros_select on public.centros;
create policy centros_select on public.centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or id = any ((select public.mis_centros())::text[])
  );

-- ---- ocupaciones_centros ---------------------------------------------------
drop policy if exists ocupaciones_centros_select on public.ocupaciones_centros;
create policy ocupaciones_centros_select on public.ocupaciones_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or centro_id = any ((select public.mis_centros())::text[])
  );

-- ---- reportes_centros --------------------------------------------------------
drop policy if exists reportes_centros_select on public.reportes_centros;
create policy reportes_centros_select on public.reportes_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or centro_id = any ((select public.mis_centros())::text[])
  );

-- ---- incidencias_centros (resumen en mapa y reporte ejecutivo) -------------
drop policy if exists incidencias_centros_select on public.incidencias_centros;
create policy incidencias_centros_select on public.incidencias_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or centro_id = any ((select public.mis_centros())::text[])
  );

-- ---- reparaciones_centros --------------------------------------------------
drop policy if exists reparaciones_centros_select on public.reparaciones_centros;
create policy reparaciones_centros_select on public.reparaciones_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or centro_id = any ((select public.mis_centros())::text[])
  );

-- ---- reportes_reparaciones_dia ---------------------------------------------
drop policy if exists reportes_reparaciones_dia_select on public.reportes_reparaciones_dia;
create policy reportes_reparaciones_dia_select on public.reportes_reparaciones_dia
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or centro_id = any ((select public.mis_centros())::text[])
  );

-- ---- eventos_reportes (si la tabla existe en el proyecto) ------------------
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'eventos_reportes'
  ) then
    execute 'drop policy if exists eventos_reportes_select on public.eventos_reportes';
    execute $pol$
      create policy eventos_reportes_select on public.eventos_reportes
        for select to authenticated
        using (
          (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
          or centro_id = any ((select public.mis_centros())::text[])
        )
    $pol$;
  end if;
end $$;

-- ---- areas_infraestructura_centros (panel de detalle en el mapa) -----------
drop policy if exists areas_infraestructura_centros_select on public.areas_infraestructura_centros;
create policy areas_infraestructura_centros_select on public.areas_infraestructura_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
    or centro_id = any ((select public.mis_centros())::text[])
  );
