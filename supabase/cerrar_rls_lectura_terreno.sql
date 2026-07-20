-- =============================================================================
-- Cerrar lecturas de red para sesiones de terreno (20-jul-2026) —
-- REFERENCIA de la migración aplicada: `cerrar_rls_lectura_terreno`.
--
-- Problema: el token de terreno (QR del campamento) entrega una sesión
-- `operador` real. Con esa sesión, la RLS de lectura era demasiado abierta:
--   * `censo_registros`, `nexus_consultas`, `censo_cierres`, `censos`,
--     `distribuciones`, `limpiezas`, `lineas`, `puntos`, `sectores` → SELECT
--     con `using (true)`: CUALQUIER autenticado leía todo (censo nominal con
--     PII y campos de seguridad de los 61 campamentos, caché Nexus, etc.).
--   * `centros` → un `operador` veía TODOS los campamentos de producción,
--     no solo sus `centros_asignados`.
--
-- Escritura de censo y traslado nominal NO se ven afectados: ya van por RPC
-- `SECURITY DEFINER` (censo_registrar/actualizar/eliminar/cierre,
-- trasladar_nominal_a_centro, estado_nominal_cedula). Las 4 lecturas directas
-- del navegador (todas best-effort) se sustituyen por los RPC de abajo.
--
-- El supervisor mantiene lectura de red en `centros` (mapa de red atenuado,
-- por diseño — ver src/domain/permisos.ts). Solo se cierra `operador`.
--
-- ⚠️ CREATE OR REPLACE FUNCTION re-otorga EXECUTE a PUBLIC: se repiten los
-- revoke/grant al final (gotcha #1 de CLAUDE.md).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) RPC de reemplazo para las lecturas directas best-effort del frontend
-- ---------------------------------------------------------------------------

-- 1.a) IDs procesados de un campamento (badge "verificado" en la lista).
--      Mismo criterio de autorización que censo_marcar_procesado.
create or replace function public.censo_ids_procesados(p_centro_id text)
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rol text := (select public.mi_rol());
begin
  if coalesce(trim(p_centro_id), '') = '' then
    return;
  end if;
  if not (
    v_rol = 'admin'
    or (select public.es_analista_total())
    or (v_rol in ('analista_sae','supervisor','operador')
        and p_centro_id = any ((select public.mis_centros())::text[]))
  ) then
    return; -- sin acceso: conjunto vacío (best-effort en el cliente)
  end if;

  return query
    select r.id from public.censo_registros r
    where r.centro_id = p_centro_id and r.procesado = true;
end;
$$;

-- 1.b) Registro previo por documento (prefill de dirección al censar por
--      cédula). Cross-centro a propósito (persona que ya fue censada en otro
--      campamento). Devuelve SOLO campos de contacto/dirección — nunca los
--      campos de seguridad de censo_registros.
create or replace function public.censo_registro_por_documento(p_documento_norm text)
returns table (
  creado_en timestamptz,
  funcionario_nombre text,
  centro_id text,
  calle text,
  casa_edificio text,
  parroquia text,
  municipio text,
  estado_federativo text,
  telefono text,
  jefe_tipo_doc text,
  jefe_documento text,
  parentesco_jefe text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rol text := (select public.mi_rol());
begin
  if coalesce(trim(p_documento_norm), '') = '' then
    return;
  end if;
  if v_rol not in ('admin','analista_sae','supervisor','operador') then
    return; -- sin acceso: sin prefill
  end if;

  return query
    select r.creado_en, r.funcionario_nombre, r.centro_id, r.calle, r.casa_edificio,
           r.parroquia, r.municipio, r.estado_federativo, r.telefono,
           r.jefe_tipo_doc, r.jefe_documento, r.parentesco_jefe
    from public.censo_registros r
    where r.documento_norm = p_documento_norm
    order by r.creado_en desc nulls last
    limit 1;
end;
$$;

-- 1.c) Caché Nexus de una cédula (lookup por clave durante el censo).
create or replace function public.nexus_cache_cedula(p_letra text, p_cedula text)
returns table (data jsonb, actualizado_ts bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if (select public.mi_rol()) is null then
    return; -- sin perfil/rol: nada
  end if;
  return query
    select n.data, n.actualizado_ts
    from public.nexus_consultas n
    where n.letra = p_letra and n.cedula = p_cedula
    limit 1;
end;
$$;

-- 1.d) Caché Nexus en lote (bloque SAIME del Excel nominal). Solo roles que
--      exportan el listado (admin/analista/autoridad/supervisor).
create or replace function public.nexus_cache_lote(p_cedulas text[])
returns table (letra text, cedula text, data jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_rol text := (select public.mi_rol());
begin
  if v_rol not in ('admin','analista_sae','autoridad','supervisor') then
    return; -- sin acceso: Excel sin bloque SAIME
  end if;
  if p_cedulas is null or array_length(p_cedulas, 1) is null then
    return;
  end if;
  return query
    select n.letra, n.cedula, n.data
    from public.nexus_consultas n
    where n.cedula = any (p_cedulas);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Cerrar SELECT de las tablas con censo/PII (van por RPC SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- Censo nominal (PII + campos de seguridad): solo sala (admin/analista de
-- red/autoridad) puede leer directo; el resto opera vía RPC.
drop policy if exists censo_registros_select on public.censo_registros;
create policy censo_registros_select on public.censo_registros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin','autoridad')
    or (select public.es_analista_total())
  );

-- Caché Nexus (cédula → nombre): idem. Las lecturas del censo/Excel pasan por
-- nexus_cache_cedula / nexus_cache_lote. El upsert (INSERT/UPDATE) no requiere
-- SELECT, así que la caché se sigue poblando con normalidad.
drop policy if exists nexus_consultas_select on public.nexus_consultas;
create policy nexus_consultas_select on public.nexus_consultas
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin','autoridad')
    or (select public.es_analista_total())
  );

-- Cierres/reaperturas del censo por campamento (se leen vía RPC de censo).
drop policy if exists censo_cierres_select on public.censo_cierres;
create policy censo_cierres_select on public.censo_cierres
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin','autoridad')
    or (select public.es_analista_total())
  );

-- ---------------------------------------------------------------------------
-- 3) centros: el operador solo ve sus campamentos asignados (supervisor y
--    roles de red siguen viendo la red, sin cambios respecto al original).
-- ---------------------------------------------------------------------------
drop policy if exists centros_select on public.centros;
create policy centros_select on public.centros
  for select to authenticated
  using (
    (
      (select public.mi_rol()) = any (array['admin','autoridad','censo_rapido','supervisor'])
      or (select public.es_analista_total())
      or id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or id = any ((select public.mis_centros())::text[])
      or (id <> 'centro-prueba' and coalesce((data ->> 'es_prueba')::boolean, false) = false)
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Módulo del parque (retirado, sin lectores vivos en el frontend): cerrar
--    SELECT a admin. Se conservan las filas por si hiciera falta un backup.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['censos','distribuciones','limpiezas','lineas','puntos','sectores']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.mi_rol()) = ''admin'')',
      t || '_select', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Grants (CREATE OR REPLACE re-otorga EXECUTE a PUBLIC → repetir patrón)
-- ---------------------------------------------------------------------------
revoke all on function public.censo_ids_procesados(text) from public, anon;
grant execute on function public.censo_ids_procesados(text) to authenticated;

revoke all on function public.censo_registro_por_documento(text) from public, anon;
grant execute on function public.censo_registro_por_documento(text) to authenticated;

revoke all on function public.nexus_cache_cedula(text, text) from public, anon;
grant execute on function public.nexus_cache_cedula(text, text) to authenticated;

revoke all on function public.nexus_cache_lote(text[]) from public, anon;
grant execute on function public.nexus_cache_lote(text[]) to authenticated;
