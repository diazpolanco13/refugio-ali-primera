-- Sistema de usuarios con 5 roles y permisos por centro (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `sistema_usuarios_5_roles`, 04-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- que corre en producción, igual que `functions.sql`.
--
-- Cambios (ver docs/sistema-usuarios.md):
--   1. Roles nuevos: admin, analista_sae, autoridad, supervisor, operador
--      (migración: coordinador→supervisor, campo→operador, visor→autoridad;
--      xavier→analista_sae por decisión del despliegue).
--   2. `perfiles.sector_asignado` (text, un centro) → `centros_asignados`
--      (text[], uno o varios centros).
--   3. `incidencias_centros.creada_por` para la regla "el operador solo
--      resuelve las incidencias que él creó".
--   4. Helpers `mi_rol()` / `mis_centros()` / `mi_username()` (SECURITY
--      DEFINER, estables) para las policies, sin recursión sobre `perfiles`.
--   5. Reescritura de las RLS de centros / ocupaciones_centros /
--      reportes_centros / incidencias_centros / perfiles / historial según la
--      matriz de permisos por rol + centro asignado.
--   6. `historial` entra en la publicación Realtime (vista /logs en vivo).
--
-- Las 6 tablas blob del módulo retirado del parque (sectores, puntos, lineas,
-- censos, distribuciones, limpiezas) conservan sus policies viejas: los roles
-- 'coordinador'/'campo' ya no existen, así que en la práctica quedan
-- de solo lectura salvo para admin. No se tocan (módulo retirado).

-- ============================================================================
-- 1) perfiles: centros_asignados[] + roles nuevos
-- ============================================================================

-- Las policies viejas de perfiles referencian sector_asignado → hay que
-- soltarlas antes de tirar la columna (se recrean en la sección 4).
drop policy if exists perfiles_select on public.perfiles;
drop policy if exists perfiles_insert on public.perfiles;
drop policy if exists perfiles_update on public.perfiles;
drop policy if exists perfiles_delete on public.perfiles;

alter table public.perfiles
  add column centros_asignados text[] not null default '{}';

update public.perfiles
  set centros_asignados = array[sector_asignado]
  where sector_asignado is not null and sector_asignado <> '';

alter table public.perfiles drop column sector_asignado;

alter table public.perfiles drop constraint perfiles_rol_check;

update public.perfiles set rol = case rol
  when 'coordinador' then 'supervisor'
  when 'campo' then 'operador'
  when 'visor' then 'autoridad'
  else rol
end;

-- Decisión de despliegue: xavier pasa a analista SAE (homólogo operativo del
-- admin, sin gestión de usuarios ni logs).
update public.perfiles set rol = 'analista_sae' where username = 'xavier';

alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'analista_sae', 'autoridad', 'supervisor', 'operador'));

alter table public.perfiles alter column rol set default 'operador';

-- ============================================================================
-- 2) incidencias_centros: quién creó la incidencia (updated_by se pisa en
--    cada update, así que se necesita una columna estable).
-- ============================================================================

alter table public.incidencias_centros add column creada_por text;
update public.incidencias_centros set creada_por = updated_by where creada_por is null;

-- ============================================================================
-- 3) Helpers para las policies. SECURITY DEFINER: leen `perfiles` sin pasar
--    por su RLS (evita recursión y subqueries repetidas). STABLE: dentro de
--    un statement ven el snapshot inicial (los "valores viejos" en updates).
--    Se usan como `(select public.mi_rol())` → initplan, se evalúan una vez.
-- ============================================================================

create or replace function public.mi_rol()
returns text
language sql stable security definer
set search_path = ''
as $$
  select rol from public.perfiles where user_id = auth.uid()
$$;

create or replace function public.mis_centros()
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(centros_asignados, '{}') from public.perfiles where user_id = auth.uid()
$$;

create or replace function public.mi_username()
returns text
language sql stable security definer
set search_path = ''
as $$
  select username from public.perfiles where user_id = auth.uid()
$$;

-- Necesario para el chequeo de hash_id inmutable en perfiles_update: un
-- subselect directo sobre perfiles dentro de su propia policy dispara
-- "infinite recursion detected in policy" (corregido en la migración
-- fix_recursion_perfiles_update).
create or replace function public.mi_hash_id()
returns text
language sql stable security definer
set search_path = ''
as $$
  select hash_id from public.perfiles where user_id = auth.uid()
$$;

revoke execute on function public.mi_rol() from public, anon;
revoke execute on function public.mis_centros() from public, anon;
revoke execute on function public.mi_username() from public, anon;
revoke execute on function public.mi_hash_id() from public, anon;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.mis_centros() to authenticated;
grant execute on function public.mi_username() to authenticated;
grant execute on function public.mi_hash_id() to authenticated;

-- ============================================================================
-- 4) RLS — matriz de permisos
--    Alcance total lectura: admin, analista_sae, autoridad.
--    Alcance total escritura: admin, analista_sae.
--    Alcance por centros asignados: supervisor, operador.
--    autoridad: solo lectura en todo.
-- ============================================================================

-- ---- centros -----------------------------------------------------------

drop policy if exists centros_select on public.centros;
drop policy if exists centros_insert on public.centros;
drop policy if exists centros_update on public.centros;
drop policy if exists centros_delete on public.centros;

create policy centros_select on public.centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or id = any ((select public.mis_centros())::text[])
  );

create policy centros_insert on public.centros
  for insert to authenticated
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));

create policy centros_update on public.centros
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and id = any ((select public.mis_centros())::text[])
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and id = any ((select public.mis_centros())::text[])
    )
  );

create policy centros_delete on public.centros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ---- ocupaciones_centros -------------------------------------------------

drop policy if exists ocupaciones_centros_select on public.ocupaciones_centros;
drop policy if exists ocupaciones_centros_insert on public.ocupaciones_centros;
drop policy if exists ocupaciones_centros_update on public.ocupaciones_centros;
drop policy if exists ocupaciones_centros_delete on public.ocupaciones_centros;

create policy ocupaciones_centros_select on public.ocupaciones_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy ocupaciones_centros_insert on public.ocupaciones_centros
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy ocupaciones_centros_update on public.ocupaciones_centros
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy ocupaciones_centros_delete on public.ocupaciones_centros
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

-- ---- reportes_centros ------------------------------------------------------

drop policy if exists reportes_centros_select on public.reportes_centros;
drop policy if exists reportes_centros_insert on public.reportes_centros;
drop policy if exists reportes_centros_update on public.reportes_centros;
drop policy if exists reportes_centros_delete on public.reportes_centros;

create policy reportes_centros_select on public.reportes_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy reportes_centros_insert on public.reportes_centros
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy reportes_centros_update on public.reportes_centros
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy reportes_centros_delete on public.reportes_centros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ---- incidencias_centros ---------------------------------------------------
-- El operador solo puede modificar (= resolver/editar) las incidencias que él
-- mismo creó (`creada_por`), y siempre dentro de sus centros. El supervisor
-- modifica cualquiera de sus centros. admin/analista_sae, cualquiera.

drop policy if exists incidencias_centros_select on public.incidencias_centros;
drop policy if exists incidencias_centros_insert on public.incidencias_centros;
drop policy if exists incidencias_centros_update on public.incidencias_centros;
drop policy if exists incidencias_centros_delete on public.incidencias_centros;

create policy incidencias_centros_select on public.incidencias_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy incidencias_centros_insert on public.incidencias_centros
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy incidencias_centros_update on public.incidencias_centros
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
    or (
      (select public.mi_rol()) = 'operador'
      and centro_id = any ((select public.mis_centros())::text[])
      and creada_por = (select public.mi_username())
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
    or (
      (select public.mi_rol()) = 'operador'
      and centro_id = any ((select public.mis_centros())::text[])
      and creada_por = (select public.mi_username())
    )
  );

create policy incidencias_centros_delete on public.incidencias_centros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ---- perfiles --------------------------------------------------------------
-- Solo admin ve todos los perfiles (incluido hash_id); cada usuario ve el
-- suyo. Nadie más necesita leer perfiles ajenos: `updated_by` guarda el
-- username en texto en todas las tablas.

drop policy if exists perfiles_select on public.perfiles;
drop policy if exists perfiles_insert on public.perfiles;
drop policy if exists perfiles_update on public.perfiles;
drop policy if exists perfiles_delete on public.perfiles;

create policy perfiles_select on public.perfiles
  for select to authenticated
  using ((select public.mi_rol()) = 'admin' or auth.uid() = user_id);

create policy perfiles_insert on public.perfiles
  for insert to authenticated
  with check ((select public.mi_rol()) = 'admin');

-- El propio usuario puede editar su perfil pero NO cambiar su rol, sus
-- centros asignados ni su hash_id (inmutable). Los helpers STABLE ven los
-- valores viejos dentro del mismo statement.
create policy perfiles_update on public.perfiles
  for update to authenticated
  using ((select public.mi_rol()) = 'admin' or auth.uid() = user_id)
  with check (
    (select public.mi_rol()) = 'admin'
    or (
      auth.uid() = user_id
      and rol = (select public.mi_rol())
      and centros_asignados = (select public.mis_centros())
      and hash_id is not distinct from (select public.mi_hash_id())
    )
  );

create policy perfiles_delete on public.perfiles
  for delete to authenticated
  using ((select public.mi_rol()) = 'admin');

-- ---- historial ---------------------------------------------------------------
-- Solo admin y analista_sae leen la bitácora. Los roles operativos insertan
-- sus acciones pero no las leen. Sin update (bitácora append-only).

drop policy if exists historial_select on public.historial;
drop policy if exists historial_insert on public.historial;
drop policy if exists historial_update on public.historial;
drop policy if exists historial_delete on public.historial;

create policy historial_select on public.historial
  for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

create policy historial_insert on public.historial
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'supervisor', 'operador')
  );

create policy historial_delete on public.historial
  for delete to authenticated
  using ((select public.mi_rol()) = 'admin');

-- ============================================================================
-- 5) Realtime para la vista /logs
-- ============================================================================

alter publication supabase_realtime add table public.historial;
