-- Censo rápido v4 — semana de embarazo.
--
-- ✅ APLICADA (migración `censo_rapido_embarazo_semanas_v4`, 06-jul-2026, vía
-- MCP `apply_migration`). Este archivo queda como referencia versionada del
-- SQL en producción. Complementa a censo_rapido.sql, _v2.sql y _v3.sql.
--
-- Cambios:
--   censo_registros  + embarazo_semanas (1–45, solo si embarazada = true)
--   censo_registrar  guarda la semana únicamente cuando sexo = 'F' y
--                    embarazada = true; valores fuera de rango se descartan
--   censo_listado    recreada para incluir embarazo_semanas

alter table public.censo_registros
  add column embarazo_semanas int
    check (embarazo_semanas is null or (embarazo_semanas >= 1 and embarazo_semanas <= 45));

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

  insert into public.censo_registros (
    centro_id,
    funcionario_jerarquia, funcionario_nombre, funcionario_institucion, funcionario_telefono,
    censador_en_refugio, censador_lat, censador_lng, censador_precision,
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    edad, tipo_doc, documento, sexo, telefono,
    embarazada, embarazo_semanas,
    discapacidad, discapacidad_detalle, enfermedad, enfermedad_detalle,
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
    left(coalesce(trim(p_registro->>'documento'), ''), 40),
    v_sexo,
    left(coalesce(trim(p_registro->>'telefono'), ''), 40),
    v_embarazada,
    v_semanas,
    coalesce((p_registro->>'discapacidad')::boolean, false),
    left(coalesce(trim(p_registro->>'discapacidad_detalle'), ''), 300),
    coalesce((p_registro->>'enfermedad')::boolean, false),
    left(coalesce(trim(p_registro->>'enfermedad_detalle'), ''), 300),
    left(coalesce(nullif(trim(p_registro->>'pais'), ''), 'Venezuela'), 80),
    left(coalesce(trim(p_registro->>'estado_federativo'), ''), 80),
    left(coalesce(trim(p_registro->>'municipio'), ''), 120),
    left(coalesce(trim(p_registro->>'parroquia'), ''), 120),
    v_condicion,
    left(coalesce(trim(p_registro->>'calle'), ''), 300),
    left(coalesce(trim(p_registro->>'casa_edificio'), ''), 300)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.censo_registrar(text, jsonb, jsonb) from public;
grant execute on function public.censo_registrar(text, jsonb, jsonb) to anon, authenticated;

-- Listado: incluye la semana de embarazo
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
    r.condicion_vivienda, r.estado_federativo, r.municipio, r.parroquia,
    r.calle, r.casa_edificio
  from public.censo_registros r
  where r.centro_id = p_centro_id
  order by r.creado_en desc;
$$;

revoke all on function public.censo_listado(text) from public;
grant execute on function public.censo_listado(text) to anon, authenticated;
