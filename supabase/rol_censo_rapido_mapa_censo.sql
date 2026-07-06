-- ✅ APLICADA (migración `rol_censo_rapido_mapa_censo`, 06-jul-2026, vía MCP
-- `apply_migration`). Complementa a `rol_censo_rapido.sql`.

-- ---- reportes_centros: sin censo_rapido -----------------------------------
drop policy if exists reportes_centros_select on public.reportes_centros;
create policy reportes_centros_select on public.reportes_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

-- ---- reportes_reparaciones_dia: sin censo_rapido ---------------------------
drop policy if exists reportes_reparaciones_dia_select on public.reportes_reparaciones_dia;
create policy reportes_reparaciones_dia_select on public.reportes_reparaciones_dia
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

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
          (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
          or centro_id = any ((select public.mis_centros())::text[])
        )
    $pol$;
  end if;
end $$;

-- ---- RPC censo_resumen_red: incluye censo_rapido ---------------------------
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
  sin_condicion_vivienda bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.mi_rol()) not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido') then
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
    coalesce(agg.sin_condicion_vivienda, 0::bigint)
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
      count(*) filter (where coalesce(r.condicion_vivienda, '') = '')::bigint as sin_condicion_vivienda
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
  where not c.deleted
  order by 2;
end;
$$;

-- ---- RPC censo_listado_red: incluye censo_rapido ----------------------------
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
begin
  if (select public.mi_rol()) not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido') then
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
  order by r.creado_en desc;
end;
$$;
