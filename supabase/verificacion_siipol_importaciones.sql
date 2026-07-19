-- Estado persistente de verificación SIIPOL para Importaciones Excel.
-- Una verificación positiva es monotónica: una planilla posterior sin evidencia
-- no borra una verificación anterior.

alter table public.censo_registros
  add column if not exists verificado_siipol boolean not null default false,
  add column if not exists verificado_siipol_en timestamptz,
  add column if not exists verificado_siipol_fuente text not null default '';

comment on column public.censo_registros.verificado_siipol is
  'True si existe evidencia explícita de consulta/verificación SIIPOL';
comment on column public.censo_registros.verificado_siipol_en is
  'Fecha de la primera verificación SIIPOL registrada';
comment on column public.censo_registros.verificado_siipol_fuente is
  'Archivo que aportó la primera evidencia de verificación SIIPOL';

create index if not exists censo_registros_siipol_pendiente_idx
  on public.censo_registros (centro_id, verificado_siipol)
  where origen = 'import_excel';

-- Segunda fase del importador: marca únicamente filas cuya planilla aportó
-- evidencia explícita. Acepta filas con o sin cédula.
create or replace function public.censo_marcar_siipol_lote(
  p_filas jsonb,
  p_fuente text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
  v_fila jsonb;
  v_norm text;
  v_actualizados int := 0;
  v_cantidad int;
  v_fuente text := left(coalesce(nullif(trim(p_fuente), ''), 'sin_nombre'), 240);
begin
  if v_rol not in ('admin', 'analista_sae') then
    raise exception 'Acceso denegado: solo admin o analista_sae pueden marcar SIIPOL';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'p_filas debe ser un arreglo JSON';
  end if;

  for v_fila in
    select value
    from jsonb_array_elements(p_filas)
    where lower(trim(coalesce(value->>'verificado_siipol', 'false')))
      in ('true', 't', '1', 'si', 'sí', 'yes', 'y')
  loop
    v_norm := nullif(
      upper(regexp_replace(coalesce(v_fila->>'documento', ''), '[^A-Za-z0-9]', '', 'g')),
      ''
    );

    if v_norm is not null then
      update public.censo_registros r
      set
        verificado_siipol = true,
        verificado_siipol_en = coalesce(r.verificado_siipol_en, now()),
        verificado_siipol_fuente = case
          when coalesce(r.verificado_siipol_fuente, '') = '' then v_fuente
          else r.verificado_siipol_fuente
        end
      where r.documento_norm = v_norm;
    else
      update public.censo_registros r
      set
        verificado_siipol = true,
        verificado_siipol_en = coalesce(r.verificado_siipol_en, now()),
        verificado_siipol_fuente = case
          when coalesce(r.verificado_siipol_fuente, '') = '' then v_fuente
          else r.verificado_siipol_fuente
        end
      where r.origen = 'import_excel'
        and r.fuente_archivo = v_fuente
        and r.centro_id = nullif(trim(v_fila->>'centro_id'), '')
        and lower(trim(r.primer_nombre)) =
          lower(trim(coalesce(v_fila->>'primer_nombre', '')))
        and lower(trim(r.segundo_nombre)) =
          lower(trim(coalesce(v_fila->>'segundo_nombre', '')))
        and lower(trim(r.primer_apellido)) =
          lower(trim(coalesce(v_fila->>'primer_apellido', '')))
        and lower(trim(r.segundo_apellido)) =
          lower(trim(coalesce(v_fila->>'segundo_apellido', '')));
    end if;

    get diagnostics v_cantidad = row_count;
    v_actualizados := v_actualizados + v_cantidad;
  end loop;

  return jsonb_build_object('marcados_siipol', v_actualizados);
end;
$$;

-- Nuevo overload: conserva la firma anterior para consumidores viejos.
create or replace function public.censo_listado_red_conteo(
  p_verificado_siipol boolean,
  p_centro_id text default null,
  p_sexo text default null,
  p_busqueda text default null,
  p_solicitado boolean default null,
  p_registro_policial boolean default null,
  p_firmo boolean default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busqueda text := nullif(trim(coalesce(p_busqueda, '')), '');
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  if v_rol = 'supervisor' then
    if p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' then
      null;
    elsif not (p_centro_id = any (v_centros)) then
      raise exception 'Acceso denegado';
    end if;
  end if;

  return (
    select count(*)::bigint
    from public.censo_registros r
    inner join public.centros c on c.id = r.centro_id and not c.deleted
    where
      (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
      and (v_rol <> 'supervisor' or r.centro_id = any (v_centros))
      and (p_sexo is null or p_sexo = '' or p_sexo = 'todos' or r.sexo = p_sexo)
      and (p_solicitado is null or r.solicitado = p_solicitado)
      and (p_registro_policial is null or r.registro_policial = p_registro_policial)
      and (p_firmo is null or r.firmo_contra_presidente = p_firmo)
      and (p_verificado_siipol is null or r.verificado_siipol = p_verificado_siipol)
      and (
        v_busqueda is null
        or concat_ws(
          ' ',
          r.primer_nombre,
          r.segundo_nombre,
          r.primer_apellido,
          r.segundo_apellido,
          r.tipo_doc,
          r.documento,
          r.telefono,
          r.fuente_archivo,
          r.nombre_centro_raw,
          r.tipo_registro_policial,
          r.observaciones_seguridad,
          coalesce(nullif(trim(c.data->>'nombre'), ''), c.id)
        ) ilike '%' || v_busqueda || '%'
      )
  );
end;
$$;

-- Nuevo overload: agrega estado SIIPOL por fila y filtro sin romper firma vieja.
create or replace function public.censo_listado_red_paginado(
  p_verificado_siipol boolean,
  p_limit int default 50,
  p_offset int default 0,
  p_centro_id text default null,
  p_sexo text default null,
  p_busqueda text default null,
  p_orden text default 'reciente',
  p_solicitado boolean default null,
  p_registro_policial boolean default null,
  p_firmo boolean default null
)
returns table (
  id uuid,
  centro_id text,
  centro_nombre text,
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
  casa_edificio text,
  origen text,
  fuente_archivo text,
  importado_en timestamptz,
  nombre_centro_raw text,
  centro_match text,
  registro_policial boolean,
  solicitado boolean,
  firmo_contra_presidente boolean,
  deportado boolean,
  tipo_registro_policial text,
  observaciones_seguridad text,
  verificacion_seguridad_en timestamptz,
  verificado_siipol boolean,
  verificado_siipol_en timestamptz,
  verificado_siipol_fuente text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busqueda text := nullif(trim(coalesce(p_busqueda, '')), '');
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 1000);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_orden text := coalesce(nullif(trim(p_orden), ''), 'reciente');
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  if v_rol = 'supervisor' then
    if p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' then
      null;
    elsif not (p_centro_id = any (v_centros)) then
      raise exception 'Acceso denegado';
    end if;
  end if;

  return query
  select
    r.id,
    r.centro_id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id),
    r.creado_en,
    r.primer_nombre,
    r.segundo_nombre,
    r.primer_apellido,
    r.segundo_apellido,
    r.edad,
    r.tipo_doc,
    r.documento,
    r.sexo,
    r.telefono,
    r.embarazada,
    r.embarazo_semanas,
    r.discapacidad,
    r.discapacidad_detalle,
    r.enfermedad,
    r.enfermedad_detalle,
    r.jefe_tipo_doc,
    r.jefe_documento,
    r.parentesco_jefe,
    r.jefe_registro_id,
    r.pais,
    r.condicion_vivienda,
    r.estado_federativo,
    r.municipio,
    r.parroquia,
    r.calle,
    r.casa_edificio,
    r.origen,
    r.fuente_archivo,
    r.importado_en,
    r.nombre_centro_raw,
    r.centro_match,
    r.registro_policial,
    r.solicitado,
    r.firmo_contra_presidente,
    r.deportado,
    r.tipo_registro_policial,
    r.observaciones_seguridad,
    r.verificacion_seguridad_en,
    r.verificado_siipol,
    r.verificado_siipol_en,
    r.verificado_siipol_fuente
  from public.censo_registros r
  inner join public.centros c on c.id = r.centro_id and not c.deleted
  where
    (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
    and (v_rol <> 'supervisor' or r.centro_id = any (v_centros))
    and (p_sexo is null or p_sexo = '' or p_sexo = 'todos' or r.sexo = p_sexo)
    and (p_solicitado is null or r.solicitado = p_solicitado)
    and (p_registro_policial is null or r.registro_policial = p_registro_policial)
    and (p_firmo is null or r.firmo_contra_presidente = p_firmo)
    and (p_verificado_siipol is null or r.verificado_siipol = p_verificado_siipol)
    and (
      v_busqueda is null
      or concat_ws(
        ' ',
        r.primer_nombre,
        r.segundo_nombre,
        r.primer_apellido,
        r.segundo_apellido,
        r.tipo_doc,
        r.documento,
        r.telefono,
        r.fuente_archivo,
        r.nombre_centro_raw,
        r.tipo_registro_policial,
        r.observaciones_seguridad,
        coalesce(nullif(trim(c.data->>'nombre'), ''), c.id)
      ) ilike '%' || v_busqueda || '%'
    )
  order by
    case when v_orden = 'siipol' then r.verificado_siipol end desc nulls last,
    case when v_orden = 'solicitado' then r.solicitado end desc nulls last,
    case when v_orden = 'reg_policial' then r.registro_policial end desc nulls last,
    case when v_orden = 'referendum' then r.firmo_contra_presidente end desc nulls last,
    case when v_orden = 'con_cedula' then (nullif(trim(coalesce(r.documento, '')), '') is not null) end desc nulls last,
    case when v_orden = 'sin_cedula' then (nullif(trim(coalesce(r.documento, '')), '') is null) end desc nulls last,
    case when v_orden = 'campamento' then lower(coalesce(nullif(trim(c.data->>'nombre'), ''), c.id)) end asc nulls last,
    case when v_orden = 'nombre' then lower(concat_ws(' ', r.primer_apellido, r.primer_nombre, r.segundo_apellido)) end asc nulls last,
    case when v_orden = 'edad' then r.edad end desc nulls last,
    r.creado_en desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.censo_siipol_resumen()
returns table (
  total_importados bigint,
  verificados bigint,
  pendientes bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
  v_centros text[] := (select public.mis_centros());
begin
  if v_rol not in ('admin', 'analista_sae', 'autoridad', 'censo_rapido', 'supervisor') then
    raise exception 'Acceso denegado';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where r.verificado_siipol)::bigint,
    count(*) filter (where not r.verificado_siipol)::bigint
  from public.censo_registros r
  inner join public.centros c on c.id = r.centro_id and not c.deleted
  where v_rol <> 'supervisor' or r.centro_id = any (v_centros);
end;
$$;

-- Reconciliación autoritativa: solo documentos presentes en la lista quedan
-- verificados. Filas sin documento permanecen pendientes.
create or replace function public.censo_reconciliar_siipol(
  p_documentos text[],
  p_fuente text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
  v_documentos text[];
  v_desmarcados int := 0;
  v_marcados int := 0;
  v_fuente text := left(coalesce(nullif(trim(p_fuente), ''), 'sin_nombre'), 240);
begin
  if v_rol not in ('admin', 'analista_sae') then
    raise exception 'Acceso denegado: solo admin o analista_sae pueden reconciliar SIIPOL';
  end if;

  select coalesce(array_agg(distinct documento), '{}'::text[])
    into v_documentos
  from (
    select nullif(upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g')), '') as documento
    from unnest(coalesce(p_documentos, '{}'::text[])) raw
  ) normalizados
  where documento is not null;

  update public.censo_registros
  set
    verificado_siipol = false,
    verificado_siipol_en = null,
    verificado_siipol_fuente = ''
  where verificado_siipol;
  get diagnostics v_desmarcados = row_count;

  update public.censo_registros
  set
    verificado_siipol = true,
    verificado_siipol_en = now(),
    verificado_siipol_fuente = v_fuente
  where documento_norm = any(v_documentos);
  get diagnostics v_marcados = row_count;

  return jsonb_build_object(
    'documentos_lista', cardinality(v_documentos),
    'marcados', v_marcados,
    'sin_coincidencia', greatest(cardinality(v_documentos) - v_marcados, 0),
    'desmarcados_previos', v_desmarcados
  );
end;
$$;

revoke all on function public.censo_marcar_siipol_lote(jsonb, text) from public, anon;
grant execute on function public.censo_marcar_siipol_lote(jsonb, text) to authenticated;

revoke all on function public.censo_listado_red_conteo(
  boolean, text, text, text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.censo_listado_red_conteo(
  boolean, text, text, text, boolean, boolean, boolean
) to authenticated;

revoke all on function public.censo_listado_red_paginado(
  boolean, integer, integer, text, text, text, text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.censo_listado_red_paginado(
  boolean, integer, integer, text, text, text, text, boolean, boolean, boolean
) to authenticated;

revoke all on function public.censo_siipol_resumen() from public, anon;
grant execute on function public.censo_siipol_resumen() to authenticated;

revoke all on function public.censo_reconciliar_siipol(text[], text) from public, anon;
grant execute on function public.censo_reconciliar_siipol(text[], text) to authenticated;
