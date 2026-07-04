-- Tablas de reporte diario e incidencias por centro (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADAS (migraciones `reportes_centros` e `incidencias_centros`,
-- 04-jul-2026, vía MCP `apply_migration`). Este archivo queda como referencia
-- versionada del SQL que corre en producción, igual que `functions.sql`.
--
-- RLS: mismo patrón que `ocupaciones_centros` — usuarios `authenticated` leen
-- todo; los roles admin/coordinador/campo (según su fila en `perfiles`)
-- escriben; visor solo lee. Ambas tablas están en la publicación Realtime
-- `supabase_realtime`.

-- ============================================================================
-- reportes_centros — reporte diario por centro: comidas por jornada y
-- atenciones médicas. Una fila por centro por día (la última edición del día
-- gana), igual que `ocupaciones_centros`. El parte numérico NO vive aquí
-- (reutiliza `ocupaciones_centros` vía `guardarCentro()`).
-- ============================================================================
create table public.reportes_centros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  dia date not null,
  -- { desayuno: {raciones, hora_llegada, proveedor, observacion}, almuerzo: {...}, cena: {...} }
  comidas jsonb,
  atenciones_medicas int,
  observaciones text,
  updated_at bigint,
  updated_by text,
  unique (centro_id, dia)
);

create index reportes_centros_dia_idx on public.reportes_centros (dia);
create index reportes_centros_centro_dia_idx on public.reportes_centros (centro_id, dia);

alter table public.reportes_centros enable row level security;

create policy reportes_centros_select on public.reportes_centros
  for select to authenticated
  using (true);

create policy reportes_centros_insert on public.reportes_centros
  for insert to authenticated
  with check (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ));

create policy reportes_centros_update on public.reportes_centros
  for update to authenticated
  using (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ))
  with check (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ));

create policy reportes_centros_delete on public.reportes_centros
  for delete to authenticated
  using (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ));

alter publication supabase_realtime add table public.reportes_centros;

-- ============================================================================
-- incidencias_centros — registro append de incidencias con seguimiento
-- abierta/resuelta. Etiquetas de severidad: urgente (rojo), importante
-- (ámbar), cotidiana (gris). Categorías globales (catálogo en
-- `src/domain/incidencias.ts`): seguridad, salud, agua, alimentación,
-- infraestructura, servicios, convivencia, otro.
-- ============================================================================
create table public.incidencias_centros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  dia date not null,
  ts bigint,
  descripcion text,
  etiqueta text not null check (etiqueta in ('urgente', 'importante', 'cotidiana')),
  categorias text[] not null default '{}',
  estado text not null default 'abierta' check (estado in ('abierta', 'resuelta')),
  resuelta_ts bigint,
  resuelta_por text,
  updated_at bigint,
  updated_by text
);

create index incidencias_centros_dia_idx on public.incidencias_centros (dia);
create index incidencias_centros_centro_dia_idx on public.incidencias_centros (centro_id, dia);
create index incidencias_centros_estado_idx on public.incidencias_centros (estado);

alter table public.incidencias_centros enable row level security;

create policy incidencias_centros_select on public.incidencias_centros
  for select to authenticated
  using (true);

create policy incidencias_centros_insert on public.incidencias_centros
  for insert to authenticated
  with check (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ));

create policy incidencias_centros_update on public.incidencias_centros
  for update to authenticated
  using (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ))
  with check (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ));

create policy incidencias_centros_delete on public.incidencias_centros
  for delete to authenticated
  using (exists (
    select 1 from perfiles p
    where p.user_id = auth.uid()
      and p.rol in ('admin', 'coordinador', 'campo')
  ));

alter publication supabase_realtime add table public.incidencias_centros;
