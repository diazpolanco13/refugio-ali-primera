-- Ampliación ficha nominal de refugiado + residencia afectada por familia.
-- Proyecto: xzwifkckkakldnzkdeby
--
-- Aplicar con MCP apply_migration o Supabase CLI.
-- Tablas tocadas: refugiados, alojamientos_refugiados, residencias_afectadas (nueva)
-- Storage: bucket privado residencias-fotos

-- ============================================================================
-- refugiados — nombres desglosados + lugar de nacimiento
-- ============================================================================
alter table public.refugiados
  add column if not exists primer_nombre text not null default '',
  add column if not exists segundo_nombre text not null default '',
  add column if not exists primer_apellido text not null default '',
  add column if not exists segundo_apellido text not null default '',
  add column if not exists lugar_nacimiento text not null default '';

-- Migrar datos existentes desde nombres/apellidos agregados
update public.refugiados
set
  primer_nombre = coalesce(nullif(trim(nombres), ''), ''),
  primer_apellido = coalesce(nullif(trim(apellidos), ''), '')
where primer_nombre = '' and primer_apellido = '';

-- ============================================================================
-- alojamientos_refugiados — parentesco con jefe de familia
-- ============================================================================
alter table public.alojamientos_refugiados
  add column if not exists parentesco_jefe text not null default '';

-- ============================================================================
-- residencias_afectadas — una fila por familia
-- ============================================================================
create table if not exists public.residencias_afectadas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null unique references public.familias_centro(id) on delete cascade,
  centro_id text not null references public.centros(id) on delete cascade,
  pais text not null default 'Venezuela',
  estado_federativo text not null default '',
  municipio text not null default '',
  parroquia text not null default '',
  sector text not null default '',
  direccion text not null default '',
  referencia text not null default '',
  estatus_vivienda text not null default 'sin_verificar'
    check (estatus_vivienda in (
      'destruida',
      'inabitable',
      'parcial_habitable',
      'habitable_con_riesgo',
      'sin_verificar'
    )),
  geom geography(Point, 4326),
  fotos jsonb not null default '[]'::jsonb,
  observaciones text not null default '',
  updated_at bigint,
  updated_by text
);

create index if not exists residencias_afectadas_centro_idx
  on public.residencias_afectadas (centro_id);
create index if not exists residencias_afectadas_familia_idx
  on public.residencias_afectadas (familia_id);

-- ============================================================================
-- RPC upsert_residencia_afectada
-- ============================================================================
create or replace function public.upsert_residencia_afectada(
  p_familia_id uuid,
  p_centro_id text,
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
  p_observaciones text default ''
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
    familia_id, centro_id, estado_federativo, municipio, parroquia, sector,
    direccion, referencia, estatus_vivienda, geom, fotos, observaciones,
    updated_at, updated_by
  )
  values (
    p_familia_id, p_centro_id,
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
    v_now, v_user
  )
  on conflict (familia_id) do update set
    centro_id = excluded.centro_id,
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
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.upsert_residencia_afectada(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, jsonb, text
) from public, anon;
grant execute on function public.upsert_residencia_afectada(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, jsonb, text
) to authenticated;

-- ============================================================================
-- RLS — residencias_afectadas
-- ============================================================================
alter table public.residencias_afectadas enable row level security;

create policy residencias_afectadas_select on public.residencias_afectadas
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy residencias_afectadas_insert on public.residencias_afectadas
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy residencias_afectadas_update on public.residencias_afectadas
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy residencias_afectadas_delete on public.residencias_afectadas
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

alter publication supabase_realtime add table public.residencias_afectadas;

-- ============================================================================
-- Storage: bucket residencias-fotos (privado, imágenes, 5 MB)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'residencias-fotos',
  'residencias-fotos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

create policy residencias_fotos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'residencias-fotos');

create policy residencias_fotos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'residencias-fotos');

create policy residencias_fotos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'residencias-fotos')
  with check (bucket_id = 'residencias-fotos');

create policy residencias_fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'residencias-fotos');
