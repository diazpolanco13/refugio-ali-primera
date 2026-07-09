-- Supervisor: ver y editar el censo de sus campamentos asignados.
-- La pestaña Censo de la ficha y las RPC de resumen/listado dejan de
-- restringirse solo a roles de red; el supervisor opera dentro de mis_centros().

-- ---- RLS: escritura en registros/cierres para supervisor asignado ----------

drop policy if exists censo_registros_update on public.censo_registros;
create policy censo_registros_update on public.censo_registros
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists censo_registros_delete on public.censo_registros;
create policy censo_registros_delete on public.censo_registros
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists censo_cierres_delete on public.censo_cierres;
create policy censo_cierres_delete on public.censo_cierres
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

-- ---- censo_reabrir: supervisor en centros asignados -----------------------

create or replace function public.censo_reabrir(p_centro_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrados int;
  v_rol text := (select public.mi_rol());
begin
  if v_rol in ('admin', 'analista_sae') then
    null;
  elsif v_rol = 'supervisor'
        and p_centro_id = any ((select public.mis_centros())::text[]) then
    null;
  else
    raise exception 'Acceso denegado';
  end if;

  if not exists (
    select 1 from public.centros c
    where c.id = p_centro_id and not c.deleted
  ) then
    raise exception 'Refugio inválido';
  end if;

  delete from public.censo_cierres
  where centro_id = p_centro_id;

  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

revoke all on function public.censo_reabrir(text) from public;
grant execute on function public.censo_reabrir(text) to authenticated;

-- ---- censo_resumen_red: supervisor solo ve sus centros --------------------

create or replace function public.censo_resumen_red()
returns table (
  centro_id text,
  centro_nombre text,
  total_registrados bigint,
  ultimo_registro_en timestamptz,
  cierre_en timestamptz,
  cierre_total int,
  cierre_funcionario text,
  hombres bigint,
  mujeres bigint,
  otros_sexo bigint,
  recien_nacidos_h bigint,
  recien_nacidos_m bigint,
  ninos bigint,
  ninas bigint,
  adolescentes_h bigint,
  adolescentes_m bigint,
  adultos_h bigint,
  adultos_m bigint,
  adultos_mayores_h bigint,
  adultos_mayores_m bigint,
  embarazadas bigint,
  discapacidad bigint,
  discapacidad_h bigint,
  discapacidad_m bigint,
  enfermedad bigint,
  vivienda_destruida bigint,
  vivienda_inhabitable bigint,
  vivienda_no_posee bigint,
  sin_condicion_vivienda bigint,
  parte_total int,
  parte_familias int,
  parte_dia date,
  sin_cedula bigint,
  importados_planilla bigint,
  sin_edad bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  return query
  select
    c.id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id),
    coalesce(agg.total_registrados, 0::bigint),
    agg.ultimo_registro_en,
    ci.creado_en,
    ci.total_registrados,
    ci.funcionario_nombre,
    coalesce(agg.hombres, 0::bigint),
    coalesce(agg.mujeres, 0::bigint),
    coalesce(agg.otros_sexo, 0::bigint),
    coalesce(agg.recien_nacidos_h, 0::bigint),
    coalesce(agg.recien_nacidos_m, 0::bigint),
    coalesce(agg.ninos, 0::bigint),
    coalesce(agg.ninas, 0::bigint),
    coalesce(agg.adolescentes_h, 0::bigint),
    coalesce(agg.adolescentes_m, 0::bigint),
    coalesce(agg.adultos_h, 0::bigint),
    coalesce(agg.adultos_m, 0::bigint),
    coalesce(agg.adultos_mayores_h, 0::bigint),
    coalesce(agg.adultos_mayores_m, 0::bigint),
    coalesce(agg.embarazadas, 0::bigint),
    coalesce(agg.discapacidad, 0::bigint),
    coalesce(agg.discapacidad_h, 0::bigint),
    coalesce(agg.discapacidad_m, 0::bigint),
    coalesce(agg.enfermedad, 0::bigint),
    coalesce(agg.vivienda_destruida, 0::bigint),
    coalesce(agg.vivienda_inhabitable, 0::bigint),
    coalesce(agg.vivienda_no_posee, 0::bigint),
    coalesce(agg.sin_condicion_vivienda, 0::bigint),
    parte.total_afectados,
    parte.familias,
    parte.dia,
    coalesce(agg.sin_cedula, 0::bigint),
    coalesce(agg.importados_planilla, 0::bigint),
    coalesce(agg.sin_edad, 0::bigint)
  from public.centros c
  left join lateral (
    select
      count(*)::bigint as total_registrados,
      max(r.creado_en) as ultimo_registro_en,
      count(*) filter (where r.sexo = 'M')::bigint as hombres,
      count(*) filter (where r.sexo = 'F')::bigint as mujeres,
      count(*) filter (where r.sexo is distinct from 'M' and r.sexo is distinct from 'F')::bigint as otros_sexo,
      count(*) filter (where r.edad is not null and r.edad <= 2 and r.sexo = 'M')::bigint as recien_nacidos_h,
      count(*) filter (where r.edad is not null and r.edad <= 2 and r.sexo = 'F')::bigint as recien_nacidos_m,
      count(*) filter (where r.edad between 3 and 11 and r.sexo = 'M')::bigint as ninos,
      count(*) filter (where r.edad between 3 and 11 and r.sexo = 'F')::bigint as ninas,
      count(*) filter (where r.edad between 12 and 17 and r.sexo = 'M')::bigint as adolescentes_h,
      count(*) filter (where r.edad between 12 and 17 and r.sexo = 'F')::bigint as adolescentes_m,
      count(*) filter (where r.edad between 18 and 59 and r.sexo = 'M')::bigint as adultos_h,
      count(*) filter (where r.edad between 18 and 59 and r.sexo = 'F')::bigint as adultos_m,
      count(*) filter (where r.edad >= 60 and r.sexo = 'M')::bigint as adultos_mayores_h,
      count(*) filter (where r.edad >= 60 and r.sexo = 'F')::bigint as adultos_mayores_m,
      count(*) filter (where r.embarazada)::bigint as embarazadas,
      count(*) filter (where r.discapacidad)::bigint as discapacidad,
      count(*) filter (where r.discapacidad and r.sexo = 'M')::bigint as discapacidad_h,
      count(*) filter (where r.discapacidad and r.sexo = 'F')::bigint as discapacidad_m,
      count(*) filter (where r.enfermedad)::bigint as enfermedad,
      count(*) filter (where r.condicion_vivienda = 'destruida')::bigint as vivienda_destruida,
      count(*) filter (where r.condicion_vivienda = 'inhabitable')::bigint as vivienda_inhabitable,
      count(*) filter (where r.condicion_vivienda = 'no_posee')::bigint as vivienda_no_posee,
      count(*) filter (where coalesce(r.condicion_vivienda, '') = '')::bigint as sin_condicion_vivienda,
      count(*) filter (where coalesce(r.documento_norm, '') = '')::bigint as sin_cedula,
      count(*) filter (where r.funcionario_nombre = 'Importación planilla')::bigint as importados_planilla,
      count(*) filter (where r.edad is null)::bigint as sin_edad
    from public.censo_registros r
    where r.centro_id = c.id
  ) agg on true
  left join lateral (
    select cc.creado_en, cc.total_registrados, cc.funcionario_nombre
    from public.censo_cierres cc
    where cc.centro_id = c.id
    order by cc.creado_en desc
    limit 1
  ) ci on true
  left join lateral (
    select o.total_afectados, o.familias, o.dia
    from public.ocupaciones_centros o
    where o.centro_id = c.id
    order by o.dia desc, o.updated_at desc
    limit 1
  ) parte on true
  where not c.deleted
    and (
      v_rol <> 'supervisor'
      or c.id = any (v_centros)
    )
  order by 2;
end;
$$;

revoke all on function public.censo_resumen_red() from public;
grant execute on function public.censo_resumen_red() to authenticated;

-- ---- censo_listado_red_conteo / paginado ----------------------------------

create or replace function public.censo_listado_red_conteo(
  p_centro_id text default null,
  p_sexo text default null,
  p_busqueda text default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busqueda text := nullif(trim(coalesce(p_busqueda, '')), '');
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  if v_rol = 'supervisor' then
    if p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' then
      -- Sin filtro: cuenta solo en centros asignados.
      null;
    elsif not (p_centro_id = any (v_centros)) then
      raise exception 'Acceso denegado';
    end if;
  end if;

  return (
    select count(*)::bigint
    from public.censo_registros r
    inner join public.centros c on c.id = r.centro_id and not c.deleted
    where
      (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
      and (v_rol <> 'supervisor' or r.centro_id = any (v_centros))
      and (p_sexo is null or p_sexo = '' or p_sexo = 'todos' or r.sexo = p_sexo)
      and (
        v_busqueda is null
        or concat_ws(
          ' ',
          r.primer_nombre,
          r.segundo_nombre,
          r.primer_apellido,
          r.segundo_apellido,
          r.tipo_doc,
          r.documento,
          r.telefono,
          coalesce(nullif(trim(c.data->>'nombre'), ''), c.id)
        ) ilike '%' || v_busqueda || '%'
      )
  );
end;
$$;

create or replace function public.censo_listado_red_paginado(
  p_limit int default 50,
  p_offset int default 0,
  p_centro_id text default null,
  p_sexo text default null,
  p_busqueda text default null,
  p_orden text default 'reciente'
)
returns table (
  id uuid,
  centro_id text,
  centro_nombre text,
  creado_en timestamptz,
  primer_nombre text,
  segundo_nombre text,
  primer_apellido text,
  segundo_apellido text,
  edad int,
  tipo_doc text,
  documento text,
  sexo text,
  telefono text,
  embarazada boolean,
  embarazo_semanas int,
  discapacidad boolean,
  discapacidad_detalle text,
  enfermedad boolean,
  enfermedad_detalle text,
  jefe_tipo_doc text,
  jefe_documento text,
  parentesco_jefe text,
  jefe_registro_id uuid,
  pais text,
  condicion_vivienda text,
  estado_federativo text,
  municipio text,
  parroquia text,
  calle text,
  casa_edificio text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busqueda text := nullif(trim(coalesce(p_busqueda, '')), '');
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 1000);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_orden text := coalesce(nullif(trim(p_orden), ''), 'reciente');
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  if v_rol = 'supervisor' then
    if p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' then
      null;
    elsif not (p_centro_id = any (v_centros)) then
      raise exception 'Acceso denegado';
    end if;
  end if;

  return query
  select
    r.id,
    r.centro_id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id),
    r.creado_en,
    r.primer_nombre,
    r.segundo_nombre,
    r.primer_apellido,
    r.segundo_apellido,
    r.edad,
    r.tipo_doc,
    r.documento,
    r.sexo,
    r.telefono,
    r.embarazada,
    r.embarazo_semanas,
    r.discapacidad,
    r.discapacidad_detalle,
    r.enfermedad,
    r.enfermedad_detalle,
    r.jefe_tipo_doc,
    r.jefe_documento,
    r.parentesco_jefe,
    r.jefe_registro_id,
    r.pais,
    r.condicion_vivienda,
    r.estado_federativo,
    r.municipio,
    r.parroquia,
    r.calle,
    r.casa_edificio
  from public.censo_registros r
  inner join public.centros c on c.id = r.centro_id and not c.deleted
  where
    (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
    and (v_rol <> 'supervisor' or r.centro_id = any (v_centros))
    and (p_sexo is null or p_sexo = '' or p_sexo = 'todos' or r.sexo = p_sexo)
    and (
      v_busqueda is null
      or concat_ws(
        ' ',
        r.primer_nombre,
        r.segundo_nombre,
        r.primer_apellido,
        r.segundo_apellido,
        r.tipo_doc,
        r.documento,
        r.telefono,
        coalesce(nullif(trim(c.data->>'nombre'), ''), c.id)
      ) ilike '%' || v_busqueda || '%'
    )
  order by
    case when v_orden = 'campamento' then lower(coalesce(nullif(trim(c.data->>'nombre'), ''), c.id)) end asc nulls last,
    case when v_orden = 'nombre' then lower(concat_ws(' ', r.primer_apellido, r.primer_nombre, r.segundo_apellido)) end asc nulls last,
    case when v_orden = 'edad' then r.edad end desc nulls last,
    r.creado_en desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.censo_listado_red_conteo(text, text, text) from public;
grant execute on function public.censo_listado_red_conteo(text, text, text) to authenticated;

revoke all on function public.censo_listado_red_paginado(int, int, text, text, text, text) from public;
grant execute on function public.censo_listado_red_paginado(int, int, text, text, text, text) to authenticated;

-- ---- censo_listado_red (legacy): mismo alcance ----------------------------

create or replace function public.censo_listado_red()
returns table (
  id uuid,
  centro_id text,
  centro_nombre text,
  creado_en timestamptz,
  primer_nombre text,
  segundo_nombre text,
  primer_apellido text,
  segundo_apellido text,
  edad int,
  tipo_doc text,
  documento text,
  sexo text,
  telefono text,
  embarazada boolean,
  embarazo_semanas int,
  discapacidad boolean,
  discapacidad_detalle text,
  enfermedad boolean,
  enfermedad_detalle text,
  jefe_tipo_doc text,
  jefe_documento text,
  parentesco_jefe text,
  jefe_registro_id uuid,
  pais text,
  condicion_vivienda text,
  estado_federativo text,
  municipio text,
  parroquia text,
  calle text,
  casa_edificio text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  return query
  select
    r.id,
    r.centro_id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id),
    r.creado_en,
    r.primer_nombre,
    r.segundo_nombre,
    r.primer_apellido,
    r.segundo_apellido,
    r.edad,
    r.tipo_doc,
    r.documento,
    r.sexo,
    r.telefono,
    r.embarazada,
    r.embarazo_semanas,
    r.discapacidad,
    r.discapacidad_detalle,
    r.enfermedad,
    r.enfermedad_detalle,
    r.jefe_tipo_doc,
    r.jefe_documento,
    r.parentesco_jefe,
    r.jefe_registro_id,
    r.pais,
    r.condicion_vivienda,
    r.estado_federativo,
    r.municipio,
    r.parroquia,
    r.calle,
    r.casa_edificio
  from public.censo_registros r
  inner join public.centros c on c.id = r.centro_id and not c.deleted
  where v_rol <> 'supervisor' or r.centro_id = any (v_centros)
  order by r.creado_en desc;
end;
$$;

revoke all on function public.censo_listado_red() from public;
grant execute on function public.censo_listado_red() to authenticated;
