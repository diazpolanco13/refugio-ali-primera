-- Catálogo editable de unidades internas SEBIN.
--
-- ✅ APLICADA (migración `unidades_sebin_catalogo`, 09-jul-2026).
-- Antes: el listado vivía hardcodeado en `src/domain/unidadesSebin.ts`.
-- Lectura: cualquier autenticado. Escritura: admin / analista_sae.
-- `sin_asignar` no se puede borrar (policy delete).

create table if not exists public.unidades_sebin (
  clave text primary key
    check (clave ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null check (length(trim(label)) > 0),
  valor_db text not null default '',
  color text not null default '#64748b'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden int not null default 100,
  activo boolean not null default true,
  updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  updated_by text
);

create index if not exists unidades_sebin_orden_idx
  on public.unidades_sebin (activo desc, orden asc, label asc);

alter table public.unidades_sebin enable row level security;

grant select on public.unidades_sebin to authenticated;
grant insert, update, delete on public.unidades_sebin to authenticated;

drop policy if exists unidades_sebin_select on public.unidades_sebin;
create policy unidades_sebin_select
  on public.unidades_sebin for select to authenticated
  using (true);

drop policy if exists unidades_sebin_insert on public.unidades_sebin;
create policy unidades_sebin_insert
  on public.unidades_sebin for insert to authenticated
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));

drop policy if exists unidades_sebin_update on public.unidades_sebin;
create policy unidades_sebin_update
  on public.unidades_sebin for update to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'))
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));

drop policy if exists unidades_sebin_delete on public.unidades_sebin;
create policy unidades_sebin_delete
  on public.unidades_sebin for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    and clave <> 'sin_asignar'
  );

insert into public.unidades_sebin (clave, label, valor_db, color, orden, activo, updated_by) values
  ('dir_reg', 'DIR. REG', 'DIR. REG - SEBIN', '#2563eb', 10, true, 'seed'),
  ('dir_educacion', 'DIR. EDUCACIÓN', 'DIR. EDUCACION - SEBIN', '#0891b2', 20, true, 'seed'),
  ('dai', 'DAI', 'DAI - SEBIN', '#0d9488', 30, true, 'seed'),
  ('int_financ', 'INT. FINANC.', 'INT. FINANC. - SEBIN', '#059669', 40, true, 'seed'),
  ('dir_secretaria', 'DIR. SECRETARÍA', 'DIR. SECRETARIA - SEBIN', '#ca8a04', 50, true, 'seed'),
  ('dir_patrullaje', 'DIR. PATRULLAJE', 'DIR. PATRULLAJE - SEBIN', '#d97706', 60, true, 'seed'),
  ('dir_control_adm', 'DIR. CONTROL ADM.', 'DIR. CONTROL ADM. - SEBIN', '#ea580c', 70, true, 'seed'),
  ('dir_ciber_int', 'DIR. CIBER INT.', 'DIR. CIBER INT. - SEBIN', '#7c3aed', 80, true, 'seed'),
  ('dir_contra_int', 'DIR. CONTRA INT.', 'DIR. CONTRA INT. - SEBIN', '#db2777', 90, true, 'seed'),
  ('dir_contra_int_ortega', 'DIR. CONTRA INT. (ORTEGA)', 'DIR. CONTRA INT. (ORTEGA) - SEBIN', '#e11d48', 100, true, 'seed'),
  ('dir_int', 'DIR. INT.', 'DIR. INT. - SEBIN', '#4f46e5', 110, true, 'seed'),
  ('control_educativo', 'CONTROL EDUCATIVO', 'CONTROL EDUCATIVO - SEBIN', '#65a30d', 120, true, 'seed'),
  ('sin_asignar', 'Sin unidad', '', '#64748b', 999, true, 'seed')
on conflict (clave) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'unidades_sebin'
  ) then
    alter publication supabase_realtime add table public.unidades_sebin;
  end if;
end $$;
