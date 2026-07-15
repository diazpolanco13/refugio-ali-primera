-- Catálogos operativos: cuerpos policiales + unidades de supervisión por cuerpo.
--
-- Extiende el patrón de `unidades_sebin`:
--   - Nueva tabla `cuerpos_policiales` (CRUD admin/analista_sae).
--   - `unidades_sebin.cuerpo_clave` + `logo_url`.
--   - Bucket `logos-catalogo` para escudos subidos.
--   - RPCs INVOKER para remapear labels en `centros.data` al renombrar.

-- ============================================================================
-- 1. cuerpos_policiales
-- ============================================================================

create table if not exists public.cuerpos_policiales (
  clave text primary key
    check (clave ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null check (length(trim(label)) > 0),
  color text not null default '#64748b'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icono text not null default '🛡️',
  logo_url text,
  orden int not null default 100,
  activo boolean not null default true,
  updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  updated_by text
);

create index if not exists cuerpos_policiales_orden_idx
  on public.cuerpos_policiales (activo desc, orden asc, label asc);

alter table public.cuerpos_policiales enable row level security;

grant select on public.cuerpos_policiales to authenticated;
grant insert, update, delete on public.cuerpos_policiales to authenticated;

drop policy if exists cuerpos_policiales_select on public.cuerpos_policiales;
create policy cuerpos_policiales_select
  on public.cuerpos_policiales for select to authenticated
  using (true);

drop policy if exists cuerpos_policiales_insert on public.cuerpos_policiales;
create policy cuerpos_policiales_insert
  on public.cuerpos_policiales for insert to authenticated
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));

drop policy if exists cuerpos_policiales_update on public.cuerpos_policiales;
create policy cuerpos_policiales_update
  on public.cuerpos_policiales for update to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'))
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));

drop policy if exists cuerpos_policiales_delete on public.cuerpos_policiales;
create policy cuerpos_policiales_delete
  on public.cuerpos_policiales for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    and clave <> 'sin_asignar'
  );

insert into public.cuerpos_policiales (clave, label, color, icono, logo_url, orden, activo, updated_by) values
  ('gnb', 'GNB', '#4d7c0f', '🪖', '/logos-cuerpos/gnb.webp', 10, true, 'seed'),
  ('sebin', 'SEBIN', '#1e3a8a', '🛡️', '/logos-cuerpos/sebin.webp', 20, true, 'seed'),
  ('dgcim', 'DGCIM', '#334155', '🎖️', '/logos-cuerpos/dgcim.webp', 30, true, 'seed'),
  ('cicpc', 'CICPC', '#7c3aed', '🔍', '/logos-cuerpos/cicpc.webp', 40, true, 'seed'),
  ('pnb', 'PNB', '#1d4ed8', '👮', '/logos-cuerpos/pnb.webp', 50, true, 'seed'),
  ('poli_baruta', 'Poli Baruta', '#0ea5e9', '🚓', '/logos-cuerpos/poli_baruta.webp', 60, true, 'seed'),
  ('poli_caracas', 'PoliCaracas', '#059669', '🚔', '/logos-cuerpos/poli_caracas.webp', 70, true, 'seed'),
  ('poli_chacao', 'PoliChacao', '#d97706', '🚨', '/logos-cuerpos/poli_chacao.webp', 80, true, 'seed'),
  ('poli_hatillo', 'Poli El Hatillo', '#db2777', '🛵', '/logos-cuerpos/poli_hatillo.webp', 90, true, 'seed'),
  ('poli_sucre', 'Poli Sucre', '#ea580c', '🚦', '/logos-cuerpos/poli_sucre.webp', 100, true, 'seed'),
  ('poli_miranda', 'Poli Miranda', '#65a30d', '🏍️', '/logos-cuerpos/poli_miranda.webp', 110, true, 'seed'),
  ('psuv', 'PSUV', '#dc2626', '🌹', '/logos-cuerpos/psuv.webp', 120, true, 'seed'),
  ('min_educacion', 'Min Educación', '#2563eb', '📚', '/logos-cuerpos/min_educacion.webp', 130, true, 'seed'),
  ('alcaldia_ccs', 'Alcaldía de Caracas', '#ca8a04', '🏛️', '/logos-cuerpos/alcaldia_ccs.webp', 140, true, 'seed'),
  ('milicia', 'Milicia', '#15803d', '⚔️', '/logos-cuerpos/milicia.webp', 150, true, 'seed'),
  ('gbp', 'Guardia del Pueblo', '#b91c1c', '🛡️', '/logos-cuerpos/gbp.webp', 160, true, 'seed'),
  ('armada', 'Armada Bolivariana', '#0369a1', '⚓', null, 170, true, 'seed'),
  ('ejercito', 'Ejército', '#166534', '🎖️', null, 180, true, 'seed'),
  ('sin_asignar', 'Sin asignar', '#64748b', '❔', null, 999, true, 'seed')
on conflict (clave) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cuerpos_policiales'
  ) then
    alter publication supabase_realtime add table public.cuerpos_policiales;
  end if;
end $$;

-- ============================================================================
-- 2. unidades_sebin: cuerpo_clave + logo_url
-- ============================================================================

alter table public.unidades_sebin
  add column if not exists cuerpo_clave text,
  add column if not exists logo_url text;

update public.unidades_sebin
set cuerpo_clave = 'sebin'
where cuerpo_clave is null
  and clave <> 'sin_asignar';

update public.unidades_sebin
set cuerpo_clave = null
where clave = 'sin_asignar';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'unidades_sebin_cuerpo_clave_fkey'
  ) then
    alter table public.unidades_sebin
      add constraint unidades_sebin_cuerpo_clave_fkey
      foreign key (cuerpo_clave) references public.cuerpos_policiales (clave)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists unidades_sebin_cuerpo_orden_idx
  on public.unidades_sebin (cuerpo_clave, activo desc, orden asc, label asc);

-- ============================================================================
-- 3. Storage: logos-catalogo
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos-catalogo',
  'logos-catalogo',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists logos_catalogo_select on storage.objects;
create policy logos_catalogo_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos-catalogo');

drop policy if exists logos_catalogo_insert on storage.objects;
create policy logos_catalogo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos-catalogo'
    and (select public.mi_rol()) in ('admin', 'analista_sae')
  );

drop policy if exists logos_catalogo_update on storage.objects;
create policy logos_catalogo_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos-catalogo'
    and (select public.mi_rol()) in ('admin', 'analista_sae')
  )
  with check (
    bucket_id = 'logos-catalogo'
    and (select public.mi_rol()) in ('admin', 'analista_sae')
  );

drop policy if exists logos_catalogo_delete on storage.objects;
create policy logos_catalogo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos-catalogo'
    and (select public.mi_rol()) in ('admin', 'analista_sae')
  );

-- ============================================================================
-- 4. Remapear labels en centros.data al renombrar
-- ============================================================================

create or replace function public.remapear_cuerpo_en_centros(
  p_label_antiguo text,
  p_label_nuevo text
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  if (select public.mi_rol()) not in ('admin', 'analista_sae') then
    raise exception 'Sin permiso para remapear cuerpos';
  end if;
  if coalesce(trim(p_label_antiguo), '') = ''
     or coalesce(trim(p_label_nuevo), '') = ''
     or trim(p_label_antiguo) = trim(p_label_nuevo) then
    return 0;
  end if;

  update public.centros
  set
    data = jsonb_set(data, '{cuerpo}', to_jsonb(trim(p_label_nuevo))),
    updated_at = (extract(epoch from now()) * 1000)::bigint
  where data->>'cuerpo' = trim(p_label_antiguo);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.remapear_cuerpo_en_centros(text, text) from public;
grant execute on function public.remapear_cuerpo_en_centros(text, text) to authenticated;

create or replace function public.remapear_unidad_sebin_en_centros(
  p_valor_antiguo text,
  p_valor_nuevo text
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  if (select public.mi_rol()) not in ('admin', 'analista_sae') then
    raise exception 'Sin permiso para remapear unidades';
  end if;
  if coalesce(trim(p_valor_antiguo), '') = ''
     or trim(p_valor_antiguo) = coalesce(trim(p_valor_nuevo), '') then
    return 0;
  end if;

  update public.centros
  set
    data = jsonb_set(
      data,
      '{supervision,unidad_sebin}',
      to_jsonb(coalesce(trim(p_valor_nuevo), ''))
    ),
    updated_at = (extract(epoch from now()) * 1000)::bigint
  where data->'supervision'->>'unidad_sebin' = trim(p_valor_antiguo);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.remapear_unidad_sebin_en_centros(text, text) from public;
grant execute on function public.remapear_unidad_sebin_en_centros(text, text) to authenticated;
