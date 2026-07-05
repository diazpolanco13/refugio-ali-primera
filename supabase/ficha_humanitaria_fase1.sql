-- Ficha humanitaria completa — Fase 1
-- Proyecto: xzwifkckkakldnzkdeby
-- Columnas tipadas + jsonb, bucket refugiados-fotos, RPC generar_codigo_ficha

-- ============================================================================
-- refugiados — identificación ampliada, contacto, tallas
-- ============================================================================
alter table public.refugiados
  add column if not exists codigo_ficha text unique,
  add column if not exists foto_url text,
  add column if not exists consentimiento_foto boolean not null default false,
  add column if not exists consentimiento_foto_ts bigint,
  add column if not exists apodo text not null default '',
  add column if not exists nacionalidad text not null default 'Venezolana',
  add column if not exists estado_documento text not null default 'vigente'
    check (estado_documento in ('vigente', 'perdida', 'danada', 'en_tramite')),
  add column if not exists otros_documentos jsonb not null default '[]'::jsonb,
  add column if not exists contacto jsonb not null default '{}'::jsonb,
  add column if not exists tallas jsonb not null default '{}'::jsonb;

create index if not exists refugiados_codigo_ficha_idx on public.refugiados (codigo_ficha)
  where codigo_ficha is not null;

-- ============================================================================
-- familias_centro — foto grupal + familiares de referencia/separados
-- ============================================================================
alter table public.familias_centro
  add column if not exists foto_familiar_url text,
  add column if not exists consentimiento_foto_familiar boolean not null default false,
  add column if not exists familiares_referencia jsonb not null default '[]'::jsonb,
  add column if not exists familiares_separados jsonb not null default '[]'::jsonb;

-- ============================================================================
-- alojamientos_refugiados — estados ampliados + plaza
-- ============================================================================
alter table public.alojamientos_refugiados
  drop constraint if exists alojamientos_refugiados_estado_check;

alter table public.alojamientos_refugiados
  add constraint alojamientos_refugiados_estado_check
  check (estado in ('activo', 'observacion', 'transito', 'egresado'));

alter table public.alojamientos_refugiados
  add column if not exists tipo_alojamiento text not null default '',
  add column if not exists plaza_modulo text not null default '',
  add column if not exists motivo_egreso text not null default '';

-- ============================================================================
-- beneficios_otorgados — kit mínimo granular
-- ============================================================================
alter table public.beneficios_otorgados
  add column if not exists item_kit text,
  add column if not exists talla text not null default '';

create index if not exists beneficios_otorgados_item_kit_idx
  on public.beneficios_otorgados (refugiado_id, item_kit)
  where item_kit is not null;

-- ============================================================================
-- RPC generar_codigo_ficha — secuencia por campamento
-- Formato: TER-2026-{prefijo}-{secuencia 5 dígitos}
-- ============================================================================
create or replace function public.generar_codigo_ficha(p_centro_id text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefijo text;
  v_seq int;
  v_codigo text;
begin
  -- Prefijo: últimos dígitos del id del centro, 3 chars (ej. centro-03 → 003)
  v_prefijo := lpad(
    coalesce(nullif(regexp_replace(p_centro_id, '[^0-9]', '', 'g'), ''), '0'),
    3, '0'
  );

  select coalesce(max(
    (regexp_match(codigo_ficha, '-([0-9]+)$'))[1]::int
  ), 0) + 1
  into v_seq
  from public.refugiados r
  where r.codigo_ficha like 'TER-2026-' || v_prefijo || '-%';

  v_codigo := 'TER-2026-' || v_prefijo || '-' || lpad(v_seq::text, 5, '0');
  return v_codigo;
end;
$$;

revoke execute on function public.generar_codigo_ficha(text) from public, anon;
grant execute on function public.generar_codigo_ficha(text) to authenticated;

-- ============================================================================
-- Storage: bucket refugiados-fotos (privado, imágenes, 5 MB)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'refugiados-fotos',
  'refugiados-fotos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists refugiados_fotos_select on storage.objects;
drop policy if exists refugiados_fotos_insert on storage.objects;
drop policy if exists refugiados_fotos_update on storage.objects;
drop policy if exists refugiados_fotos_delete on storage.objects;

create policy refugiados_fotos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'refugiados-fotos');

create policy refugiados_fotos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'refugiados-fotos');

create policy refugiados_fotos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'refugiados-fotos')
  with check (bucket_id = 'refugiados-fotos');

create policy refugiados_fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'refugiados-fotos');
