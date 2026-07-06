-- Eventos del reporte diario por campamento (xzwifkckkakldnzkdeby).
--
-- PENDIENTE DE APLICAR. Este archivo deja versionado el SQL para crear la
-- tabla `eventos_reportes` y agregar el flag `eventos_revisados` al reporte
-- diario. No fue aplicado contra Supabase remoto en esta intervención.
--
-- RLS: mismo patrón que reportes_centros / reportes_reparaciones_dia
-- (helpers mi_rol(), mis_centros()). La tabla queda en Realtime.

-- ============================================================================
-- reportes_centros — flag de cierre del bloque Eventos
-- ============================================================================
alter table public.reportes_centros
  add column if not exists eventos_revisados boolean not null default false;

-- ============================================================================
-- eventos_reportes — eventos positivos/negativos del reporte diario
-- ============================================================================
create table if not exists public.eventos_reportes (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  dia date not null,
  ts bigint not null,
  tipo text not null check (tipo in ('positivo', 'negativo')),
  titulo text not null,
  descripcion text not null default '',
  participantes jsonb not null default '[]'::jsonb,
  creada_por text,
  updated_at bigint,
  updated_by text,
  constraint eventos_reportes_participantes_array
    check (jsonb_typeof(participantes) = 'array')
);

create index if not exists eventos_reportes_dia_idx
  on public.eventos_reportes (dia);
create index if not exists eventos_reportes_centro_dia_idx
  on public.eventos_reportes (centro_id, dia);
create index if not exists eventos_reportes_tipo_idx
  on public.eventos_reportes (tipo);

grant select, insert, update, delete on public.eventos_reportes to authenticated;

alter table public.eventos_reportes enable row level security;

drop policy if exists eventos_reportes_select on public.eventos_reportes;
create policy eventos_reportes_select on public.eventos_reportes
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_id = any ((select public.mis_centros())::text[])
  );

drop policy if exists eventos_reportes_insert on public.eventos_reportes;
create policy eventos_reportes_insert on public.eventos_reportes
  for insert to authenticated
  with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

drop policy if exists eventos_reportes_update on public.eventos_reportes;
create policy eventos_reportes_update on public.eventos_reportes
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

drop policy if exists eventos_reportes_delete on public.eventos_reportes;
create policy eventos_reportes_delete on public.eventos_reportes
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
  alter publication supabase_realtime add table public.eventos_reportes;
exception
  when duplicate_object then null;
end $$;
