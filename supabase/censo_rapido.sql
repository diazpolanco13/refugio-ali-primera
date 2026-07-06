-- Censo rápido en terreno (sin login) — planilla pública /censo (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `censo_rapido_publico`, 06-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- en producción.
--
-- Diseño: la tabla `censo_registros` es un staging de levantamiento en campo.
-- NO tiene políticas para `anon`: toda escritura pasa por la RPC
-- `censo_registrar` (security definer) que valida centro y campos mínimos.
-- La lectura queda restringida a usuarios autenticados para la consolidación
-- posterior hacia refugiados/alojamientos (columna `procesado`).

create table public.censo_registros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  -- Funcionario que dirige el levantamiento en la escuela
  funcionario_jerarquia text not null default '',
  funcionario_nombre text not null default '',
  funcionario_institucion text not null default '',
  funcionario_telefono text not null default '',
  -- Datos de la persona refugiada
  primer_nombre text not null default '',
  segundo_nombre text not null default '',
  primer_apellido text not null default '',
  segundo_apellido text not null default '',
  edad int check (edad is null or (edad >= 0 and edad <= 120)),
  tipo_doc text check (tipo_doc is null or tipo_doc in ('V', 'E', 'P')),
  documento text not null default '',
  sexo text check (sexo is null or sexo in ('M', 'F', 'O')),
  -- Dirección de la vivienda perdida / damnificada
  pais text not null default 'Venezuela',
  estado_federativo text not null default '',
  municipio text not null default '',
  parroquia text not null default '',
  direccion text not null default '',
  -- Consolidación posterior hacia refugiados/alojamientos
  procesado boolean not null default false,
  creado_en timestamptz not null default now()
);

create index censo_registros_centro_idx on public.censo_registros (centro_id);
create index censo_registros_procesado_idx on public.censo_registros (procesado, creado_en);

alter table public.censo_registros enable row level security;

create policy censo_registros_select on public.censo_registros
  for select to authenticated
  using (true);

create policy censo_registros_update on public.censo_registros
  for update to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'))
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));

create policy censo_registros_delete on public.censo_registros
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ============================================================================
-- RPC: lista de refugios activos (id + nombre) para el selector público
-- ============================================================================
create or replace function public.censo_centros()
returns table (id text, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, coalesce(nullif(trim(c.data->>'nombre'), ''), c.id) as nombre
  from public.centros c
  where not c.deleted
  order by 2;
$$;

revoke all on function public.censo_centros() from public;
grant execute on function public.censo_centros() to anon, authenticated;

-- ============================================================================
-- RPC: registrar una persona del censo rápido
-- ============================================================================
create or replace function public.censo_registrar(
  p_centro_id text,
  p_funcionario jsonb,
  p_registro jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_edad int;
  v_tipo_doc text;
  v_sexo text;
begin
  if not exists (select 1 from public.centros c where c.id = p_centro_id and not c.deleted) then
    raise exception 'Refugio inválido';
  end if;

  if coalesce(trim(p_registro->>'primer_nombre'), '') = ''
     or coalesce(trim(p_registro->>'primer_apellido'), '') = '' then
    raise exception 'Primer nombre y primer apellido son obligatorios';
  end if;

  v_edad := nullif(trim(coalesce(p_registro->>'edad', '')), '')::int;
  v_tipo_doc := nullif(trim(coalesce(p_registro->>'tipo_doc', '')), '');
  v_sexo := nullif(trim(coalesce(p_registro->>'sexo', '')), '');

  insert into public.censo_registros (
    centro_id,
    funcionario_jerarquia, funcionario_nombre, funcionario_institucion, funcionario_telefono,
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    edad, tipo_doc, documento, sexo,
    pais, estado_federativo, municipio, parroquia, direccion
  ) values (
    p_centro_id,
    left(coalesce(trim(p_funcionario->>'jerarquia'), ''), 120),
    left(coalesce(trim(p_funcionario->>'nombre'), ''), 160),
    left(coalesce(trim(p_funcionario->>'institucion'), ''), 160),
    left(coalesce(trim(p_funcionario->>'telefono'), ''), 40),
    left(trim(p_registro->>'primer_nombre'), 80),
    left(coalesce(trim(p_registro->>'segundo_nombre'), ''), 80),
    left(trim(p_registro->>'primer_apellido'), 80),
    left(coalesce(trim(p_registro->>'segundo_apellido'), ''), 80),
    v_edad,
    v_tipo_doc,
    left(coalesce(trim(p_registro->>'documento'), ''), 40),
    v_sexo,
    left(coalesce(nullif(trim(p_registro->>'pais'), ''), 'Venezuela'), 80),
    left(coalesce(trim(p_registro->>'estado_federativo'), ''), 80),
    left(coalesce(trim(p_registro->>'municipio'), ''), 120),
    left(coalesce(trim(p_registro->>'parroquia'), ''), 120),
    left(coalesce(trim(p_registro->>'direccion'), ''), 600)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.censo_registrar(text, jsonb, jsonb) from public;
grant execute on function public.censo_registrar(text, jsonb, jsonb) to anon, authenticated;
