-- Listado general del censo rápido (toda la red) — vista interna autenticada.
--
-- RPC `censo_listado_red()`: devuelve todos los registros de censo_registros
-- con nombre del campamento; acceso restringido a admin, analista_sae y autoridad.

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
  if (select public.mi_rol()) not in ('admin', 'analista_sae', 'autoridad') then
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

revoke all on function public.censo_listado_red() from public;
grant execute on function public.censo_listado_red() to authenticated;
