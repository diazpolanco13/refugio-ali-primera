-- Censo rápido v9 — mensaje de cédula duplicada con fecha y hora del registro previo.
--
-- El error incluye cuándo se registró la persona y en qué refugio (hora Venezuela).

create or replace function public.censo_error_cedula_duplicada(
  p_documento_norm text,
  p_excluir_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dup record;
begin
  if p_documento_norm is null then
    return;
  end if;

  select
    r.primer_nombre,
    r.primer_apellido,
    coalesce(c.data->>'nombre', r.centro_id) as refugio,
    r.creado_en
  into v_dup
  from public.censo_registros r
  left join public.centros c on c.id = r.centro_id
  where r.documento_norm = p_documento_norm
    and (p_excluir_id is null or r.id <> p_excluir_id)
  order by r.creado_en desc
  limit 1;

  if found then
    raise exception 'Esta cédula ya fue registrada (% % en %, el %)',
      v_dup.primer_nombre,
      v_dup.primer_apellido,
      v_dup.refugio,
      to_char(v_dup.creado_en at time zone 'America/Caracas', 'DD/MM/YYYY HH24:MI');
  end if;
end;
$$;

-- censo_registrar: usa el helper en la validación previa y en carrera (unique_violation).
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

  v_documento := left(coalesce(trim(p_registro->>'documento'), ''), 40);
  v_norm := nullif(upper(regexp_replace(v_documento, '[^A-Za-z0-9]', '', 'g')), '');
  if v_norm is not null then
    perform public.censo_error_cedula_duplicada(v_norm);
  end if;

  v_jefe_tipo_doc := nullif(trim(coalesce(p_registro->>'jefe_tipo_doc', '')), '');
  if v_jefe_tipo_doc not in ('V', 'E', 'P') then
    v_jefe_tipo_doc := null;
  end if;
  v_jefe_documento := left(coalesce(trim(p_registro->>'jefe_documento'), ''), 40);
  v_jefe_norm := censo_normalizar_jefe_doc(v_jefe_documento);
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
    perform public.censo_error_cedula_duplicada(v_norm);
    raise exception 'Esta cédula ya fue registrada';
  end;

  if v_norm is not null then
    update public.censo_registros r
      set jefe_registro_id = v_id
      where r.jefe_registro_id is null
        and r.id <> v_id
        and censo_normalizar_jefe_doc(r.jefe_documento) = v_norm;
  end if;

  return v_id;
end;
$$;

-- censo_actualizar: misma validación con exclusión del registro en edición.
create or replace function public.censo_actualizar(
  p_id uuid,
  p_registro jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_centro_id text;
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
begin
  select r.centro_id into v_centro_id from public.censo_registros r where r.id = p_id;
  if not found then
    raise exception 'Registro no encontrado';
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

  v_documento := left(coalesce(trim(p_registro->>'documento'), ''), 40);
  v_norm := nullif(upper(regexp_replace(v_documento, '[^A-Za-z0-9]', '', 'g')), '');
  if v_norm is not null then
    perform public.censo_error_cedula_duplicada(v_norm, p_id);
  end if;

  v_jefe_tipo_doc := nullif(trim(coalesce(p_registro->>'jefe_tipo_doc', '')), '');
  if v_jefe_tipo_doc not in ('V', 'E', 'P') then
    v_jefe_tipo_doc := null;
  end if;
  v_jefe_documento := left(coalesce(trim(p_registro->>'jefe_documento'), ''), 40);
  v_jefe_norm := censo_normalizar_jefe_doc(v_jefe_documento);
  v_jefe_id := null;
  if v_jefe_norm is not null then
    select r.id into v_jefe_id
      from public.censo_registros r
      where r.documento_norm = v_jefe_norm and r.id <> p_id
      order by (r.centro_id = v_centro_id) desc, r.creado_en desc
      limit 1;
  end if;

  begin
    update public.censo_registros set
      primer_nombre = left(trim(p_registro->>'primer_nombre'), 80),
      segundo_nombre = left(coalesce(trim(p_registro->>'segundo_nombre'), ''), 80),
      primer_apellido = left(trim(p_registro->>'primer_apellido'), 80),
      segundo_apellido = left(coalesce(trim(p_registro->>'segundo_apellido'), ''), 80),
      edad = v_edad,
      tipo_doc = v_tipo_doc,
      documento = v_documento,
      documento_norm = v_norm,
      sexo = v_sexo,
      telefono = left(coalesce(trim(p_registro->>'telefono'), ''), 40),
      embarazada = v_embarazada,
      embarazo_semanas = v_semanas,
      discapacidad = coalesce((p_registro->>'discapacidad')::boolean, false),
      discapacidad_detalle = left(coalesce(trim(p_registro->>'discapacidad_detalle'), ''), 300),
      enfermedad = coalesce((p_registro->>'enfermedad')::boolean, false),
      enfermedad_detalle = left(coalesce(trim(p_registro->>'enfermedad_detalle'), ''), 300),
      jefe_tipo_doc = v_jefe_tipo_doc,
      jefe_documento = v_jefe_documento,
      parentesco_jefe = left(coalesce(trim(p_registro->>'parentesco_jefe'), ''), 60),
      jefe_registro_id = v_jefe_id,
      pais = left(coalesce(nullif(trim(p_registro->>'pais'), ''), 'Venezuela'), 80),
      estado_federativo = left(coalesce(trim(p_registro->>'estado_federativo'), ''), 80),
      municipio = left(coalesce(trim(p_registro->>'municipio'), ''), 120),
      parroquia = left(coalesce(trim(p_registro->>'parroquia'), ''), 120),
      condicion_vivienda = v_condicion,
      calle = left(coalesce(trim(p_registro->>'calle'), ''), 300),
      casa_edificio = left(coalesce(trim(p_registro->>'casa_edificio'), ''), 300)
    where id = p_id;
  exception when unique_violation then
    perform public.censo_error_cedula_duplicada(v_norm, p_id);
    raise exception 'Esta cédula ya fue registrada';
  end;

  if v_norm is not null then
    update public.censo_registros r
      set jefe_registro_id = p_id
      where r.jefe_registro_id is null
        and r.id <> p_id
        and censo_normalizar_jefe_doc(r.jefe_documento) = v_norm;
  end if;

  return p_id;
end;
$$;

revoke all on function public.censo_error_cedula_duplicada(text, uuid) from public;
revoke all on function public.censo_registrar(text, jsonb, jsonb) from public;
revoke all on function public.censo_actualizar(uuid, jsonb) from public;
grant execute on function public.censo_registrar(text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.censo_actualizar(uuid, jsonb) to anon, authenticated;
