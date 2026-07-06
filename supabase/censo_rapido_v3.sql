-- Censo rápido v3 — geolocalización opcional del censador (validador).
--
-- ✅ APLICADA (migración `censo_rapido_geolocalizacion_v3`, 06-jul-2026, vía
-- MCP `apply_migration`). Este archivo queda como referencia versionada del
-- SQL en producción. Complementa a `censo_rapido.sql` y `censo_rapido_v2.sql`.
--
-- La ubicación del censador sirve para validar que el levantamiento se hizo
-- en el refugio, pero NUNCA es obligatoria: si el navegador no da permisos de
-- geolocalización los campos quedan null/false y el registro procede igual.
--
-- Cambios:
--   censo_registros  + censador_en_refugio, censador_lat, censador_lng,
--                      censador_precision (precisión GPS en metros)
--   censo_registrar  reescrita para leer en_refugio/lat/lng/precision del
--                     payload del funcionario

alter table public.censo_registros
  add column censador_en_refugio boolean not null default false,
  add column censador_lat double precision,
  add column censador_lng double precision,
  add column censador_precision double precision;

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

  insert into public.censo_registros (
    centro_id,
    funcionario_jerarquia, funcionario_nombre, funcionario_institucion, funcionario_telefono,
    censador_en_refugio, censador_lat, censador_lng, censador_precision,
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    edad, tipo_doc, documento, sexo, telefono,
    embarazada, discapacidad, discapacidad_detalle, enfermedad, enfermedad_detalle,
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
    (v_sexo = 'F' and coalesce((p_registro->>'embarazada')::boolean, false)),
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
