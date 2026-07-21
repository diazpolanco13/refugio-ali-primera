-- =============================================================================
-- Fase 1b (parcial) del plan de migración de operadores
-- (docs/plan-migracion-operadores-password.md §5) — REFERENCIA de la migración
-- aplicada: `operadores_gestion_supervisor` (21-jul-2026).
--
-- 1) `perfiles_update`: el supervisor puede actualizar filas de operador que
--    solapen con `mis_centros()` (aprobación, alertas, centros). El analista
--    con ámbito cuerpo/centros queda igualmente acotado a su alcance (antes
--    llegaba a cualquier operador de la red); el analista de red mantiene
--    alcance total. Ningún rol no-admin puede tocar filas que no sean de
--    operador ni su propia fila por esta vía.
--
-- 2) `centros_de_usuario(uuid)`: mismo cálculo que `mis_centros()` pero para
--    un usuario arbitrario. SOLO service_role (la usan las edge functions
--    para validar alcance del caller contra el objetivo).
--
-- 3) `puede_gestionar_operador(caller, objetivo)`: regla de §5.2 — admin
--    siempre; analista de red siempre que el objetivo sea operador; analista
--    con ámbito / supervisor solo si comparte al menos un centro con el
--    operador. SOLO service_role (autorización de `delete-user` y próximos
--    `create-user` / `update-user-password` scoped).
--
-- ⚠️ Gotcha #1 CLAUDE.md: CREATE OR REPLACE FUNCTION re-otorga EXECUTE a
-- PUBLIC → revoke/grant explícitos al final para las dos funciones nuevas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) perfiles_update con rama de supervisor y analista acotado
-- ---------------------------------------------------------------------------
drop policy if exists perfiles_update on public.perfiles;

create policy perfiles_update on public.perfiles
  for update to authenticated
  using (
    (select public.mi_rol()) = 'admin'
    or auth.uid() = user_id
    or (
      rol = 'operador'
      and auth.uid() <> user_id
      and (
        (select public.es_analista_total())
        or (
          (select public.mi_rol()) in ('analista_sae', 'supervisor')
          and centros_asignados && (select public.mis_centros())
        )
      )
    )
  )
  with check (
    (select public.mi_rol()) = 'admin'
    or (
      rol = 'operador'
      and auth.uid() <> user_id
      and (
        (select public.es_analista_total())
        or (select public.mi_rol()) in ('analista_sae', 'supervisor')
      )
    )
    or (
      auth.uid() = user_id
      and rol = (select public.mi_rol())
      and centros_asignados = (select public.mis_centros())
      and not (hash_id is distinct from (select public.mi_hash_id()))
      and not (cedula_norm is distinct from ((select public.mi_identidad()) ->> 'cedula_norm'))
      and verificado_nexus = (((select public.mi_identidad()) ->> 'verificado_nexus'))::boolean
      and not (aprobacion is distinct from ((select public.mi_identidad()) ->> 'aprobacion'))
      and not (entradas_sin_telegram is distinct from (((select public.mi_identidad()) ->> 'entradas_sin_telegram'))::integer)
    )
  );

-- ---------------------------------------------------------------------------
-- 2) centros_de_usuario: mis_centros() de un usuario arbitrario (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.centros_de_usuario(p_user_id uuid)
returns text[]
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v record;
begin
  select rol, centros_asignados, ambito_analista, cuerpo_asignado
    into v
    from public.perfiles
   where user_id = p_user_id;
  if v is null then
    return '{}';
  end if;
  if v.rol in ('analista_sae', 'supervisor', 'operador')
     and v.ambito_analista = 'cuerpo'
     and v.cuerpo_asignado is not null then
    return coalesce((
      select array_agg(c.id)
      from public.centros c
      join public.unidades_sebin u
        on u.valor_db = (c.data->'supervision'->>'unidad_sebin')
      where u.cuerpo_clave = v.cuerpo_asignado
        and c.deleted is not true
    ), '{}');
  end if;
  return coalesce(v.centros_asignados, '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) puede_gestionar_operador: regla de alcance de §5.2 (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.puede_gestionar_operador(p_caller uuid, p_objetivo uuid)
returns boolean
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_caller record;
  v_objetivo record;
begin
  if p_caller is null or p_objetivo is null or p_caller = p_objetivo then
    return false;
  end if;
  select rol, ambito_analista into v_caller
    from public.perfiles where user_id = p_caller;
  select rol, centros_asignados into v_objetivo
    from public.perfiles where user_id = p_objetivo;
  if v_caller is null or v_objetivo is null then
    return false;
  end if;
  if v_objetivo.rol <> 'operador' then
    return v_caller.rol = 'admin';
  end if;
  if v_caller.rol = 'admin' then
    return true;
  end if;
  if v_caller.rol not in ('analista_sae', 'supervisor') then
    return false;
  end if;
  if v_caller.rol = 'analista_sae' and v_caller.ambito_analista = 'red' then
    return true;
  end if;
  return coalesce(v_objetivo.centros_asignados, '{}') && public.centros_de_usuario(p_caller);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (gotcha #1): funciones nuevas solo para service_role
-- ---------------------------------------------------------------------------
revoke all on function public.centros_de_usuario(uuid) from public, anon, authenticated;
grant execute on function public.centros_de_usuario(uuid) to service_role;

revoke all on function public.puede_gestionar_operador(uuid, uuid) from public, anon, authenticated;
grant execute on function public.puede_gestionar_operador(uuid, uuid) to service_role;
