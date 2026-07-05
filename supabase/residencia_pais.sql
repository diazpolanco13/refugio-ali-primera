-- Migración: columna pais en residencias_afectadas (estadísticas de origen).
-- Aplicar en Supabase cuando corresponda.

alter table public.residencias_afectadas
  add column if not exists pais text not null default 'Venezuela';

-- Backfill: registros existentes con estado venezolano → Venezuela
update public.residencias_afectadas
set pais = 'Venezuela'
where pais = '' or pais is null;

create index if not exists residencias_afectadas_pais_idx
  on public.residencias_afectadas (pais);
create index if not exists residencias_afectadas_estado_idx
  on public.residencias_afectadas (estado_federativo);
create index if not exists residencias_afectadas_parroquia_idx
  on public.residencias_afectadas (parroquia);

-- RPC upsert_residencia_afectada — incluye pais
create or replace function public.upsert_residencia_afectada(
  p_familia_id uuid,
  p_centro_id text,
  p_pais text default 'Venezuela',
  p_estado_federativo text default '',
  p_municipio text default '',
  p_parroquia text default '',
  p_sector text default '',
  p_direccion text default '',
  p_referencia text default '',
  p_estatus_vivienda text default 'sin_verificar',
  p_lng double precision default null,
  p_lat double precision default null,
  p_fotos jsonb default '[]'::jsonb,
  p_observaciones text default '',
  p_tipo_tenencia text default '',
  p_perdio_todo boolean default false,
  p_perdidas_materiales jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_geom geography(Point, 4326) := null;
  v_user text;
begin
  select username into v_user from public.perfiles where user_id = auth.uid();
  if v_user is null then
    v_user := auth.uid()::text;
  end if;

  if p_lng is not null and p_lat is not null then
    v_geom := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  end if;

  insert into public.residencias_afectadas (
    familia_id, centro_id, pais, estado_federativo, municipio, parroquia, sector,
    direccion, referencia, estatus_vivienda, geom, fotos, observaciones,
    tipo_tenencia, perdio_todo, perdidas_materiales,
    updated_at, updated_by
  )
  values (
    p_familia_id, p_centro_id,
    coalesce(nullif(trim(p_pais), ''), 'Venezuela'),
    coalesce(p_estado_federativo, ''),
    coalesce(p_municipio, ''),
    coalesce(p_parroquia, ''),
    coalesce(p_sector, ''),
    coalesce(p_direccion, ''),
    coalesce(p_referencia, ''),
    coalesce(p_estatus_vivienda, 'sin_verificar'),
    v_geom,
    coalesce(p_fotos, '[]'::jsonb),
    coalesce(p_observaciones, ''),
    coalesce(p_tipo_tenencia, ''),
    coalesce(p_perdio_todo, false),
    coalesce(p_perdidas_materiales, '[]'::jsonb),
    v_now, v_user
  )
  on conflict (familia_id) do update set
    centro_id = excluded.centro_id,
    pais = excluded.pais,
    estado_federativo = excluded.estado_federativo,
    municipio = excluded.municipio,
    parroquia = excluded.parroquia,
    sector = excluded.sector,
    direccion = excluded.direccion,
    referencia = excluded.referencia,
    estatus_vivienda = excluded.estatus_vivienda,
    geom = coalesce(excluded.geom, residencias_afectadas.geom),
    fotos = excluded.fotos,
    observaciones = excluded.observaciones,
    tipo_tenencia = excluded.tipo_tenencia,
    perdio_todo = excluded.perdio_todo,
    perdidas_materiales = excluded.perdidas_materiales,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning id into v_id;

  return v_id;
end;
$$;

-- Re-grant con nueva firma (eliminar versiones anteriores)
drop function if exists public.upsert_residencia_afectada(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, jsonb, text
);

drop function if exists public.upsert_residencia_afectada(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, jsonb, text,
  text, boolean, jsonb
);

revoke execute on function public.upsert_residencia_afectada(
  uuid, text, text, text, text, text, text, text, text, text,
  double precision, double precision, jsonb, text,
  text, boolean, jsonb
) from public, anon;

grant execute on function public.upsert_residencia_afectada(
  uuid, text, text, text, text, text, text, text, text, text,
  double precision, double precision, jsonb, text,
  text, boolean, jsonb
) to authenticated;
