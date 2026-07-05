-- Reparaciones por centro y flags diarios del reporte (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `reparaciones_centros`, 04-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción.
--
-- Tablas:
--   reparaciones_centros       — ítems de trabajo persistentes por campamento
--   reportes_reparaciones_dia  — preguntas diarias al operador (unique centro/día)
--
-- RLS: mismo patrón que reportes_centros / incidencias_centros (helpers mi_rol(),
-- mis_centros()). Ambas tablas en publicación Realtime.
--
-- Storage: bucket público `reparaciones-fotos` (5 MB, solo imágenes).

-- ============================================================================
-- reparaciones_centros — trabajos/reparaciones históricos por campamento
-- ============================================================================
create table public.reparaciones_centros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  estatus text not null default 'dañado'
    check (estatus in ('dañado', 'en_reparacion', 'reparado')),
  -- [{ url, tipo: 'antes'|'despues', ts }]
  fotos jsonb not null default '[]'::jsonb,
  creada_ts bigint,
  creada_por text,
  updated_at bigint,
  updated_by text,
  resuelta_ts bigint
);

create index reparaciones_centros_centro_idx on public.reparaciones_centros (centro_id);
create index reparaciones_centros_estatus_idx on public.reparaciones_centros (estatus);

alter table public.reparaciones_centros enable row level security;

create policy reparaciones_centros_select on public.reparaciones_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy reparaciones_centros_insert on public.reparaciones_centros
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy reparaciones_centros_update on public.reparaciones_centros
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

create policy reparaciones_centros_delete on public.reparaciones_centros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

alter publication supabase_realtime add table public.reparaciones_centros;

-- ============================================================================
-- reportes_reparaciones_dia — flags diarios del reporte de reparaciones
-- ============================================================================
create table public.reportes_reparaciones_dia (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  dia date not null,
  requiere_trabajos boolean not null default false,
  se_trabajo_hoy boolean not null default false,
  observaciones text not null default '',
  updated_at bigint,
  updated_by text,
  unique (centro_id, dia)
);

create index reportes_reparaciones_dia_dia_idx on public.reportes_reparaciones_dia (dia);
create index reportes_reparaciones_dia_centro_dia_idx
  on public.reportes_reparaciones_dia (centro_id, dia);

alter table public.reportes_reparaciones_dia enable row level security;

create policy reportes_reparaciones_dia_select on public.reportes_reparaciones_dia
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy reportes_reparaciones_dia_insert on public.reportes_reparaciones_dia
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy reportes_reparaciones_dia_update on public.reportes_reparaciones_dia
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

create policy reportes_reparaciones_dia_delete on public.reportes_reparaciones_dia
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

alter publication supabase_realtime add table public.reportes_reparaciones_dia;

-- ============================================================================
-- Storage: bucket reparaciones-fotos (público, imágenes, 5 MB)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reparaciones-fotos',
  'reparaciones-fotos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy reparaciones_fotos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'reparaciones-fotos');

create policy reparaciones_fotos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'reparaciones-fotos');

create policy reparaciones_fotos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'reparaciones-fotos')
  with check (bucket_id = 'reparaciones-fotos');

create policy reparaciones_fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'reparaciones-fotos');
