-- =============================================================================
-- Traslado nominal entre campamentos desde el censo por cédula (20-jul-2026) —
-- REFERENCIA de la migración aplicada: `traslado_nominal_censo`.
--
-- Cuando el censo por cédula detecta que la persona ya figura activa en OTRO
-- campamento, además de reportar por Telegram el censista puede trasladarla
-- directamente al campamento donde está censando:
--
--   * modo 'persona': cierra (egresa con motivo/destino de traslado) todos sus
--     alojamientos activos fuera del campamento destino. El flujo del censo
--     continúa normal y crea el alojamiento nuevo aquí — sin duplicados.
--   * modo 'familia': además crea una copia de la familia en el destino
--     (nombre, referencia/pérdidas, damnificación, residencia afectada) y
--     mueve a TODOS los miembros activos (egresa el alojamiento viejo + crea
--     el nuevo, conservando jefe/parentesco/seguimiento; la plaza/módulo se
--     resetea porque es física del campamento viejo).
--
-- SECURITY DEFINER a propósito (mismo porqué que `estado_nominal_cedula`):
-- la RLS de `alojamientos_refugiados` le oculta al operador el centro viejo,
-- así que el cierre debe hacerse del lado del servidor. Alcance mínimo:
-- chequeo de rol + el destino debe ser un campamento donde la sesión puede
-- censar (mis_centros() / es_analista_total()). Todo queda en `historial`
-- (accion 'traslado_nominal').
--
-- También se amplía `estado_nominal_cedula`: cada "otro centro" ahora expone
-- `familia_id` y `miembros_activos` para que la UI pueda ofrecer "trasladar a
-- toda la familia (N miembros)". Claves extra en el jsonb = compatible con el
-- frontend viejo.
--
-- ⚠️ Al recrear funciones, Postgres re-otorga EXECUTE a PUBLIC: repetir los
-- revoke/grant (patrón del repo) y reverificar con has_function_privilege.
-- =============================================================================

create or replace function public.estado_nominal_cedula(p_cedula_norm text, p_centro_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rid uuid;
  v_es_jefe boolean;
  v_familia uuid;
  v_en_este boolean := false;
  v_otros jsonb;
begin
  if p_cedula_norm is null or p_cedula_norm = '' then
    return jsonb_build_object('registrado', false, 'refugiado_id', null, 'en_este_centro', false,
      'es_jefe_aqui', false, 'familia_aqui', null, 'otros_centros', '[]'::jsonb);
  end if;

  select id into v_rid from public.refugiados where cedula_norm = p_cedula_norm;
  if v_rid is null then
    return jsonb_build_object('registrado', false, 'refugiado_id', null, 'en_este_centro', false,
      'es_jefe_aqui', false, 'familia_aqui', null, 'otros_centros', '[]'::jsonb);
  end if;

  select a.es_jefe_familia, a.familia_id
  into v_es_jefe, v_familia
  from public.alojamientos_refugiados a
  where a.refugiado_id = v_rid and a.centro_id = p_centro_id and a.estado <> 'egresado'
  order by a.creada_ts desc nulls last
  limit 1;
  v_en_este := found;

  select coalesce(jsonb_agg(jsonb_build_object(
      'centro_id', a.centro_id,
      'fecha_ingreso', a.fecha_ingreso,
      'creada_ts', a.creada_ts,
      'es_jefe', a.es_jefe_familia,
      'registrado_por', a.creada_por,
      'familia_id', a.familia_id,
      'miembros_activos', case
        when a.familia_id is null then 1
        else (
          select count(*) from public.alojamientos_refugiados m
          where m.familia_id = a.familia_id and m.estado <> 'egresado'
        )
      end
    ) order by a.creada_ts desc nulls last), '[]'::jsonb)
  into v_otros
  from public.alojamientos_refugiados a
  where a.refugiado_id = v_rid and a.estado <> 'egresado' and a.centro_id <> p_centro_id;

  return jsonb_build_object(
    'registrado', true,
    'refugiado_id', v_rid,
    'en_este_centro', v_en_este,
    'es_jefe_aqui', coalesce(v_es_jefe, false),
    'familia_aqui', v_familia,
    'otros_centros', v_otros
  );
end;
$$;

create or replace function public.trasladar_nominal_a_centro(
  p_cedula_norm text,
  p_centro_id text,
  p_modo text default 'persona'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rol text;
  v_user text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_modo text := p_modo;
  v_rid uuid;
  v_familia_origen uuid;
  v_familia_nueva uuid := null;
  v_centros_origen text[];
  v_movidos int := 0;
  v_a record;
  v_ya_activo uuid;
begin
  select rol, username into v_rol, v_user from public.perfiles where user_id = auth.uid();
  if v_rol is null or v_rol not in ('admin','analista_sae','supervisor','operador') then
    raise exception 'No autorizado para trasladar refugiados';
  end if;
  if v_user is null then
    v_user := auth.uid()::text;
  end if;

  -- El destino debe ser un campamento donde esta sesión puede censar.
  if not (
    v_rol = 'admin'
    or (v_rol = 'analista_sae' and (public.es_analista_total() or p_centro_id = any(public.mis_centros())))
    or (v_rol in ('supervisor','operador') and p_centro_id = any(public.mis_centros()))
  ) then
    raise exception 'No autorizado para trasladar hacia ese campamento';
  end if;

  if v_modo not in ('persona','familia') then
    raise exception 'Modo de traslado inválido: %', v_modo;
  end if;
  if coalesce(p_cedula_norm, '') = '' then
    raise exception 'Cédula requerida';
  end if;
  if not exists (select 1 from public.centros c where c.id = p_centro_id and c.deleted is not true) then
    raise exception 'Campamento destino inexistente';
  end if;

  select id into v_rid from public.refugiados where cedula_norm = p_cedula_norm;
  if v_rid is null then
    raise exception 'La cédula no está registrada en la base nominal';
  end if;

  -- Familia de origen: la del alojamiento activo más reciente fuera del destino.
  select a.familia_id into v_familia_origen
  from public.alojamientos_refugiados a
  where a.refugiado_id = v_rid and a.estado <> 'egresado' and a.centro_id <> p_centro_id
  order by a.creada_ts desc nulls last
  limit 1;
  if not found then
    -- Nada que trasladar: no hay alojamientos activos fuera del destino.
    return jsonb_build_object('modo', v_modo, 'movidos', 0, 'familia_id', null,
      'centros_origen', '[]'::jsonb);
  end if;
  if v_modo = 'familia' and v_familia_origen is null then
    v_modo := 'persona';
  end if;

  if v_modo = 'persona' then
    select array_agg(distinct a.centro_id) into v_centros_origen
    from public.alojamientos_refugiados a
    where a.refugiado_id = v_rid and a.estado <> 'egresado' and a.centro_id <> p_centro_id;

    update public.alojamientos_refugiados a set
      estado = 'egresado',
      fecha_egreso = v_hoy,
      motivo_egreso = 'Traslado a otro campamento',
      destino_egreso = p_centro_id,
      updated_at = v_now,
      updated_by = v_user
    where a.refugiado_id = v_rid and a.estado <> 'egresado' and a.centro_id <> p_centro_id;
    get diagnostics v_movidos = row_count;
    -- El alojamiento nuevo en el destino lo crea el flujo normal del censo.
  else
    select array_agg(distinct a.centro_id) into v_centros_origen
    from public.alojamientos_refugiados a
    where a.familia_id = v_familia_origen and a.estado <> 'egresado';

    insert into public.familias_centro (
      centro_id, nombre, notas, foto_familiar_url, consentimiento_foto_familiar,
      familiares_referencia, familiares_separados, miembros_damnificados_declarados,
      fallecidos_confirmados, desaparecidos, updated_at, updated_by
    )
    select p_centro_id, f.nombre, f.notas, f.foto_familiar_url, f.consentimiento_foto_familiar,
      f.familiares_referencia, f.familiares_separados, f.miembros_damnificados_declarados,
      f.fallecidos_confirmados, f.desaparecidos, v_now, v_user
    from public.familias_centro f
    where f.id = v_familia_origen
    returning id into v_familia_nueva;

    insert into public.residencias_afectadas (
      familia_id, centro_id, pais, estado_federativo, municipio, parroquia, sector,
      direccion, referencia, estatus_vivienda, geom, fotos, observaciones,
      tipo_tenencia, perdio_todo, perdidas_materiales, updated_at, updated_by
    )
    select v_familia_nueva, p_centro_id, r.pais, r.estado_federativo, r.municipio, r.parroquia,
      r.sector, r.direccion, r.referencia, r.estatus_vivienda, r.geom, r.fotos, r.observaciones,
      r.tipo_tenencia, r.perdio_todo, r.perdidas_materiales, v_now, v_user
    from public.residencias_afectadas r
    where r.familia_id = v_familia_origen;

    for v_a in
      select * from public.alojamientos_refugiados
      where familia_id = v_familia_origen and estado <> 'egresado'
    loop
      update public.alojamientos_refugiados set
        estado = 'egresado',
        fecha_egreso = v_hoy,
        motivo_egreso = 'Traslado de la familia a otro campamento',
        destino_egreso = p_centro_id,
        updated_at = v_now,
        updated_by = v_user
      where id = v_a.id;

      -- Si por alguna razón ya tiene alojamiento activo en el destino, solo se
      -- lo reasigna a la familia nueva (nunca dos alojamientos activos aquí).
      select id into v_ya_activo
      from public.alojamientos_refugiados
      where refugiado_id = v_a.refugiado_id and centro_id = p_centro_id and estado <> 'egresado'
      limit 1;
      if v_ya_activo is null then
        insert into public.alojamientos_refugiados (
          refugiado_id, centro_id, familia_id, fecha_ingreso, fecha_egreso, estado,
          itinerante, es_jefe_familia, parentesco_jefe, tipo_alojamiento,
          plaza_modulo, seguimiento, creada_ts, creada_por, updated_at, updated_by
        ) values (
          v_a.refugiado_id, p_centro_id, v_familia_nueva, v_hoy, null, 'activo',
          v_a.itinerante, v_a.es_jefe_familia, v_a.parentesco_jefe, v_a.tipo_alojamiento,
          '', v_a.seguimiento, v_now, v_user, v_now, v_user
        );
      else
        update public.alojamientos_refugiados
        set familia_id = v_familia_nueva, updated_at = v_now, updated_by = v_user
        where id = v_ya_activo;
      end if;
      v_movidos := v_movidos + 1;
    end loop;
  end if;

  insert into public.historial (ts, usuario, accion, entidad, entidad_id, detalle)
  values (v_now, v_user, 'traslado_nominal', 'refugiado', v_rid::text, jsonb_build_object(
    'modo', v_modo,
    'cedula_norm', p_cedula_norm,
    'destino', p_centro_id,
    'origen', to_jsonb(coalesce(v_centros_origen, '{}'::text[])),
    'movidos', v_movidos,
    'familia_destino', v_familia_nueva
  ));

  return jsonb_build_object(
    'modo', v_modo,
    'movidos', v_movidos,
    'familia_id', v_familia_nueva,
    'centros_origen', to_jsonb(coalesce(v_centros_origen, '{}'::text[]))
  );
end;
$$;

-- CREATE OR REPLACE re-otorga EXECUTE a PUBLIC: repetir los revoke/grant.
revoke all on function public.estado_nominal_cedula(text, text) from public, anon;
grant execute on function public.estado_nominal_cedula(text, text) to authenticated;
revoke all on function public.trasladar_nominal_a_centro(text, text, text) from public, anon;
grant execute on function public.trasladar_nominal_a_centro(text, text, text) to authenticated;
