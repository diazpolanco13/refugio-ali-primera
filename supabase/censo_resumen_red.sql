-- Resumen agregado del censo rápido por escuela/refugio (vista interna autenticada).
--
-- ✅ APLICADA (migración `censo_resumen_red`, 06-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción.
--
-- RPC `censo_resumen_red()`: agrega censo_registros por centro activo, incluye
-- el último cierre declarado en censo_cierres y restringe la lectura a
-- admin, analista_sae y autoridad vía mi_rol().

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
  if (select public.mi_rol()) not in ('admin', 'analista_sae', 'autoridad') then
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

revoke all on function public.censo_resumen_red() from public;
grant execute on function public.censo_resumen_red() to authenticated;
