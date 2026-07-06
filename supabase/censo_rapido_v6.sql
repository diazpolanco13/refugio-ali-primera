-- Censo rápido v6 — edición posterior de registros + cierre del censo.
--
-- ✅ APLICADA (migración `censo_rapido_edicion_cierre_v6`, 06-jul-2026, vía
-- MCP `apply_migration`). Este archivo queda como referencia versionada del
-- SQL en producción. Complementa a censo_rapido.sql, _v2 … _v5.
--
-- Cambios:
--   1) censo_actualizar: corrige un registro existente desde la planilla
--      pública (mismas validaciones que el alta; el chequeo de cédula
--      duplicada excluye al propio registro; re-enlaza menores pendientes).
--   2) censo_cierres + censo_completar / censo_cierre: constancia de que el
--      funcionario declaró completada la totalidad del registro del refugio
--      (guarda funcionario, total y fecha; se consulta el último cierre).
--   3) censo_listado recreada para incluir pais (necesario para editar).

-- ============================================================================
-- Cierres del censo por refugio
-- ============================================================================
create table public.censo_cierres (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  funcionario_jerarquia text not null default '',
  funcionario_nombre text not null default '',
  funcionario_institucion text not null default '',
  funcionario_telefono text not null default '',
  total_registrados int not null default 0,
  creado_en timestamptz not null default now()
);

create index censo_cierres_centro_idx on public.censo_cierres (centro_id, creado_en desc);

alter table public.censo_cierres enable row level security;

create policy censo_cierres_select on public.censo_cierres
  for select to authenticated
  using (true);

create policy censo_cierres_delete on public.censo_cierres
  for delete to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));

-- ============================================================================
-- RPC: actualizar/corregir un registro existente
-- ============================================================================
create or replace function public.censo_actualizar(
  p_id uuid,
  p_registro jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_centro_id text;
  v_edad int;
  v_tipo_doc text;
  v_sexo text;
  v_condicion text;
  v_embarazada boolean;
  v_semanas int;
  v_documento text;
  v_norm text;
  v_jefe_tipo_doc text;
  v_jefe_documento text;
  v_jefe_norm text;
  v_jefe_id uuid;
  v_dup record;
begin
  select r.centro_id into v_centro_id from public.censo_registros r where r.id = p_id;
  if not found then
    raise exception 'Registro no encontrado';
  end if;

  if coalesce(trim(p_registro->>'primer_nombre'), '') = ''
     or coalesce(trim(p_registro->>'primer_apellido'), '') = '' then
    raise exception 'Primer nombre y primer apellido son obligatorios';
  end if;

  v_edad := nullif(trim(coalesce(p_registro->>'edad', '')), '')::int;
  v_tipo_doc := nullif(trim(coalesce(p_registro->>'tipo_doc', '')), '');
  v_sexo := nullif(trim(coalesce(p_registro->>'sexo', '')), '');
  v_condicion := coalesce(trim(p_registro->>'condicion_vivienda'), '');
  if v_condicion not in ('', 'destruida', 'inhabitable', 'no_posee') then
    v_condicion := '';
  end if;

  v_embarazada := (v_sexo = 'F' and coalesce((p_registro->>'embarazada')::boolean, false));
  v_semanas := case
    when v_embarazada then nullif(trim(coalesce(p_registro->>'embarazo_semanas', '')), '')::int
    else null
  end;
  if v_semanas is not null and (v_semanas < 1 or v_semanas > 45) then
    v_semanas := null;
  end if;

  v_documento := left(coalesce(trim(p_registro->>'documento'), ''), 40);
  v_norm := nullif(upper(regexp_replace(v_documento, '[^A-Za-z0-9]', '', 'g')), '');
  if v_norm is not null then
    select r.primer_nombre, r.primer_apellido, coalesce(c.data->>'nombre', r.centro_id) as refugio
      into v_dup
      from public.censo_registros r
      left join public.centros c on c.id = r.centro_id
      where r.documento_norm = v_norm and r.id <> p_id
      limit 1;
    if found then
      raise exception 'Esta cédula ya fue registrada (% % en %)',
        v_dup.primer_nombre, v_dup.primer_apellido, v_dup.refugio;
    end if;
  end if;

  v_jefe_tipo_doc := nullif(trim(coalesce(p_registro->>'jefe_tipo_doc', '')), '');
  if v_jefe_tipo_doc not in ('V', 'E', 'P') then
    v_jefe_tipo_doc := null;
  end if;
  -- (corregido en migración censo_rapido_fix_jefe_documento_null)
  v_jefe_documento := left(coalesce(trim(p_registro->>'jefe_documento'), ''), 40);
  v_jefe_norm := nullif(upper(regexp_replace(v_jefe_documento, '[^A-Za-z0-9]', '', 'g')), '');
  v_jefe_id := null;
  if v_jefe_norm is not null then
    select r.id into v_jefe_id
      from public.censo_registros r
      where r.documento_norm = v_jefe_norm and r.id <> p_id
      order by (r.centro_id = v_centro_id) desc, r.creado_en desc
      limit 1;
  end if;

  begin
    update public.censo_registros set
      primer_nombre = left(trim(p_registro->>'primer_nombre'), 80),
      segundo_nombre = left(coalesce(trim(p_registro->>'segundo_nombre'), ''), 80),
      primer_apellido = left(trim(p_registro->>'primer_apellido'), 80),
      segundo_apellido = left(coalesce(trim(p_registro->>'segundo_apellido'), ''), 80),
      edad = v_edad,
      tipo_doc = v_tipo_doc,
      documento = v_documento,
      documento_norm = v_norm,
      sexo = v_sexo,
      telefono = left(coalesce(trim(p_registro->>'telefono'), ''), 40),
      embarazada = v_embarazada,
      embarazo_semanas = v_semanas,
      discapacidad = coalesce((p_registro->>'discapacidad')::boolean, false),
      discapacidad_detalle = left(coalesce(trim(p_registro->>'discapacidad_detalle'), ''), 300),
      enfermedad = coalesce((p_registro->>'enfermedad')::boolean, false),
      enfermedad_detalle = left(coalesce(trim(p_registro->>'enfermedad_detalle'), ''), 300),
      jefe_tipo_doc = v_jefe_tipo_doc,
      jefe_documento = v_jefe_documento,
      parentesco_jefe = left(coalesce(trim(p_registro->>'parentesco_jefe'), ''), 60),
      jefe_registro_id = v_jefe_id,
      pais = left(coalesce(nullif(trim(p_registro->>'pais'), ''), 'Venezuela'), 80),
      estado_federativo = left(coalesce(trim(p_registro->>'estado_federativo'), ''), 80),
      municipio = left(coalesce(trim(p_registro->>'municipio'), ''), 120),
      parroquia = left(coalesce(trim(p_registro->>'parroquia'), ''), 120),
      condicion_vivienda = v_condicion,
      calle = left(coalesce(trim(p_registro->>'calle'), ''), 300),
      casa_edificio = left(coalesce(trim(p_registro->>'casa_edificio'), ''), 300)
    where id = p_id;
  exception when unique_violation then
    raise exception 'Esta cédula ya fue registrada';
  end;

  -- Re-enlaza menores pendientes si este registro tiene cédula propia.
  if v_norm is not null then
    update public.censo_registros r
      set jefe_registro_id = p_id
      where r.jefe_registro_id is null
        and r.id <> p_id
        and nullif(upper(regexp_replace(r.jefe_documento, '[^A-Za-z0-9]', '', 'g')), '') = v_norm;
  end if;

  return p_id;
end;
$$;

revoke all on function public.censo_actualizar(uuid, jsonb) from public;
grant execute on function public.censo_actualizar(uuid, jsonb) to anon, authenticated;

-- ============================================================================
-- RPC: declarar completado el registro del refugio
-- ============================================================================
create or replace function public.censo_completar(
  p_centro_id text,
  p_funcionario jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  if not exists (select 1 from public.centros c where c.id = p_centro_id and not c.deleted) then
    raise exception 'Refugio inválido';
  end if;

  select count(*) into v_total from public.censo_registros r where r.centro_id = p_centro_id;

  insert into public.censo_cierres (
    centro_id, funcionario_jerarquia, funcionario_nombre,
    funcionario_institucion, funcionario_telefono, total_registrados
  ) values (
    p_centro_id,
    left(coalesce(trim(p_funcionario->>'jerarquia'), ''), 120),
    left(coalesce(trim(p_funcionario->>'nombre'), ''), 160),
    left(coalesce(trim(p_funcionario->>'institucion'), ''), 160),
    left(coalesce(trim(p_funcionario->>'telefono'), ''), 40),
    v_total
  );

  return v_total;
end;
$$;

revoke all on function public.censo_completar(text, jsonb) from public;
grant execute on function public.censo_completar(text, jsonb) to anon, authenticated;

-- ============================================================================
-- RPC: último cierre declarado de un refugio
-- ============================================================================
create or replace function public.censo_cierre(p_centro_id text)
returns table (
  creado_en timestamptz,
  funcionario_nombre text,
  funcionario_institucion text,
  total_registrados int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.creado_en, c.funcionario_nombre, c.funcionario_institucion, c.total_registrados
  from public.censo_cierres c
  where c.centro_id = p_centro_id
  order by c.creado_en desc
  limit 1;
$$;

revoke all on function public.censo_cierre(text) from public;
grant execute on function public.censo_cierre(text) to anon, authenticated;

-- ============================================================================
-- Listado: incluye pais (necesario para la edición)
-- ============================================================================
drop function if exists public.censo_listado(text);
create function public.censo_listado(p_centro_id text)
returns table (
  id uuid,
  creado_en timestamptz,
  primer_nombre text,
  segundo_nombre text,
  primer_apellido text,
  segundo_apellido text,
  edad int,
  tipo_doc text,
  documento text,
  sexo text,
  telefono text,
  embarazada boolean,
  embarazo_semanas int,
  discapacidad boolean,
  discapacidad_detalle text,
  enfermedad boolean,
  enfermedad_detalle text,
  jefe_tipo_doc text,
  jefe_documento text,
  parentesco_jefe text,
  jefe_registro_id uuid,
  pais text,
  condicion_vivienda text,
  estado_federativo text,
  municipio text,
  parroquia text,
  calle text,
  casa_edificio text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.creado_en,
    r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido,
    r.edad, r.tipo_doc, r.documento, r.sexo, r.telefono,
    r.embarazada, r.embarazo_semanas,
    r.discapacidad, r.discapacidad_detalle,
    r.enfermedad, r.enfermedad_detalle,
    r.jefe_tipo_doc, r.jefe_documento, r.parentesco_jefe, r.jefe_registro_id,
    r.pais, r.condicion_vivienda, r.estado_federativo, r.municipio, r.parroquia,
    r.calle, r.casa_edificio
  from public.censo_registros r
  where r.centro_id = p_centro_id
  order by r.creado_en desc;
$$;

revoke all on function public.censo_listado(text) from public;
grant execute on function public.censo_listado(text) to anon, authenticated;
