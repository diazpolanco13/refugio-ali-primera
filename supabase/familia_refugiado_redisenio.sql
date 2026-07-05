-- Rediseño de Familiares del Refugiado: hogar conviviente + apoyos familiares.
-- Proyecto: xzwifkckkakldnzkdeby
--
-- APLICADA en Supabase vía MCP `apply_migration` (05-jul-2026).
-- Antes de crear el índice único de jefe de hogar se revisaron los SELECT de
-- diagnóstico de esta sección; ambos devolvieron 0 filas.
--
-- Objetivos:
--   1. Un solo jefe activo por familia.
--   2. Parentesco obligatorio para miembros activos que no son jefe.
--   3. Permitir pasaporte (`P`) como tipo de documento nominal.
--   4. Tabla separada para beneficios del hogar (`beneficios_familiares`), sin
--      mezclarla con `beneficios_otorgados` personales.

-- ============================================================================
-- Diagnóstico previo recomendado
-- ============================================================================

-- Familias con más de un jefe activo. Debe devolver 0 filas antes del índice.
select
  familia_id,
  count(*) as jefes_activos,
  array_agg(id order by fecha_ingreso) as alojamientos
from public.alojamientos_refugiados
where familia_id is not null
  and estado <> 'egresado'
  and es_jefe_familia
group by familia_id
having count(*) > 1;

-- Miembros activos sin parentesco y que no son jefe. Debe corregirse antes de
-- validar el CHECK.
select id, familia_id, refugiado_id, centro_id
from public.alojamientos_refugiados
where familia_id is not null
  and estado <> 'egresado'
  and not es_jefe_familia
  and btrim(coalesce(parentesco_jefe, '')) = '';

-- ============================================================================
-- Documento nominal
-- ============================================================================

alter table public.refugiados
  drop constraint if exists refugiados_tipo_doc_check;

alter table public.refugiados
  add constraint refugiados_tipo_doc_check
  check (tipo_doc is null or tipo_doc in ('V', 'E', 'P'));

-- ============================================================================
-- Integridad del hogar
-- ============================================================================

-- Si el diagnóstico de jefes duplicados está limpio, este índice impide dos
-- jefes activos en la misma familia. No usa SECURITY DEFINER ni funciones.
create unique index if not exists alojamientos_refugiados_un_jefe_activo_familia_uq
  on public.alojamientos_refugiados (familia_id)
  where familia_id is not null
    and estado <> 'egresado'
    and es_jefe_familia;

-- CHECK inicialmente NOT VALID para no romper datos históricos al aplicar. Tras
-- corregir filas existentes, ejecutar:
--   alter table public.alojamientos_refugiados
--     validate constraint alojamientos_refugiados_parentesco_no_jefe_chk;
alter table public.alojamientos_refugiados
  add constraint alojamientos_refugiados_parentesco_no_jefe_chk
  check (
    familia_id is null
    or estado = 'egresado'
    or es_jefe_familia
    or btrim(coalesce(parentesco_jefe, '')) <> ''
  ) not valid;

-- ============================================================================
-- beneficios_familiares — apoyos trazables a nivel de hogar
-- ============================================================================

create table if not exists public.beneficios_familiares (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias_centro(id) on delete cascade,
  centro_id text not null references public.centros(id) on delete cascade,
  tipo text not null check (
    tipo in (
      'cocina',
      'nevera',
      'televisor',
      'colchon_familiar',
      'articulos_vivienda',
      'compensacion',
      'otro'
    )
  ),
  cantidad int not null default 1 check (cantidad > 0),
  fecha date not null,
  observacion text not null default '',
  otorgado_por text,
  updated_at bigint,
  updated_by text
);

create index if not exists beneficios_familiares_familia_idx
  on public.beneficios_familiares (familia_id, fecha desc);
create index if not exists beneficios_familiares_centro_idx
  on public.beneficios_familiares (centro_id);
create index if not exists beneficios_familiares_tipo_idx
  on public.beneficios_familiares (familia_id, tipo);

grant select, insert, update, delete on table public.beneficios_familiares to authenticated;

alter table public.beneficios_familiares enable row level security;

drop policy if exists beneficios_familiares_select on public.beneficios_familiares;
create policy beneficios_familiares_select on public.beneficios_familiares
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

drop policy if exists beneficios_familiares_insert on public.beneficios_familiares;
create policy beneficios_familiares_insert on public.beneficios_familiares
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists beneficios_familiares_update on public.beneficios_familiares;
create policy beneficios_familiares_update on public.beneficios_familiares
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

drop policy if exists beneficios_familiares_delete on public.beneficios_familiares;
create policy beneficios_familiares_delete on public.beneficios_familiares
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'beneficios_familiares'
  ) then
    alter publication supabase_realtime add table public.beneficios_familiares;
  end if;
end;
$$;
