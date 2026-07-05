-- Áreas de infraestructura por campamento (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `areas_infraestructura_centros`, 05-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción.
--
-- Tabla tipada `areas_infraestructura_centros` + bucket `infraestructura-fotos`
-- + FK en `reparaciones_centros.area_infraestructura_id`.
--
-- RLS: mismo patrón que reparaciones_centros (helpers mi_rol(), mis_centros()).
-- Realtime: publicación supabase_realtime.

-- ============================================================================
-- areas_infraestructura_centros — catálogo de áreas físicas por campamento
-- ============================================================================
create table public.areas_infraestructura_centros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  nombre text not null,
  descripcion_inicial text not null default '',
  -- [{ url, ts }] — máx. 3, validado en frontend
  fotos_iniciales jsonb not null default '[]'::jsonb,
  estado text not null default 'requiere_mejora'
    check (estado in ('requiere_mejora', 'en_proceso', 'mejorado')),
  creada_ts bigint,
  creada_por text,
  updated_at bigint,
  updated_by text,
  mejorada_ts bigint
);

create index areas_infraestructura_centros_centro_idx
  on public.areas_infraestructura_centros (centro_id);
create index areas_infraestructura_centros_centro_estado_idx
  on public.areas_infraestructura_centros (centro_id, estado);

alter table public.areas_infraestructura_centros enable row level security;

create policy areas_infraestructura_centros_select on public.areas_infraestructura_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy areas_infraestructura_centros_insert on public.areas_infraestructura_centros
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy areas_infraestructura_centros_update on public.areas_infraestructura_centros
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

create policy areas_infraestructura_centros_delete on public.areas_infraestructura_centros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

alter publication supabase_realtime add table public.areas_infraestructura_centros;

-- ============================================================================
-- Extensión reparaciones_centros — vínculo opcional al área de infraestructura
-- ============================================================================
alter table public.reparaciones_centros
  add column if not exists area_infraestructura_id uuid
  references public.areas_infraestructura_centros(id) on delete set null;

create index if not exists reparaciones_centros_area_idx
  on public.reparaciones_centros (area_infraestructura_id);

-- ============================================================================
-- Storage: bucket infraestructura-fotos (público, imágenes, 5 MB)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'infraestructura-fotos',
  'infraestructura-fotos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy infraestructura_fotos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'infraestructura-fotos');

create policy infraestructura_fotos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'infraestructura-fotos');

create policy infraestructura_fotos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'infraestructura-fotos')
  with check (bucket_id = 'infraestructura-fotos');

create policy infraestructura_fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'infraestructura-fotos');
