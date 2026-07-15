-- =============================================================================
-- Ámbito del analista (15-jul-2026) — REFERENCIA de las migraciones aplicadas:
--   ambito_analista_columnas_helpers · ambito_analista_rls ·
--   ambito_analista_funciones · remapear_unidad_scoped_fix
--
-- Un analista (rol interno `analista_sae`) tiene uno de 3 ámbitos:
--   'red'      → toda la red, como siempre (default).
--   'cuerpo'   → SOLO los campamentos supervisados por unidades de un cuerpo
--                policial (`perfiles.cuerpo_asignado`), y gestiona únicamente
--                las unidades de ese cuerpo en el catálogo.
--   'centros'  → SOLO los campamentos de `perfiles.centros_asignados`
--                (como un supervisor); no gestiona catálogos.
--
-- Mecánica:
--   * `es_analista_total()` → analista con ámbito 'red'.
--   * `mis_centros()` redefinida: para el analista con ámbito devuelve sus
--     campamentos (join centros × unidades_sebin por cuerpo, o la lista
--     manual). El resto de roles: centros_asignados (igual que antes).
--   * ~80 policies transformadas mecánicamente (migración ambito_analista_rls):
--       "rol in (admin, analista)"            → admin OR es_analista_total()
--       "rol in (admin, analista, autoridad)" → (admin|autoridad) OR total
--       ramas scoped de supervisor/operador    → incluyen analista_sae
--     Sin cambios: historial_insert, refugiados_insert, perfiles_select_*,
--     storage logos-catalogo (analista con cualquier ámbito).
--   * unidades_sebin: policies explícitas — admin/analista-red todo; analista
--     con cuerpo asignado solo filas con `cuerpo_clave = mi_cuerpo_asignado()`.
--   * Funciones actualizadas con el mismo criterio: censo_listado_red(+_conteo,
--     _paginado), censo_resumen_red (filtro tipo supervisor para el analista
--     con ámbito), censo_marcar_procesado, censo_reabrir, denuncia_soft_delete
--     (solo admin/analista-red), puede_escribir_ambos_centros,
--     puede_leer_centro_traslado, remapear_cuerpo_en_centros (solo
--     admin/analista-red) y remapear_unidad_sebin_en_centros (el analista con
--     cuerpo puede remapear solo valores de unidades de su cuerpo).
--   * Edge Function `create-user` v3 valida `ambito_analista`/`cuerpo_asignado`.
--
-- ⚠️ Al recrear funciones, Postgres re-otorga EXECUTE a PUBLIC: repetir los
-- revoke/grant correspondientes (patrón del repo).
-- =============================================================================

-- 1. Columnas
alter table public.perfiles
  add column if not exists ambito_analista text not null default 'red'
    check (ambito_analista in ('red', 'cuerpo', 'centros')),
  add column if not exists cuerpo_asignado text
    references public.cuerpos_policiales (clave)
    on update cascade on delete set null;

-- 2. Helpers
create or replace function public.es_analista_total()
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.perfiles
    where user_id = auth.uid()
      and rol = 'analista_sae'
      and ambito_analista = 'red'
  );
$$;

revoke all on function public.es_analista_total() from public;
grant execute on function public.es_analista_total() to authenticated;

create or replace function public.mi_cuerpo_asignado()
returns text
language sql stable security definer
set search_path to ''
as $$
  select cuerpo_asignado from public.perfiles where user_id = auth.uid();
$$;

revoke all on function public.mi_cuerpo_asignado() from public;
grant execute on function public.mi_cuerpo_asignado() to authenticated;

create or replace function public.mis_centros()
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
   where user_id = auth.uid();
  if v is null then
    return '{}';
  end if;
  if v.rol = 'analista_sae' and v.ambito_analista = 'cuerpo' and v.cuerpo_asignado is not null then
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

-- 3. unidades_sebin: gestión por cuerpo
drop policy if exists unidades_sebin_insert on public.unidades_sebin;
create policy unidades_sebin_insert
  on public.unidades_sebin for insert to authenticated
  with check (
    (select public.mi_rol()) = 'admin'
    or (select public.es_analista_total())
    or ((select public.mi_rol()) = 'analista_sae'
        and cuerpo_clave is not null
        and cuerpo_clave = (select public.mi_cuerpo_asignado()))
  );

drop policy if exists unidades_sebin_update on public.unidades_sebin;
create policy unidades_sebin_update
  on public.unidades_sebin for update to authenticated
  using (
    (select public.mi_rol()) = 'admin'
    or (select public.es_analista_total())
    or ((select public.mi_rol()) = 'analista_sae'
        and cuerpo_clave is not null
        and cuerpo_clave = (select public.mi_cuerpo_asignado()))
  )
  with check (
    (select public.mi_rol()) = 'admin'
    or (select public.es_analista_total())
    or ((select public.mi_rol()) = 'analista_sae'
        and cuerpo_clave is not null
        and cuerpo_clave = (select public.mi_cuerpo_asignado()))
  );

drop policy if exists unidades_sebin_delete on public.unidades_sebin;
create policy unidades_sebin_delete
  on public.unidades_sebin for delete to authenticated
  using (
    clave <> 'sin_asignar'
    and (
      (select public.mi_rol()) = 'admin'
      or (select public.es_analista_total())
      or ((select public.mi_rol()) = 'analista_sae'
          and cuerpo_clave is not null
          and cuerpo_clave = (select public.mi_cuerpo_asignado()))
    )
  );

-- 4. La transformación mecánica de las demás policies y funciones vive en las
--    migraciones `ambito_analista_rls` y `ambito_analista_funciones`
--    (list_migrations); reproducen los reemplazos documentados arriba.
--    `remapear_unidad_sebin_en_centros` quedó así (remapear_unidad_scoped_fix):

create or replace function public.remapear_unidad_sebin_en_centros(
  p_valor_antiguo text,
  p_valor_nuevo text
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
  v_rol text := (select public.mi_rol());
begin
  if v_rol <> 'admin'
     and not (select public.es_analista_total())
     and not (
       v_rol = 'analista_sae'
       and exists (
         select 1 from public.unidades_sebin u
         where u.cuerpo_clave is not null
           and u.cuerpo_clave = (select public.mi_cuerpo_asignado())
           and (u.valor_db = trim(p_valor_antiguo)
             or u.valor_db = trim(coalesce(p_valor_nuevo, '')))
       )
     ) then
    raise exception 'Sin permiso para remapear unidades';
  end if;
  if coalesce(trim(p_valor_antiguo), '') = ''
     or trim(p_valor_antiguo) = coalesce(trim(p_valor_nuevo), '') then
    return 0;
  end if;

  update public.centros
  set
    data = jsonb_set(
      data,
      '{supervision,unidad_sebin}',
      to_jsonb(coalesce(trim(p_valor_nuevo), ''))
    ),
    updated_at = (extract(epoch from now()) * 1000)::bigint
  where data->'supervision'->>'unidad_sebin' = trim(p_valor_antiguo);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.remapear_unidad_sebin_en_centros(text, text) from public;
grant execute on function public.remapear_unidad_sebin_en_centros(text, text) to authenticated;
