-- ✅ APLICADA (migración `reporte_diario_telegram`, 07-jul-2026, vía MCP `apply_migration`).

-- ============================================================================
-- reportes_centros — flags de revisión de bloques Trabajos / Requerimientos
-- ============================================================================
alter table public.reportes_centros
  add column if not exists trabajos_revisados boolean not null default false;

alter table public.reportes_centros
  add column if not exists requerimientos_revisados boolean not null default false;

-- ============================================================================
-- ocupaciones_centros — contador manual de incidencias de salud del día
-- ============================================================================
alter table public.ocupaciones_centros
  add column if not exists incidencias_salud integer not null default 0;

-- ============================================================================
-- reportes_control_dia — captahuella, juez de paz, servicio médico, ambulancia
-- ============================================================================
create table if not exists public.reportes_control_dia (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  dia date not null,
  captahuella boolean,
  captahuella_nota text not null default '',
  juez_paz boolean,
  juez_paz_nota text not null default '',
  servicio_medico boolean,
  servicio_medico_nota text not null default '',
  ambulancia boolean,
  ambulancia_nota text not null default '',
  revisado boolean not null default false,
  updated_at bigint,
  updated_by text,
  unique (centro_id, dia)
);

create index if not exists reportes_control_dia_dia_idx
  on public.reportes_control_dia (dia);
create index if not exists reportes_control_dia_centro_dia_idx
  on public.reportes_control_dia (centro_id, dia);

grant select, insert, update, delete on public.reportes_control_dia to authenticated;

alter table public.reportes_control_dia enable row level security;

drop policy if exists reportes_control_dia_select on public.reportes_control_dia;
create policy reportes_control_dia_select on public.reportes_control_dia
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

drop policy if exists reportes_control_dia_insert on public.reportes_control_dia;
create policy reportes_control_dia_insert on public.reportes_control_dia
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists reportes_control_dia_update on public.reportes_control_dia;
create policy reportes_control_dia_update on public.reportes_control_dia
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

drop policy if exists reportes_control_dia_delete on public.reportes_control_dia;
create policy reportes_control_dia_delete on public.reportes_control_dia
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
  alter publication supabase_realtime add table public.reportes_control_dia;
exception
  when duplicate_object then null;
end $$;

-- ============================================================================
-- reparaciones_centros → trabajos (evolución in-place)
-- ============================================================================
alter table public.reparaciones_centros
  add column if not exists finalidad text not null default '';

alter table public.reparaciones_centros
  add column if not exists reportada_dia date;

alter table public.reparaciones_centros
  add column if not exists archivada_ts bigint;

alter table public.reparaciones_centros
  add column if not exists area_infraestructura_id uuid;

update public.reparaciones_centros
set reportada_dia = to_timestamp(creada_ts / 1000.0)::date
where reportada_dia is null and creada_ts is not null;

update public.reparaciones_centros
set reportada_dia = current_date
where reportada_dia is null;

update public.reparaciones_centros set estatus = 'pendiente' where estatus = 'dañado';
update public.reparaciones_centros set estatus = 'en_progreso' where estatus = 'en_reparacion';
update public.reparaciones_centros set estatus = 'completado' where estatus = 'reparado';

alter table public.reparaciones_centros drop constraint if exists reparaciones_centros_estatus_check;
alter table public.reparaciones_centros add constraint reparaciones_centros_estatus_check
  check (estatus in ('pendiente', 'en_progreso', 'completado', 'archivado'));

-- ============================================================================
-- requerimientos_seguimiento — dotación/faltantes con seguimiento vivo
-- ============================================================================
create table if not exists public.requerimientos_seguimiento (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  concepto text not null,
  cantidad integer not null default 0,
  categoria text not null default 'otro'
    check (categoria in ('dormitorio', 'electrodomesticos', 'cocina', 'seguridad_salud', 'saneamiento', 'otro')),
  notas text not null default '',
  estatus text not null default 'solicitado'
    check (estatus in ('solicitado', 'en_gestion', 'parcial', 'entregado', 'archivado')),
  reportado_dia date not null default current_date,
  archivada_ts bigint,
  creada_ts bigint,
  resuelta_ts bigint,
  updated_at bigint,
  updated_by text
);

create index if not exists requerimientos_seguimiento_centro_idx
  on public.requerimientos_seguimiento (centro_id);
create index if not exists requerimientos_seguimiento_estatus_idx
  on public.requerimientos_seguimiento (estatus);

grant select, insert, update, delete on public.requerimientos_seguimiento to authenticated;

alter table public.requerimientos_seguimiento enable row level security;

drop policy if exists requerimientos_seguimiento_select on public.requerimientos_seguimiento;
create policy requerimientos_seguimiento_select on public.requerimientos_seguimiento
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

drop policy if exists requerimientos_seguimiento_insert on public.requerimientos_seguimiento;
create policy requerimientos_seguimiento_insert on public.requerimientos_seguimiento
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists requerimientos_seguimiento_update on public.requerimientos_seguimiento;
create policy requerimientos_seguimiento_update on public.requerimientos_seguimiento
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

drop policy if exists requerimientos_seguimiento_delete on public.requerimientos_seguimiento;
create policy requerimientos_seguimiento_delete on public.requerimientos_seguimiento
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

do $$
begin
  alter publication supabase_realtime add table public.requerimientos_seguimiento;
exception
  when duplicate_object then null;
end $$;

-- ============================================================================
-- casos_salud_centros — casos opcionales vinculados al parte
-- ============================================================================
create table if not exists public.casos_salud_centros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  descripcion text not null,
  estatus text not null default 'activo'
    check (estatus in ('activo', 'en_proceso', 'resuelto', 'archivado')),
  reportado_dia date not null default current_date,
  resuelta_ts bigint,
  archivada_ts bigint,
  creada_ts bigint,
  updated_at bigint,
  updated_by text
);

create index if not exists casos_salud_centros_centro_idx
  on public.casos_salud_centros (centro_id);
create index if not exists casos_salud_centros_estatus_idx
  on public.casos_salud_centros (estatus);

grant select, insert, update, delete on public.casos_salud_centros to authenticated;

alter table public.casos_salud_centros enable row level security;

drop policy if exists casos_salud_centros_select on public.casos_salud_centros;
create policy casos_salud_centros_select on public.casos_salud_centros
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

drop policy if exists casos_salud_centros_insert on public.casos_salud_centros;
create policy casos_salud_centros_insert on public.casos_salud_centros
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists casos_salud_centros_update on public.casos_salud_centros;
create policy casos_salud_centros_update on public.casos_salud_centros
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

drop policy if exists casos_salud_centros_delete on public.casos_salud_centros;
create policy casos_salud_centros_delete on public.casos_salud_centros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

do $$
begin
  alter publication supabase_realtime add table public.casos_salud_centros;
exception
  when duplicate_object then null;
end $$;
