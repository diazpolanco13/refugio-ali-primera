-- Borrado suave de denuncias de damnificados + edición por sala (admin /
-- analista_sae). La papelera solo la ve el admin (SELECT de filas deleted).
-- Referencia de la migración `denuncias_soft_delete`.

alter table public.denuncias_centros
  add column if not exists deleted boolean not null default false,
  add column if not exists deleted_at bigint,
  add column if not exists deleted_by text;

create index if not exists denuncias_centros_deleted_idx
  on public.denuncias_centros (deleted)
  where deleted;

-- SELECT: roles de vigilancia; filas eliminadas solo para admin.
drop policy if exists denuncias_centros_select on public.denuncias_centros;
create policy denuncias_centros_select on public.denuncias_centros
  for select to authenticated using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
      or (
        (select public.mi_rol()) = 'supervisor'
        and centro_id = any ((select public.mis_centros())::text[])
      )
    )
    and (
      deleted is not true
      or (select public.mi_rol()) = 'admin'
    )
  );

-- UPDATE: admin/analista editan y soft-deletean toda la red; supervisor solo
-- resuelve en asignados y no puede marcar deleted.
drop policy if exists denuncias_centros_update on public.denuncias_centros;
create policy denuncias_centros_update on public.denuncias_centros
  for update to authenticated using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and deleted is not true
      and centro_id = any ((select public.mis_centros())::text[])
    )
  ) with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and deleted is not true
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

-- DELETE duro: solo admin (purga desde la papelera).
drop policy if exists denuncias_centros_delete on public.denuncias_centros;
create policy denuncias_centros_delete on public.denuncias_centros
  for delete to authenticated using (
    (select public.mi_rol()) = 'admin'
    and deleted is true
  );
