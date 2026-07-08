-- Listado paginado del censo rápido (red) con filtros y conteo.
-- Evita cargar miles de filas en el cliente; la UI pide bloques de 50.

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
begin
  if (select public.mi_rol()) not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido') then
    raise exception 'Acceso denegado';
  end if;

  return (
    select count(*)::bigint
    from public.censo_registros r
    inner join public.centros c on c.id = r.centro_id and not c.deleted
    where
      (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
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
  where
    (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
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
