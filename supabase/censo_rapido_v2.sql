-- Censo rápido v2 — campos de la planilla física + listado público por refugio.
--
-- ✅ APLICADA (migración `censo_rapido_campos_v2`, 06-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción. Complementa a `censo_rapido.sql`.
--
-- Cambios:
--   censo_registros  + telefono, embarazada, discapacidad(+detalle),
--                      enfermedad(+detalle), condicion_vivienda, calle,
--                      casa_edificio
--   censo_registrar  reescrita para incluir los campos nuevos (embarazada
--                     solo aplica si sexo = 'F')
--   censo_listado    NUEVA RPC pública: registros de un refugio para la vista
--                     de estadística del operador en terreno (sin login)

alter table public.censo_registros
  add column telefono text not null default '',
  add column embarazada boolean not null default false,
  add column discapacidad boolean not null default false,
  add column discapacidad_detalle text not null default '',
  add column enfermedad boolean not null default false,
  add column enfermedad_detalle text not null default '',
  add column condicion_vivienda text not null default ''
    check (condicion_vivienda in ('', 'destruida', 'inhabitable', 'no_posee')),
  add column calle text not null default '',
  add column casa_edificio text not null default '';

-- ============================================================================
-- RPC: registrar (v2, incluye los campos nuevos)
-- ============================================================================
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

-- ============================================================================
-- RPC: listado de registrados de un refugio (para la vista de estadística
-- del operador en terreno, sin login)
-- ============================================================================
create or replace function public.censo_listado(p_centro_id text)
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
    r.embarazada, r.discapacidad, r.discapacidad_detalle,
    r.enfermedad, r.enfermedad_detalle,
    r.condicion_vivienda, r.estado_federativo, r.municipio, r.parroquia,
    r.calle, r.casa_edificio
  from public.censo_registros r
  where r.centro_id = p_centro_id
  order by r.creado_en desc;
$$;

revoke all on function public.censo_listado(text) from public;
grant execute on function public.censo_listado(text) to anon, authenticated;
