-- Censo rápido v5 — cédula única + menores asociados al jefe de familia.
--
-- ✅ APLICADA (migración `censo_rapido_cedula_unica_menores_v5`, 06-jul-2026,
-- vía MCP `apply_migration`). Este archivo queda como referencia versionada
-- del SQL en producción. Complementa a censo_rapido.sql, _v2, _v3 y _v4.
--
-- Cambios:
--   1) documento_norm: cédula/pasaporte normalizado (mayúsculas, solo
--      alfanumérico) + índice único parcial: impide registrar dos personas
--      con la misma cédula en toda la red. censo_registrar valida antes de
--      insertar y devuelve un error legible con el nombre y refugio del
--      registro existente.
--   2) Menores: jefe_tipo_doc / jefe_documento / parentesco_jefe. Si el jefe
--      ya está registrado (por su documento_norm) el menor queda enlazado en
--      jefe_registro_id; si el jefe se registra después, sus menores
--      pendientes se enlazan retroactivamente.
--   3) censo_listado recreada para incluir los datos del jefe.

alter table public.censo_registros
  add column documento_norm text,
  add column jefe_tipo_doc text check (jefe_tipo_doc is null or jefe_tipo_doc in ('V', 'E', 'P')),
  add column jefe_documento text not null default '',
  add column parentesco_jefe text not null default '',
  add column jefe_registro_id uuid references public.censo_registros(id) on delete set null;

update public.censo_registros
  set documento_norm = nullif(upper(regexp_replace(documento, '[^A-Za-z0-9]', '', 'g')), '');

create unique index censo_registros_documento_norm_uq
  on public.censo_registros (documento_norm)
  where documento_norm is not null;

create index censo_registros_jefe_idx on public.censo_registros (jefe_registro_id);

create or replace function public.censo_registrar(
  p_centro_id text,
  p_funcionario jsonb,
  p_registro jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_edad int;
  v_tipo_doc text;
  v_sexo text;
  v_condicion text;
  v_embarazada boolean;
  v_semanas int;
  v_documento text;
  v_norm text;
  v_jefe_tipo_doc text;
  v_jefe_documento text;
  v_jefe_norm text;
  v_jefe_id uuid;
  v_dup record;
begin
  if not exists (select 1 from public.centros c where c.id = p_centro_id and not c.deleted) then
    raise exception 'Refugio inválido';
  end if;

  if coalesce(trim(p_registro->>'primer_nombre'), '') = ''
     or coalesce(trim(p_registro->>'primer_apellido'), '') = '' then
    raise exception 'Primer nombre y primer apellido son obligatorios';
  end if;

  v_edad := nullif(trim(coalesce(p_registro->>'edad', '')), '')::int;
  v_tipo_doc := nullif(trim(coalesce(p_registro->>'tipo_doc', '')), '');
  v_sexo := nullif(trim(coalesce(p_registro->>'sexo', '')), '');
  v_condicion := coalesce(trim(p_registro->>'condicion_vivienda'), '');
  if v_condicion not in ('', 'destruida', 'inhabitable', 'no_posee') then
    v_condicion := '';
  end if;

  v_embarazada := (v_sexo = 'F' and coalesce((p_registro->>'embarazada')::boolean, false));
  v_semanas := case
    when v_embarazada then nullif(trim(coalesce(p_registro->>'embarazo_semanas', '')), '')::int
    else null
  end;
  if v_semanas is not null and (v_semanas < 1 or v_semanas > 45) then
    v_semanas := null;
  end if;

  -- Validador: cédula/pasaporte propio no puede repetirse en la red.
  v_documento := left(coalesce(trim(p_registro->>'documento'), ''), 40);
  v_norm := nullif(upper(regexp_replace(v_documento, '[^A-Za-z0-9]', '', 'g')), '');
  if v_norm is not null then
    select r.primer_nombre, r.primer_apellido, coalesce(c.data->>'nombre', r.centro_id) as refugio
      into v_dup
      from public.censo_registros r
      left join public.centros c on c.id = r.centro_id
      where r.documento_norm = v_norm
      limit 1;
    if found then
      raise exception 'Esta cédula ya fue registrada (% % en %)',
        v_dup.primer_nombre, v_dup.primer_apellido, v_dup.refugio;
    end if;
  end if;

  -- Menores: cédula del jefe de familia y parentesco; enlaza si el jefe existe.
  v_jefe_tipo_doc := nullif(trim(coalesce(p_registro->>'jefe_tipo_doc', '')), '');
  if v_jefe_tipo_doc not in ('V', 'E', 'P') then
    v_jefe_tipo_doc := null;
  end if;
  -- (corregido en migración censo_rapido_fix_jefe_documento_null)
  v_jefe_documento := left(coalesce(trim(p_registro->>'jefe_documento'), ''), 40);
  v_jefe_norm := nullif(upper(regexp_replace(v_jefe_documento, '[^A-Za-z0-9]', '', 'g')), '');
  if v_jefe_norm is not null then
    select r.id into v_jefe_id
      from public.censo_registros r
      where r.documento_norm = v_jefe_norm
      order by (r.centro_id = p_centro_id) desc, r.creado_en desc
      limit 1;
  end if;

  begin
    insert into public.censo_registros (
      centro_id,
      funcionario_jerarquia, funcionario_nombre, funcionario_institucion, funcionario_telefono,
      censador_en_refugio, censador_lat, censador_lng, censador_precision,
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      edad, tipo_doc, documento, documento_norm, sexo, telefono,
      embarazada, embarazo_semanas,
      discapacidad, discapacidad_detalle, enfermedad, enfermedad_detalle,
      jefe_tipo_doc, jefe_documento, parentesco_jefe, jefe_registro_id,
      pais, estado_federativo, municipio, parroquia,
      condicion_vivienda, calle, casa_edificio
    ) values (
      p_centro_id,
      left(coalesce(trim(p_funcionario->>'jerarquia'), ''), 120),
      left(coalesce(trim(p_funcionario->>'nombre'), ''), 160),
      left(coalesce(trim(p_funcionario->>'institucion'), ''), 160),
      left(coalesce(trim(p_funcionario->>'telefono'), ''), 40),
      coalesce((p_funcionario->>'en_refugio')::boolean, false),
      nullif(trim(coalesce(p_funcionario->>'lat', '')), '')::double precision,
      nullif(trim(coalesce(p_funcionario->>'lng', '')), '')::double precision,
      nullif(trim(coalesce(p_funcionario->>'precision', '')), '')::double precision,
      left(trim(p_registro->>'primer_nombre'), 80),
      left(coalesce(trim(p_registro->>'segundo_nombre'), ''), 80),
      left(trim(p_registro->>'primer_apellido'), 80),
      left(coalesce(trim(p_registro->>'segundo_apellido'), ''), 80),
      v_edad,
      v_tipo_doc,
      v_documento,
      v_norm,
      v_sexo,
      left(coalesce(trim(p_registro->>'telefono'), ''), 40),
      v_embarazada,
      v_semanas,
      coalesce((p_registro->>'discapacidad')::boolean, false),
      left(coalesce(trim(p_registro->>'discapacidad_detalle'), ''), 300),
      coalesce((p_registro->>'enfermedad')::boolean, false),
      left(coalesce(trim(p_registro->>'enfermedad_detalle'), ''), 300),
      v_jefe_tipo_doc,
      v_jefe_documento,
      left(coalesce(trim(p_registro->>'parentesco_jefe'), ''), 60),
      v_jefe_id,
      left(coalesce(nullif(trim(p_registro->>'pais'), ''), 'Venezuela'), 80),
      left(coalesce(trim(p_registro->>'estado_federativo'), ''), 80),
      left(coalesce(trim(p_registro->>'municipio'), ''), 120),
      left(coalesce(trim(p_registro->>'parroquia'), ''), 120),
      v_condicion,
      left(coalesce(trim(p_registro->>'calle'), ''), 300),
      left(coalesce(trim(p_registro->>'casa_edificio'), ''), 300)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Esta cédula ya fue registrada';
  end;

  -- Enlace retroactivo: menores que esperaban a este jefe de familia.
  if v_norm is not null then
    update public.censo_registros r
      set jefe_registro_id = v_id
      where r.jefe_registro_id is null
        and r.id <> v_id
        and nullif(upper(regexp_replace(r.jefe_documento, '[^A-Za-z0-9]', '', 'g')), '') = v_norm;
  end if;

  return v_id;
end;
$$;

revoke all on function public.censo_registrar(text, jsonb, jsonb) from public;
grant execute on function public.censo_registrar(text, jsonb, jsonb) to anon, authenticated;

-- Listado: incluye datos del jefe de familia
drop function if exists public.censo_listado(text);
create function public.censo_listado(p_centro_id text)
returns table (
  id uuid,
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
  condicion_vivienda text,
  estado_federativo text,
  municipio text,
  parroquia text,
  calle text,
  casa_edificio text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.creado_en,
    r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido,
    r.edad, r.tipo_doc, r.documento, r.sexo, r.telefono,
    r.embarazada, r.embarazo_semanas,
    r.discapacidad, r.discapacidad_detalle,
    r.enfermedad, r.enfermedad_detalle,
    r.jefe_tipo_doc, r.jefe_documento, r.parentesco_jefe, r.jefe_registro_id,
    r.condicion_vivienda, r.estado_federativo, r.municipio, r.parroquia,
    r.calle, r.casa_edificio
  from public.censo_registros r
  where r.centro_id = p_centro_id
  order by r.creado_en desc;
$$;

revoke all on function public.censo_listado(text) from public;
grant execute on function public.censo_listado(text) to anon, authenticated;
