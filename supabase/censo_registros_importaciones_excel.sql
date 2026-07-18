-- Importaciones Excel (antes «censo anterior» / staging censo_registros).
--
-- Redefine metadatos de origen: planillas externas no verificadas importadas
-- vía MCP/scripts. Prioriza cédulas (documento_norm) y matching de centros.
-- Upsert por cédula: si reaparece en otro Excel/refugio, actualiza centro y
-- acumula historial (no pierde pista).

-- ============================================================================
-- 1) Columnas de origen / import
-- ============================================================================
alter table public.censo_registros
  add column if not exists origen text not null default 'terreno'
    check (origen in ('terreno', 'import_excel')),
  add column if not exists fuente_archivo text not null default '',
  add column if not exists importado_en timestamptz,
  add column if not exists nombre_centro_raw text not null default '',
  add column if not exists centro_match text not null default ''
    check (centro_match in ('', 'exacto', 'alias', 'fuzzy', 'manual', 'forzado')),
  add column if not exists historial_centros jsonb not null default '[]'::jsonb,
  add column if not exists registro_policial boolean not null default false,
  add column if not exists solicitado boolean not null default false,
  add column if not exists firmo_contra_presidente boolean not null default false,
  add column if not exists deportado boolean not null default false,
  add column if not exists tipo_registro_policial text not null default '',
  add column if not exists observaciones_seguridad text not null default '',
  add column if not exists verificacion_seguridad_en timestamptz;

comment on column public.censo_registros.origen is
  'terreno = planilla/app; import_excel = relación externa no verificada';
comment on column public.censo_registros.fuente_archivo is
  'Nombre del Excel/CSV importado (trazabilidad MCP)';
comment on column public.censo_registros.nombre_centro_raw is
  'Nombre de campamento tal cual venía en el archivo (antes del match)';
comment on column public.censo_registros.centro_match is
  'Cómo se resolvió centro_id: exacto|alias|fuzzy|manual|forzado';
comment on column public.censo_registros.historial_centros is
  'Centros previos reportados para la misma cédula (jsonb array)';
comment on column public.censo_registros.registro_policial is
  'Verificación SIIPOL/planilla externa: tiene registro policial';
comment on column public.censo_registros.solicitado is
  'Verificación SIIPOL/planilla externa: persona solicitada';
comment on column public.censo_registros.tipo_registro_policial is
  'Tipo/resumen de registro policial reportado por la planilla externa';
comment on column public.censo_registros.observaciones_seguridad is
  'Observaciones de seguridad reportadas por SIIPOL/planilla externa';
comment on column public.censo_registros.verificacion_seguridad_en is
  'Fecha en que se cargó o actualizó la verificación de seguridad';

create index if not exists censo_registros_origen_idx
  on public.censo_registros (origen)
  where origen = 'import_excel';

create index if not exists censo_registros_fuente_idx
  on public.censo_registros (fuente_archivo)
  where fuente_archivo <> '';

create index if not exists censo_registros_seguridad_idx
  on public.censo_registros (solicitado, registro_policial)
  where solicitado or registro_policial;

-- Backfill: imports legacy marcados como «Importación planilla»
update public.censo_registros
set
  origen = 'import_excel',
  importado_en = coalesce(importado_en, creado_en),
  fuente_archivo = case
    when coalesce(trim(fuente_archivo), '') = '' then 'importacion_legacy'
    else fuente_archivo
  end,
  centro_match = case
    when coalesce(trim(centro_match), '') = '' then 'forzado'
    else centro_match
  end
where funcionario_nombre = 'Importación planilla'
   or origen = 'import_excel';

-- ============================================================================
-- 2) RPC: importar lote (upsert por documento_norm)
-- ============================================================================
create or replace function public.censo_importar_lote(
  p_filas jsonb,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
  v_fila jsonb;
  v_centro_id text;
  v_norm text;
  v_tipo_doc text;
  v_documento text;
  v_sexo text;
  v_edad int;
  v_existente record;
  v_id uuid;
  v_hay_existente boolean;
  v_insertados int := 0;
  v_actualizados int := 0;
  v_omitidos int := 0;
  v_errores jsonb := '[]'::jsonb;
  v_fuente text := left(coalesce(nullif(trim(p_meta->>'fuente_archivo'), ''), 'sin_nombre'), 240);
  v_idx int := 0;
  v_hist jsonb;
  v_nombre_raw text;
  v_match text;
  v_registro_policial boolean;
  v_solicitado boolean;
  v_firmo_contra_presidente boolean;
  v_deportado boolean;
  v_tipo_registro_policial text;
  v_observaciones_seguridad text;
begin
  if v_rol not in ('admin', 'analista_sae') then
    raise exception 'Acceso denegado: solo admin o analista_sae pueden importar Excel';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'p_filas debe ser un arreglo JSON';
  end if;

  for v_fila in select * from jsonb_array_elements(p_filas)
  loop
    v_idx := v_idx + 1;
    begin
      v_centro_id := nullif(trim(v_fila->>'centro_id'), '');
      if v_centro_id is null
         or not exists (select 1 from public.centros c where c.id = v_centro_id and not c.deleted) then
        v_omitidos := v_omitidos + 1;
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx,
          'error', 'centro_id inválido',
          'centro_id', v_fila->>'centro_id'
        ));
        continue;
      end if;

      if coalesce(trim(v_fila->>'primer_nombre'), '') = ''
         or coalesce(trim(v_fila->>'primer_apellido'), '') = '' then
        v_omitidos := v_omitidos + 1;
        v_errores := v_errores || jsonb_build_array(jsonb_build_object(
          'fila', v_idx,
          'error', 'falta nombre o apellido'
        ));
        continue;
      end if;

      v_documento := left(coalesce(trim(v_fila->>'documento'), ''), 40);
      v_tipo_doc := nullif(trim(coalesce(v_fila->>'tipo_doc', '')), '');
      if v_tipo_doc is not null and v_tipo_doc not in ('V', 'E', 'P') then
        v_tipo_doc := null;
      end if;
      -- Misma normalización que censo_registrar (solo alfanumérico mayúsculas)
      v_norm := nullif(upper(regexp_replace(v_documento, '[^A-Za-z0-9]', '', 'g')), '');

      v_sexo := nullif(trim(coalesce(v_fila->>'sexo', '')), '');
      if v_sexo is not null and v_sexo not in ('M', 'F', 'O') then
        v_sexo := null;
      end if;
      v_edad := nullif(trim(coalesce(v_fila->>'edad', '')), '')::int;

      v_nombre_raw := left(coalesce(trim(v_fila->>'nombre_centro_raw'), ''), 200);
      v_match := coalesce(nullif(trim(v_fila->>'centro_match'), ''), 'manual');
      if v_match not in ('exacto', 'alias', 'fuzzy', 'manual', 'forzado') then
        v_match := 'manual';
      end if;

      v_registro_policial := lower(trim(coalesce(v_fila->>'registro_policial', 'false')))
        in ('true', 't', '1', 'si', 'sí', 'yes', 'y');
      v_solicitado := lower(trim(coalesce(v_fila->>'solicitado', 'false')))
        in ('true', 't', '1', 'si', 'sí', 'yes', 'y');
      v_firmo_contra_presidente := lower(trim(coalesce(v_fila->>'firmo_contra_presidente', 'false')))
        in ('true', 't', '1', 'si', 'sí', 'yes', 'y');
      v_deportado := lower(trim(coalesce(v_fila->>'deportado', 'false')))
        in ('true', 't', '1', 'si', 'sí', 'yes', 'y');
      v_tipo_registro_policial := left(coalesce(trim(v_fila->>'tipo_registro_policial'), ''), 160);
      v_observaciones_seguridad := left(coalesce(trim(v_fila->>'observaciones_seguridad'), ''), 500);

      v_hay_existente := false;
      if v_norm is not null then
        select r.id, r.centro_id, r.procesado, r.historial_centros, r.nombre_centro_raw,
               r.fuente_archivo, r.importado_en
          into v_existente
        from public.censo_registros r
        where r.documento_norm = v_norm
        limit 1;
        v_hay_existente := found;
      end if;

      if v_hay_existente then
        -- Historial si cambió de centro
        v_hist := coalesce(v_existente.historial_centros, '[]'::jsonb);
        if v_existente.centro_id is distinct from v_centro_id then
          v_hist := v_hist || jsonb_build_array(jsonb_build_object(
            'centro_id', v_existente.centro_id,
            'nombre_centro_raw', coalesce(v_existente.nombre_centro_raw, ''),
            'fuente_archivo', coalesce(v_existente.fuente_archivo, ''),
            'importado_en', v_existente.importado_en,
            'reemplazado_en', now()
          ));
        end if;

        if v_existente.procesado then
          -- Ya en nominal: solo metadatos / historial / centro reportado
          update public.censo_registros r set
            centro_id = v_centro_id,
            origen = 'import_excel',
            fuente_archivo = v_fuente,
            importado_en = now(),
            nombre_centro_raw = v_nombre_raw,
            centro_match = v_match,
            historial_centros = v_hist,
            registro_policial = v_registro_policial,
            solicitado = v_solicitado,
            firmo_contra_presidente = v_firmo_contra_presidente,
            deportado = v_deportado,
            tipo_registro_policial = v_tipo_registro_policial,
            observaciones_seguridad = v_observaciones_seguridad,
            verificacion_seguridad_en = now()
          where r.id = v_existente.id;
        else
          update public.censo_registros r set
            centro_id = v_centro_id,
            primer_nombre = left(trim(v_fila->>'primer_nombre'), 80),
            segundo_nombre = left(coalesce(trim(v_fila->>'segundo_nombre'), ''), 80),
            primer_apellido = left(trim(v_fila->>'primer_apellido'), 80),
            segundo_apellido = left(coalesce(trim(v_fila->>'segundo_apellido'), ''), 80),
            edad = v_edad,
            tipo_doc = v_tipo_doc,
            documento = v_documento,
            documento_norm = v_norm,
            sexo = v_sexo,
            telefono = left(coalesce(trim(v_fila->>'telefono'), ''), 40),
            embarazada = coalesce((v_fila->>'embarazada')::boolean, false) and v_sexo = 'F',
            discapacidad = coalesce((v_fila->>'discapacidad')::boolean, false),
            discapacidad_detalle = left(coalesce(trim(v_fila->>'discapacidad_detalle'), ''), 200),
            enfermedad = coalesce((v_fila->>'enfermedad')::boolean, false),
            enfermedad_detalle = left(coalesce(trim(v_fila->>'enfermedad_detalle'), ''), 200),
            pais = left(coalesce(nullif(trim(v_fila->>'pais'), ''), 'Venezuela'), 80),
            estado_federativo = left(coalesce(trim(v_fila->>'estado_federativo'), ''), 80),
            municipio = left(coalesce(trim(v_fila->>'municipio'), ''), 120),
            parroquia = left(coalesce(trim(v_fila->>'parroquia'), ''), 120),
            calle = left(coalesce(trim(v_fila->>'calle'), ''), 200),
            casa_edificio = left(coalesce(trim(v_fila->>'casa_edificio'), ''), 120),
            funcionario_jerarquia = 'Sistema',
            funcionario_nombre = 'Importación planilla',
            funcionario_institucion = 'Refugios Transitorios',
            origen = 'import_excel',
            fuente_archivo = v_fuente,
            importado_en = now(),
            nombre_centro_raw = v_nombre_raw,
            centro_match = v_match,
            historial_centros = v_hist,
            registro_policial = v_registro_policial,
            solicitado = v_solicitado,
            firmo_contra_presidente = v_firmo_contra_presidente,
            deportado = v_deportado,
            tipo_registro_policial = v_tipo_registro_policial,
            observaciones_seguridad = v_observaciones_seguridad,
            verificacion_seguridad_en = now()
          where r.id = v_existente.id;
        end if;
        v_actualizados := v_actualizados + 1;
      else
        insert into public.censo_registros (
          centro_id,
          funcionario_jerarquia, funcionario_nombre, funcionario_institucion, funcionario_telefono,
          primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
          edad, tipo_doc, documento, documento_norm, sexo,
          telefono, embarazada, discapacidad, discapacidad_detalle,
          enfermedad, enfermedad_detalle,
          pais, estado_federativo, municipio, parroquia, calle, casa_edificio,
          origen, fuente_archivo, importado_en, nombre_centro_raw, centro_match,
          registro_policial, solicitado, firmo_contra_presidente, deportado,
          tipo_registro_policial, observaciones_seguridad, verificacion_seguridad_en
        ) values (
          v_centro_id,
          'Sistema', 'Importación planilla', 'Refugios Transitorios', '',
          left(trim(v_fila->>'primer_nombre'), 80),
          left(coalesce(trim(v_fila->>'segundo_nombre'), ''), 80),
          left(trim(v_fila->>'primer_apellido'), 80),
          left(coalesce(trim(v_fila->>'segundo_apellido'), ''), 80),
          v_edad, v_tipo_doc, v_documento, v_norm, v_sexo,
          left(coalesce(trim(v_fila->>'telefono'), ''), 40),
          coalesce((v_fila->>'embarazada')::boolean, false) and v_sexo = 'F',
          coalesce((v_fila->>'discapacidad')::boolean, false),
          left(coalesce(trim(v_fila->>'discapacidad_detalle'), ''), 200),
          coalesce((v_fila->>'enfermedad')::boolean, false),
          left(coalesce(trim(v_fila->>'enfermedad_detalle'), ''), 200),
          left(coalesce(nullif(trim(v_fila->>'pais'), ''), 'Venezuela'), 80),
          left(coalesce(trim(v_fila->>'estado_federativo'), ''), 80),
          left(coalesce(trim(v_fila->>'municipio'), ''), 120),
          left(coalesce(trim(v_fila->>'parroquia'), ''), 120),
          left(coalesce(trim(v_fila->>'calle'), ''), 200),
          left(coalesce(trim(v_fila->>'casa_edificio'), ''), 120),
          'import_excel', v_fuente, now(), v_nombre_raw, v_match,
          v_registro_policial, v_solicitado, v_firmo_contra_presidente, v_deportado,
          v_tipo_registro_policial, v_observaciones_seguridad, now()
        )
        returning id into v_id;
        v_insertados := v_insertados + 1;
      end if;
    exception when others then
      v_omitidos := v_omitidos + 1;
      v_errores := v_errores || jsonb_build_array(jsonb_build_object(
        'fila', v_idx,
        'error', SQLERRM,
        'documento', v_fila->>'documento'
      ));
    end;
  end loop;

  return jsonb_build_object(
    'insertados', v_insertados,
    'actualizados', v_actualizados,
    'omitidos', v_omitidos,
    'fuente_archivo', v_fuente,
    'errores', v_errores
  );
end;
$$;

revoke all on function public.censo_importar_lote(jsonb, jsonb) from public, anon;
grant execute on function public.censo_importar_lote(jsonb, jsonb) to authenticated;

-- ============================================================================
-- 3) Resumen: contar import_excel (y legacy)
-- ============================================================================
drop function if exists public.censo_resumen_red();

create or replace function public.censo_resumen_red()
returns table (
  centro_id text,
  centro_nombre text,
  total_registrados bigint,
  ultimo_registro_en timestamptz,
  cierre_en timestamptz,
  cierre_total int,
  cierre_funcionario text,
  hombres bigint,
  mujeres bigint,
  otros_sexo bigint,
  recien_nacidos_h bigint,
  recien_nacidos_m bigint,
  ninos bigint,
  ninas bigint,
  adolescentes_h bigint,
  adolescentes_m bigint,
  adultos_h bigint,
  adultos_m bigint,
  adultos_mayores_h bigint,
  adultos_mayores_m bigint,
  embarazadas bigint,
  discapacidad bigint,
  discapacidad_h bigint,
  discapacidad_m bigint,
  enfermedad bigint,
  vivienda_destruida bigint,
  vivienda_inhabitable bigint,
  vivienda_no_posee bigint,
  sin_condicion_vivienda bigint,
  parte_total int,
  parte_familias int,
  parte_dia date,
  sin_cedula bigint,
  importados_planilla bigint,
  sin_edad bigint,
  solicitados bigint,
  con_registro_policial bigint,
  firmo_contra_presidente bigint
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
    c.id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id),
    coalesce(agg.total_registrados, 0::bigint),
    agg.ultimo_registro_en,
    ci.creado_en,
    ci.total_registrados,
    ci.funcionario_nombre,
    coalesce(agg.hombres, 0::bigint),
    coalesce(agg.mujeres, 0::bigint),
    coalesce(agg.otros_sexo, 0::bigint),
    coalesce(agg.recien_nacidos_h, 0::bigint),
    coalesce(agg.recien_nacidos_m, 0::bigint),
    coalesce(agg.ninos, 0::bigint),
    coalesce(agg.ninas, 0::bigint),
    coalesce(agg.adolescentes_h, 0::bigint),
    coalesce(agg.adolescentes_m, 0::bigint),
    coalesce(agg.adultos_h, 0::bigint),
    coalesce(agg.adultos_m, 0::bigint),
    coalesce(agg.adultos_mayores_h, 0::bigint),
    coalesce(agg.adultos_mayores_m, 0::bigint),
    coalesce(agg.embarazadas, 0::bigint),
    coalesce(agg.discapacidad, 0::bigint),
    coalesce(agg.discapacidad_h, 0::bigint),
    coalesce(agg.discapacidad_m, 0::bigint),
    coalesce(agg.enfermedad, 0::bigint),
    coalesce(agg.vivienda_destruida, 0::bigint),
    coalesce(agg.vivienda_inhabitable, 0::bigint),
    coalesce(agg.vivienda_no_posee, 0::bigint),
    coalesce(agg.sin_condicion_vivienda, 0::bigint),
    parte.total_afectados,
    parte.familias,
    parte.dia,
    coalesce(agg.sin_cedula, 0::bigint),
    coalesce(agg.importados_planilla, 0::bigint),
    coalesce(agg.sin_edad, 0::bigint),
    coalesce(agg.solicitados, 0::bigint),
    coalesce(agg.con_registro_policial, 0::bigint),
    coalesce(agg.firmo_contra_presidente, 0::bigint)
  from public.centros c
  left join lateral (
    select
      count(*)::bigint as total_registrados,
      max(r.creado_en) as ultimo_registro_en,
      count(*) filter (where r.sexo = 'M')::bigint as hombres,
      count(*) filter (where r.sexo = 'F')::bigint as mujeres,
      count(*) filter (where r.sexo is distinct from 'M' and r.sexo is distinct from 'F')::bigint as otros_sexo,
      count(*) filter (where r.edad is not null and r.edad <= 2 and r.sexo = 'M')::bigint as recien_nacidos_h,
      count(*) filter (where r.edad is not null and r.edad <= 2 and r.sexo = 'F')::bigint as recien_nacidos_m,
      count(*) filter (where r.edad between 3 and 11 and r.sexo = 'M')::bigint as ninos,
      count(*) filter (where r.edad between 3 and 11 and r.sexo = 'F')::bigint as ninas,
      count(*) filter (where r.edad between 12 and 17 and r.sexo = 'M')::bigint as adolescentes_h,
      count(*) filter (where r.edad between 12 and 17 and r.sexo = 'F')::bigint as adolescentes_m,
      count(*) filter (where r.edad between 18 and 59 and r.sexo = 'M')::bigint as adultos_h,
      count(*) filter (where r.edad between 18 and 59 and r.sexo = 'F')::bigint as adultos_m,
      count(*) filter (where r.edad >= 60 and r.sexo = 'M')::bigint as adultos_mayores_h,
      count(*) filter (where r.edad >= 60 and r.sexo = 'F')::bigint as adultos_mayores_m,
      count(*) filter (where r.embarazada)::bigint as embarazadas,
      count(*) filter (where r.discapacidad)::bigint as discapacidad,
      count(*) filter (where r.discapacidad and r.sexo = 'M')::bigint as discapacidad_h,
      count(*) filter (where r.discapacidad and r.sexo = 'F')::bigint as discapacidad_m,
      count(*) filter (where r.enfermedad)::bigint as enfermedad,
      count(*) filter (where r.condicion_vivienda = 'destruida')::bigint as vivienda_destruida,
      count(*) filter (where r.condicion_vivienda = 'inhabitable')::bigint as vivienda_inhabitable,
      count(*) filter (where r.condicion_vivienda = 'no_posee')::bigint as vivienda_no_posee,
      count(*) filter (where coalesce(r.condicion_vivienda, '') = '')::bigint as sin_condicion_vivienda,
      count(*) filter (where coalesce(r.documento_norm, '') = '')::bigint as sin_cedula,
      count(*) filter (
        where r.origen = 'import_excel'
           or r.funcionario_nombre = 'Importación planilla'
      )::bigint as importados_planilla,
      count(*) filter (where r.edad is null)::bigint as sin_edad,
      count(*) filter (where r.solicitado)::bigint as solicitados,
      count(*) filter (where r.registro_policial)::bigint as con_registro_policial,
      count(*) filter (where r.firmo_contra_presidente)::bigint as firmo_contra_presidente
    from public.censo_registros r
    where r.centro_id = c.id
  ) agg on true
  left join lateral (
    select cc.creado_en, cc.total_registrados, cc.funcionario_nombre
    from public.censo_cierres cc
    where cc.centro_id = c.id
    order by cc.creado_en desc
    limit 1
  ) ci on true
  left join lateral (
    select o.total_afectados, o.familias, o.dia
    from public.ocupaciones_centros o
    where o.centro_id = c.id
    order by o.dia desc, o.updated_at desc
    limit 1
  ) parte on true
  where not c.deleted
    and (
      v_rol <> 'supervisor'
      or c.id = any (v_centros)
    )
  order by 2;
end;
$$;

revoke all on function public.censo_resumen_red() from public, anon;
grant execute on function public.censo_resumen_red() to authenticated;

-- ============================================================================
-- 4) Listados: exponer metadatos de import
-- ============================================================================
drop function if exists public.censo_listado_red_conteo(text, text, text);
drop function if exists public.censo_listado_red_conteo(text, text, text, boolean, boolean);
drop function if exists public.censo_listado_red_conteo(text, text, text, boolean, boolean, boolean);
drop function if exists public.censo_listado_red_paginado(int, int, text, text, text, text);
drop function if exists public.censo_listado_red_paginado(int, int, text, text, text, text, boolean, boolean);
drop function if exists public.censo_listado_red_paginado(int, int, text, text, text, text, boolean, boolean, boolean);
drop function if exists public.censo_listado_red();

create function public.censo_listado_red_conteo(
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

create function public.censo_listado_red_paginado(
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
  verificacion_seguridad_en timestamptz
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
    r.verificacion_seguridad_en
  from public.censo_registros r
  inner join public.centros c on c.id = r.centro_id and not c.deleted
  where
    (p_centro_id is null or p_centro_id = '' or p_centro_id = 'todos' or r.centro_id = p_centro_id)
    and (v_rol <> 'supervisor' or r.centro_id = any (v_centros))
    and (p_sexo is null or p_sexo = '' or p_sexo = 'todos' or r.sexo = p_sexo)
    and (p_solicitado is null or r.solicitado = p_solicitado)
    and (p_registro_policial is null or r.registro_policial = p_registro_policial)
    and (p_firmo is null or r.firmo_contra_presidente = p_firmo)
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

create function public.censo_listado_red()
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
  verificacion_seguridad_en timestamptz
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
    r.verificacion_seguridad_en
  from public.censo_registros r
  inner join public.centros c on c.id = r.centro_id and not c.deleted
  where v_rol <> 'supervisor' or r.centro_id = any (v_centros)
  order by r.creado_en desc;
end;
$$;

revoke all on function public.censo_listado_red_paginado(int, int, text, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.censo_listado_red_paginado(int, int, text, text, text, text, boolean, boolean, boolean) to authenticated;

revoke all on function public.censo_listado_red() from public, anon;
grant execute on function public.censo_listado_red() to authenticated;

revoke all on function public.censo_listado_red_conteo(text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.censo_listado_red_conteo(text, text, text, boolean, boolean, boolean) to authenticated;
