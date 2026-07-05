-- Registro nominal de refugiados por campamento (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `refugiados_nominal`, 05-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción.
--
-- Tablas:
--   refugiados              — identidad global en la red (cédula única parcial)
--   familias_centro         — grupo familiar por campamento
--   alojamientos_refugiados — registro de plaza (ingreso/egreso/itinerante)
--   beneficios_otorgados    — dotaciones trazables a nivel de persona
--
-- RLS: patrón reparaciones_centros / incidencias_centros (mi_rol(), mis_centros()).
-- SELECT amplio en refugiados/beneficios para alertas anti-fraude en toda la red.
-- Realtime en las 4 tablas.

-- ============================================================================
-- refugiados — identidad global en la red
-- ============================================================================
create table public.refugiados (
  id uuid primary key default gen_random_uuid(),
  cedula text,
  tipo_doc text check (tipo_doc is null or tipo_doc in ('V', 'E')),
  cedula_norm text,
  nombres text not null default '',
  apellidos text not null default '',
  fecha_nacimiento date,
  sexo text check (sexo is null or sexo in ('M', 'F', 'O')),
  vulnerabilidades jsonb not null default '{}'::jsonb,
  updated_at bigint,
  updated_by text
);

create unique index refugiados_cedula_norm_uq
  on public.refugiados (cedula_norm)
  where cedula_norm is not null;

-- ============================================================================
-- familias_centro — grupo familiar por campamento
-- ============================================================================
create table public.familias_centro (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  nombre text not null default '',
  notas text not null default '',
  updated_at bigint,
  updated_by text
);

create index familias_centro_centro_idx on public.familias_centro (centro_id);

-- ============================================================================
-- alojamientos_refugiados — registro de plaza en un campamento
-- ============================================================================
create table public.alojamientos_refugiados (
  id uuid primary key default gen_random_uuid(),
  refugiado_id uuid not null references public.refugiados(id) on delete cascade,
  centro_id text not null references public.centros(id) on delete cascade,
  familia_id uuid references public.familias_centro(id) on delete set null,
  fecha_ingreso date not null,
  fecha_egreso date,
  estado text not null default 'activo'
    check (estado in ('activo', 'egresado')),
  itinerante boolean not null default false,
  es_jefe_familia boolean not null default false,
  creada_ts bigint,
  creada_por text,
  updated_at bigint,
  updated_by text
);

create index alojamientos_refugiados_centro_estado_idx
  on public.alojamientos_refugiados (centro_id, estado);
create index alojamientos_refugiados_refugiado_estado_idx
  on public.alojamientos_refugiados (refugiado_id, estado);
create index alojamientos_refugiados_familia_idx
  on public.alojamientos_refugiados (familia_id);

-- ============================================================================
-- beneficios_otorgados — dotaciones trazables a nivel de persona
-- ============================================================================
create table public.beneficios_otorgados (
  id uuid primary key default gen_random_uuid(),
  refugiado_id uuid not null references public.refugiados(id) on delete cascade,
  centro_id text not null references public.centros(id) on delete cascade,
  tipo text not null,
  cantidad int not null default 1 check (cantidad > 0),
  fecha date not null,
  observacion text not null default '',
  otorgado_por text,
  updated_at bigint,
  updated_by text
);

create index beneficios_otorgados_refugiado_idx
  on public.beneficios_otorgados (refugiado_id);
create index beneficios_otorgados_centro_idx
  on public.beneficios_otorgados (centro_id);
create index beneficios_otorgados_tipo_idx
  on public.beneficios_otorgados (refugiado_id, tipo);

-- ============================================================================
-- RLS — refugiados
-- ============================================================================
alter table public.refugiados enable row level security;

create policy refugiados_select on public.refugiados
  for select to authenticated
  using (true);

create policy refugiados_insert on public.refugiados
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'supervisor', 'operador')
  );

create policy refugiados_update on public.refugiados
  for update to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and exists (
        select 1 from public.alojamientos_refugiados a
        where a.refugiado_id = refugiados.id
          and a.centro_id = any ((select public.mis_centros())::text[])
      )
    )
  )
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and exists (
        select 1 from public.alojamientos_refugiados a
        where a.refugiado_id = refugiados.id
          and a.centro_id = any ((select public.mis_centros())::text[])
      )
    )
  );

create policy refugiados_delete on public.refugiados
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ============================================================================
-- RLS — familias_centro
-- ============================================================================
alter table public.familias_centro enable row level security;

create policy familias_centro_select on public.familias_centro
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy familias_centro_insert on public.familias_centro
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy familias_centro_update on public.familias_centro
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

create policy familias_centro_delete on public.familias_centro
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ============================================================================
-- RLS — alojamientos_refugiados
-- ============================================================================
alter table public.alojamientos_refugiados enable row level security;

create policy alojamientos_refugiados_select on public.alojamientos_refugiados
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

create policy alojamientos_refugiados_insert on public.alojamientos_refugiados
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy alojamientos_refugiados_update on public.alojamientos_refugiados
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

create policy alojamientos_refugiados_delete on public.alojamientos_refugiados
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ============================================================================
-- RLS — beneficios_otorgados
-- ============================================================================
alter table public.beneficios_otorgados enable row level security;

create policy beneficios_otorgados_select on public.beneficios_otorgados
  for select to authenticated
  using (true);

create policy beneficios_otorgados_insert on public.beneficios_otorgados
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy beneficios_otorgados_update on public.beneficios_otorgados
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

create policy beneficios_otorgados_delete on public.beneficios_otorgados
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table public.refugiados;
alter publication supabase_realtime add table public.familias_centro;
alter publication supabase_realtime add table public.alojamientos_refugiados;
alter publication supabase_realtime add table public.beneficios_otorgados;
