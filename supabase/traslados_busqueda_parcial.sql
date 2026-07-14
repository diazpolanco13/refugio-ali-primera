-- Búsqueda escalable para traslados + traslado parcial por lista de alojamientos.
-- Proyecto: xzwifkckkakldnzkdeby
--
-- Gotcha: CREATE OR REPLACE resetea EXECUTE a PUBLIC → revoke/grant al final.

-- ============================================================================
-- 1) Índice trigram para búsqueda por nombre (20k+ filas)
-- ============================================================================
create extension if not exists pg_trgm;

create index if not exists refugiados_nombre_busqueda_trgm_idx
  on public.refugiados
  using gin (
    lower(
      concat_ws(
        ' ',
        coalesce(primer_apellido, ''),
        coalesce(segundo_apellido, ''),
        coalesce(primer_nombre, ''),
        coalesce(segundo_nombre, ''),
        coalesce(nombres, ''),
        coalesce(apellidos, '')
      )
    ) gin_trgm_ops
  );

-- ============================================================================
-- 2) Helpers de alcance lectura (traslados)
-- ============================================================================
create or replace function public.puede_leer_centro_traslado(p_centro_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol();
  v_centros text[] := public.mis_centros();
begin
  if v_rol is null then
    return false;
  end if;
  if v_rol in ('admin', 'analista_sae', 'autoridad') then
    return true;
  end if;
  if v_rol = 'supervisor' then
    return p_centro_id = any (v_centros);
  end if;
  return false;
end;
$$;

revoke all on function public.puede_leer_centro_traslado(text)
  from public, anon, authenticated;

-- ============================================================================
-- 3) JSON de hogar trasladable (interno + RPC pública)
-- ============================================================================
create or replace function public.obtener_hogar_trasladable(
  p_alojamiento_id uuid,
  p_referencia_alojamiento_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_aloj public.alojamientos_refugiados%rowtype;
  v_centro_nombre text;
  v_fam public.familias_centro%rowtype;
  v_miembros jsonb := '[]'::jsonb;
  v_nombre_hogar text;
  v_clave text;
  v_ref uuid;
begin
  if public.mi_rol() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_aloj
  from public.alojamientos_refugiados a
  where a.id = p_alojamiento_id
    and a.estado in ('activo', 'observacion');

  if not found then
    return null;
  end if;

  if not public.puede_leer_centro_traslado(v_aloj.centro_id) then
    raise exception 'Sin permiso para consultar este campamento';
  end if;

  v_ref := coalesce(p_referencia_alojamiento_id, p_alojamiento_id);

  select coalesce(nullif(btrim(c.data->>'nombre'), ''), c.id)
  into v_centro_nombre
  from public.centros c
  where c.id = v_aloj.centro_id;

  if v_aloj.familia_id is not null then
    select * into v_fam
    from public.familias_centro f
    where f.id = v_aloj.familia_id;

    v_clave := 'fam:' || v_aloj.familia_id::text;
    v_nombre_hogar := coalesce(nullif(btrim(v_fam.nombre), ''), 'Familia sin nombre');

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'alojamiento_id', a.id,
        'refugiado_id', a.refugiado_id,
        'nombre', coalesce(
          nullif(btrim(concat_ws(' ',
            r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido
          )), ''),
          nullif(btrim(concat_ws(' ', r.nombres, r.apellidos)), ''),
          'Sin nombre'
        ),
        'cedula', r.cedula,
        'tipo_doc', r.tipo_doc,
        'es_jefe_familia', a.es_jefe_familia,
        'parentesco_jefe', coalesce(a.parentesco_jefe, ''),
        'estado', a.estado,
        'fecha_nacimiento', r.fecha_nacimiento,
        'sexo', r.sexo
      )
      order by a.es_jefe_familia desc, a.fecha_ingreso
    ), '[]'::jsonb)
    into v_miembros
    from public.alojamientos_refugiados a
    inner join public.refugiados r on r.id = a.refugiado_id
    where a.familia_id = v_aloj.familia_id
      and a.centro_id = v_aloj.centro_id
      and a.estado in ('activo', 'observacion');
  else
    v_clave := 'solo:' || v_aloj.id::text;
    select coalesce(
      nullif(btrim(concat_ws(' ',
        r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido
      )), ''),
      nullif(btrim(concat_ws(' ', r.nombres, r.apellidos)), ''),
      'Persona sin hogar'
    )
    into v_nombre_hogar
    from public.refugiados r
    where r.id = v_aloj.refugiado_id;

    select jsonb_build_array(
      jsonb_build_object(
        'alojamiento_id', a.id,
        'refugiado_id', a.refugiado_id,
        'nombre', coalesce(
          nullif(btrim(concat_ws(' ',
            r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido
          )), ''),
          nullif(btrim(concat_ws(' ', r.nombres, r.apellidos)), ''),
          'Sin nombre'
        ),
        'cedula', r.cedula,
        'tipo_doc', r.tipo_doc,
        'es_jefe_familia', a.es_jefe_familia,
        'parentesco_jefe', coalesce(a.parentesco_jefe, ''),
        'estado', a.estado,
        'fecha_nacimiento', r.fecha_nacimiento,
        'sexo', r.sexo
      )
    )
    into v_miembros
    from public.alojamientos_refugiados a
    inner join public.refugiados r on r.id = a.refugiado_id
    where a.id = v_aloj.id;
  end if;

  return jsonb_build_object(
    'clave', v_clave,
    'familia_id', v_aloj.familia_id,
    'alojamiento_id', case when v_aloj.familia_id is null then v_aloj.id else null end,
    'centro_id', v_aloj.centro_id,
    'centro_nombre', v_centro_nombre,
    'nombre_hogar', v_nombre_hogar,
    'referencia_alojamiento_id', v_ref,
    'miembros', v_miembros
  );
end;
$$;

revoke all on function public.obtener_hogar_trasladable(uuid, uuid)
  from public, anon;
grant execute on function public.obtener_hogar_trasladable(uuid, uuid)
  to authenticated;

-- ============================================================================
-- 4) Búsqueda por cédula exacta
-- ============================================================================
create or replace function public.buscar_trasladable_por_cedula(
  p_cedula text,
  p_tipo_doc text default 'V'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_norm text;
  v_aloj_id uuid;
  v_tipo text := upper(coalesce(nullif(btrim(p_tipo_doc), ''), 'V'));
begin
  if public.mi_rol() is null then
    raise exception 'No autenticado';
  end if;

  if v_tipo = 'P' then
    v_norm := upper(regexp_replace(coalesce(p_cedula, ''), '[^A-Z0-9]', '', 'g'));
  else
    v_norm := v_digits;
  end if;

  if v_norm is null or v_norm = '' then
    return null;
  end if;

  select a.id into v_aloj_id
  from public.refugiados r
  inner join public.alojamientos_refugiados a
    on a.refugiado_id = r.id
   and a.estado in ('activo', 'observacion')
  where r.cedula_norm = v_norm
    and (v_tipo = 'P' or coalesce(r.tipo_doc, 'V') = v_tipo)
    and public.puede_leer_centro_traslado(a.centro_id)
  order by a.fecha_ingreso desc nulls last
  limit 1;

  if v_aloj_id is null then
    return null;
  end if;

  return public.obtener_hogar_trasladable(v_aloj_id, v_aloj_id);
end;
$$;

revoke all on function public.buscar_trasladable_por_cedula(text, text)
  from public, anon;
grant execute on function public.buscar_trasladable_por_cedula(text, text)
  to authenticated;

-- ============================================================================
-- 5) Búsqueda por nombre + filtros (máx. 20)
-- ============================================================================
create or replace function public.buscar_trasladables_por_nombre(
  p_nombres text default null,
  p_apellidos text default null,
  p_sexo text default null,
  p_edad_min int default null,
  p_edad_max int default null,
  p_limite int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_nombres text := nullif(btrim(coalesce(p_nombres, '')), '');
  v_apellidos text := nullif(btrim(coalesce(p_apellidos, '')), '');
  v_sexo text := nullif(btrim(coalesce(p_sexo, '')), '');
  v_limite int := least(greatest(coalesce(p_limite, 20), 1), 20);
  v_hoy date := (timezone('America/Caracas', now()))::date;
  v_resultados jsonb := '[]'::jsonb;
begin
  if public.mi_rol() is null then
    raise exception 'No autenticado';
  end if;

  if (v_nombres is null or length(v_nombres) < 2)
     and (v_apellidos is null or length(v_apellidos) < 2) then
    raise exception 'Indique al menos 2 caracteres en nombres o apellidos';
  end if;

  if v_sexo is null
     and p_edad_min is null
     and p_edad_max is null then
    raise exception 'Indique sexo o rango de edad para acotar la búsqueda';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.nombre), '[]'::jsonb)
  into v_resultados
  from (
    select
      a.id as alojamiento_id,
      r.id as refugiado_id,
      coalesce(
        nullif(btrim(concat_ws(' ',
          r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido
        )), ''),
        nullif(btrim(concat_ws(' ', r.nombres, r.apellidos)), ''),
        'Sin nombre'
      ) as nombre,
      r.cedula,
      r.tipo_doc,
      r.sexo,
      case
        when r.fecha_nacimiento is null then null
        else extract(year from age(v_hoy, r.fecha_nacimiento))::int
      end as edad,
      a.centro_id,
      coalesce(nullif(btrim(c.data->>'nombre'), ''), c.id) as centro_nombre
    from public.alojamientos_refugiados a
    inner join public.refugiados r on r.id = a.refugiado_id
    inner join public.centros c on c.id = a.centro_id and not c.deleted
    where a.estado in ('activo', 'observacion')
      and public.puede_leer_centro_traslado(a.centro_id)
      and (v_sexo is null or r.sexo = v_sexo)
      and (
        p_edad_min is null
        or r.fecha_nacimiento is null
        or extract(year from age(v_hoy, r.fecha_nacimiento))::int >= p_edad_min
      )
      and (
        p_edad_max is null
        or r.fecha_nacimiento is null
        or extract(year from age(v_hoy, r.fecha_nacimiento))::int <= p_edad_max
      )
      and (
        (v_nombres is not null and (
          r.primer_nombre ilike '%' || v_nombres || '%'
          or r.segundo_nombre ilike '%' || v_nombres || '%'
          or r.nombres ilike '%' || v_nombres || '%'
        ))
        or (v_apellidos is not null and (
          r.primer_apellido ilike '%' || v_apellidos || '%'
          or r.segundo_apellido ilike '%' || v_apellidos || '%'
          or r.apellidos ilike '%' || v_apellidos || '%'
        ))
      )
    order by nombre
    limit v_limite
  ) x;

  return jsonb_build_object('resultados', v_resultados);
end;
$$;

revoke all on function public.buscar_trasladables_por_nombre(text, text, text, int, int, int)
  from public, anon;
grant execute on function public.buscar_trasladables_por_nombre(text, text, text, int, int, int)
  to authenticated;

-- ============================================================================
-- 6) RPC traslado — ampliada con lista parcial de alojamientos
-- ============================================================================
drop function if exists public.trasladar_entre_centros(text, text, text, uuid, uuid, date);

create or replace function public.trasladar_entre_centros(
  p_centro_origen text,
  p_centro_destino text,
  p_motivo text,
  p_alojamiento_ids uuid[] default null,
  p_jefe_alojamiento_id uuid default null,
  p_familia_id uuid default null,
  p_alojamiento_id uuid default null,
  p_fecha date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol();
  v_user text := coalesce(public.mi_username(), v_rol, 'sistema');
  v_ahora bigint := (extract(epoch from now()) * 1000)::bigint;
  v_fecha date := coalesce(p_fecha, (timezone('America/Caracas', now()))::date);
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_destino_label text;
  v_fam_origen public.familias_centro%rowtype;
  v_fam_destino_id uuid;
  v_aloj record;
  v_nuevo_aloj_id uuid;
  v_miembros jsonb := '[]'::jsonb;
  v_count int := 0;
  v_traslado_id uuid;
  v_res public.residencias_afectadas%rowtype;
  v_ids uuid[];
  v_familia_origen uuid;
  v_jefe_aloj_id uuid;
  v_familia_origen_traslado uuid;
  v_hoy date := (timezone('America/Caracas', now()))::date;
begin
  if v_rol is null then
    raise exception 'No autenticado';
  end if;

  if p_centro_origen is null or p_centro_destino is null then
    raise exception 'Origen y destino son obligatorios';
  end if;

  if p_centro_origen = p_centro_destino then
    raise exception 'El campamento destino debe ser distinto del origen';
  end if;

  if v_motivo is null then
    raise exception 'El motivo del traslado es obligatorio';
  end if;

  if not public.puede_escribir_ambos_centros(p_centro_origen, p_centro_destino) then
    raise exception 'Sin permiso de escritura en ambos campamentos (origen y destino)';
  end if;

  select coalesce(nullif(btrim(c.data->>'nombre'), ''), c.id)
  into v_destino_label
  from public.centros c
  where c.id = p_centro_destino;
  if v_destino_label is null then
    raise exception 'Campamento destino no encontrado: %', p_centro_destino;
  end if;

  if not exists (select 1 from public.centros c where c.id = p_centro_origen) then
    raise exception 'Campamento origen no encontrado: %', p_centro_origen;
  end if;

  -- ---------- Caso parcial: lista de alojamientos ----------
  if p_alojamiento_ids is not null and cardinality(p_alojamiento_ids) > 0 then
    v_ids := (select array_agg(distinct x) from unnest(p_alojamiento_ids) x);

    if cardinality(v_ids) = 0 then
      raise exception 'Indique al menos un miembro a trasladar';
    end if;

    perform 1
    from public.alojamientos_refugiados a
    where a.id = any (v_ids)
    for update;

    select count(*) into v_count
    from public.alojamientos_refugiados a
    where a.id = any (v_ids)
      and a.centro_id = p_centro_origen
      and a.estado in ('activo', 'observacion');

    if v_count <> cardinality(v_ids) then
      raise exception 'Uno o más alojamientos no están activos en el campamento origen';
    end if;

    select count(distinct coalesce(a.familia_id::text, 'solo:' || a.id::text))
    into v_count
    from public.alojamientos_refugiados a
    where a.id = any (v_ids);

    if v_count <> 1 then
      raise exception 'Todos los miembros seleccionados deben pertenecer al mismo hogar';
    end if;

    select distinct a.familia_id into v_familia_origen
    from public.alojamientos_refugiados a
    where a.id = any (v_ids)
    limit 1;

    if exists (
      select 1
      from public.alojamientos_refugiados a
      where a.id = any (v_ids)
        and exists (
          select 1 from public.alojamientos_refugiados d
          where d.refugiado_id = a.refugiado_id
            and d.centro_id = p_centro_destino
            and d.estado in ('activo', 'observacion', 'transito')
        )
    ) then
      raise exception 'Uno o más miembros ya tienen plaza activa en el destino';
    end if;

    if v_familia_origen is not null then
      select * into v_fam_origen
      from public.familias_centro f
      where f.id = v_familia_origen
      for update;

      if not found then
        raise exception 'Familia no encontrada';
      end if;

      if v_fam_origen.centro_id is distinct from p_centro_origen then
        raise exception 'La familia no pertenece al campamento origen indicado';
      end if;

      insert into public.familias_centro (
        centro_id, nombre, notas,
        foto_familiar_url, consentimiento_foto_familiar,
        familiares_referencia, familiares_separados,
        miembros_damnificados_declarados, fallecidos_confirmados, desaparecidos,
        updated_at, updated_by
      ) values (
        p_centro_destino,
        v_fam_origen.nombre,
        v_fam_origen.notas,
        v_fam_origen.foto_familiar_url,
        v_fam_origen.consentimiento_foto_familiar,
        v_fam_origen.familiares_referencia,
        v_fam_origen.familiares_separados,
        v_fam_origen.miembros_damnificados_declarados,
        v_fam_origen.fallecidos_confirmados,
        v_fam_origen.desaparecidos,
        v_ahora,
        v_user
      )
      returning id into v_fam_destino_id;

      select * into v_res
      from public.residencias_afectadas r
      where r.familia_id = v_familia_origen;

      if found then
        insert into public.residencias_afectadas (
          familia_id, centro_id, pais,
          estado_federativo, municipio, parroquia, sector,
          direccion, referencia, estatus_vivienda, geom, fotos,
          observaciones, tipo_tenencia, perdio_todo, perdidas_materiales,
          updated_at, updated_by
        ) values (
          v_fam_destino_id, p_centro_destino, v_res.pais,
          v_res.estado_federativo, v_res.municipio, v_res.parroquia, v_res.sector,
          v_res.direccion, v_res.referencia, v_res.estatus_vivienda, v_res.geom, v_res.fotos,
          v_res.observaciones, v_res.tipo_tenencia, v_res.perdio_todo, v_res.perdidas_materiales,
          v_ahora, v_user
        );
      end if;
    end if;

    -- Determinar jefe en destino
    select a.id into v_jefe_aloj_id
    from public.alojamientos_refugiados a
    where a.id = any (v_ids)
      and a.es_jefe_familia
    limit 1;

    if v_jefe_aloj_id is null then
      if p_jefe_alojamiento_id is not null
         and p_jefe_alojamiento_id = any (v_ids) then
        v_jefe_aloj_id := p_jefe_alojamiento_id;
      else
        select a.id into v_jefe_aloj_id
        from public.alojamientos_refugiados a
        inner join public.refugiados r on r.id = a.refugiado_id
        where a.id = any (v_ids)
          and r.fecha_nacimiento is not null
          and extract(year from age(v_hoy, r.fecha_nacimiento))::int >= 18
        order by a.fecha_ingreso
        limit 1;

        if v_jefe_aloj_id is null then
          select a.id into v_jefe_aloj_id
          from public.alojamientos_refugiados a
          where a.id = any (v_ids)
          order by a.fecha_ingreso
          limit 1;
        end if;
      end if;
    end if;

    for v_aloj in
      select a.*, r.fecha_nacimiento
      from public.alojamientos_refugiados a
      inner join public.refugiados r on r.id = a.refugiado_id
      where a.id = any (v_ids)
      order by a.es_jefe_familia desc, a.fecha_ingreso
    loop
      if v_familia_origen is null then
        insert into public.familias_centro (
          centro_id, nombre, notas,
          updated_at, updated_by
        ) values (
          p_centro_destino,
          'Hogar individual',
          '',
          v_ahora,
          v_user
        )
        returning id into v_fam_destino_id;
      end if;

      update public.alojamientos_refugiados
      set
        estado = 'egresado',
        fecha_egreso = v_fecha,
        motivo_egreso = 'Traslado entre campamentos',
        destino_egreso = v_destino_label,
        updated_at = v_ahora,
        updated_by = v_user
      where id = v_aloj.id;

      insert into public.alojamientos_refugiados (
        refugiado_id, centro_id, familia_id,
        fecha_ingreso, fecha_egreso, estado,
        itinerante, es_jefe_familia, parentesco_jefe,
        tipo_alojamiento, plaza_modulo,
        motivo_egreso, destino_egreso,
        creada_ts, creada_por, updated_at, updated_by
      ) values (
        v_aloj.refugiado_id, p_centro_destino, v_fam_destino_id,
        v_fecha, null, 'activo',
        v_aloj.itinerante,
        (v_aloj.id = v_jefe_aloj_id),
        case when v_aloj.id = v_jefe_aloj_id then '' else v_aloj.parentesco_jefe end,
        coalesce(v_aloj.tipo_alojamiento, ''), coalesce(v_aloj.plaza_modulo, ''),
        '', '',
        v_ahora, v_user, v_ahora, v_user
      )
      returning id into v_nuevo_aloj_id;

      v_miembros := v_miembros || jsonb_build_array(jsonb_build_object(
        'refugiado_id', v_aloj.refugiado_id,
        'alojamiento_origen_id', v_aloj.id,
        'alojamiento_destino_id', v_nuevo_aloj_id,
        'es_jefe_familia', (v_aloj.id = v_jefe_aloj_id)
      ));
    end loop;

    v_familia_origen_traslado := v_familia_origen;

    insert into public.traslados (
      familia_id_origen, familia_id_destino,
      centro_origen, centro_destino,
      motivo, miembros, creada_ts, creada_por
    ) values (
      v_familia_origen_traslado, v_fam_destino_id,
      p_centro_origen, p_centro_destino,
      v_motivo, v_miembros, v_ahora, v_user
    )
    returning id into v_traslado_id;

    return jsonb_build_object(
      'traslado_id', v_traslado_id,
      'familia_id_destino', v_fam_destino_id,
      'miembros', v_miembros,
      'centro_origen', p_centro_origen,
      'centro_destino', p_centro_destino
    );
  end if;

  -- ---------- Legacy: familia completa o persona sola ----------
  if (p_familia_id is null and p_alojamiento_id is null)
     or (p_familia_id is not null and p_alojamiento_id is not null) then
    raise exception 'Indique alojamiento_ids, familia_id o alojamiento_id';
  end if;

  if p_familia_id is not null then
    select * into v_fam_origen
    from public.familias_centro f
    where f.id = p_familia_id
    for update;

    if not found then
      raise exception 'Familia no encontrada';
    end if;

    if v_fam_origen.centro_id is distinct from p_centro_origen then
      raise exception 'La familia no pertenece al campamento origen indicado';
    end if;

    perform 1
    from public.alojamientos_refugiados a
    where a.familia_id = p_familia_id
      and a.centro_id = p_centro_origen
      and a.estado in ('activo', 'observacion')
    for update;

    select count(*) into v_count
    from public.alojamientos_refugiados a
    where a.familia_id = p_familia_id
      and a.centro_id = p_centro_origen
      and a.estado in ('activo', 'observacion');

    if v_count = 0 then
      raise exception 'La familia no tiene miembros activos en el origen';
    end if;

    if exists (
      select 1
      from public.alojamientos_refugiados a
      where a.familia_id = p_familia_id
        and a.centro_id = p_centro_origen
        and a.estado in ('activo', 'observacion')
        and exists (
          select 1 from public.alojamientos_refugiados d
          where d.refugiado_id = a.refugiado_id
            and d.centro_id = p_centro_destino
            and d.estado in ('activo', 'observacion', 'transito')
        )
    ) then
      raise exception 'Uno o más miembros ya tienen plaza activa en el destino';
    end if;

    insert into public.familias_centro (
      centro_id, nombre, notas,
      foto_familiar_url, consentimiento_foto_familiar,
      familiares_referencia, familiares_separados,
      miembros_damnificados_declarados, fallecidos_confirmados, desaparecidos,
      updated_at, updated_by
    ) values (
      p_centro_destino,
      v_fam_origen.nombre,
      v_fam_origen.notas,
      v_fam_origen.foto_familiar_url,
      v_fam_origen.consentimiento_foto_familiar,
      v_fam_origen.familiares_referencia,
      v_fam_origen.familiares_separados,
      v_fam_origen.miembros_damnificados_declarados,
      v_fam_origen.fallecidos_confirmados,
      v_fam_origen.desaparecidos,
      v_ahora,
      v_user
    )
    returning id into v_fam_destino_id;

    for v_aloj in
      select *
      from public.alojamientos_refugiados a
      where a.familia_id = p_familia_id
        and a.centro_id = p_centro_origen
        and a.estado in ('activo', 'observacion')
      order by a.es_jefe_familia desc, a.fecha_ingreso
    loop
      update public.alojamientos_refugiados
      set
        estado = 'egresado',
        fecha_egreso = v_fecha,
        motivo_egreso = 'Traslado entre campamentos',
        destino_egreso = v_destino_label,
        updated_at = v_ahora,
        updated_by = v_user
      where id = v_aloj.id;

      insert into public.alojamientos_refugiados (
        refugiado_id, centro_id, familia_id,
        fecha_ingreso, fecha_egreso, estado,
        itinerante, es_jefe_familia, parentesco_jefe,
        tipo_alojamiento, plaza_modulo,
        motivo_egreso, destino_egreso,
        creada_ts, creada_por, updated_at, updated_by
      ) values (
        v_aloj.refugiado_id, p_centro_destino, v_fam_destino_id,
        v_fecha, null, 'activo',
        v_aloj.itinerante, v_aloj.es_jefe_familia, v_aloj.parentesco_jefe,
        coalesce(v_aloj.tipo_alojamiento, ''), coalesce(v_aloj.plaza_modulo, ''),
        '', '',
        v_ahora, v_user, v_ahora, v_user
      )
      returning id into v_nuevo_aloj_id;

      v_miembros := v_miembros || jsonb_build_array(jsonb_build_object(
        'refugiado_id', v_aloj.refugiado_id,
        'alojamiento_origen_id', v_aloj.id,
        'alojamiento_destino_id', v_nuevo_aloj_id,
        'es_jefe_familia', v_aloj.es_jefe_familia
      ));
    end loop;

    select * into v_res
    from public.residencias_afectadas r
    where r.familia_id = p_familia_id;

    if found then
      insert into public.residencias_afectadas (
        familia_id, centro_id, pais,
        estado_federativo, municipio, parroquia, sector,
        direccion, referencia, estatus_vivienda, geom, fotos,
        observaciones, tipo_tenencia, perdio_todo, perdidas_materiales,
        updated_at, updated_by
      ) values (
        v_fam_destino_id, p_centro_destino, v_res.pais,
        v_res.estado_federativo, v_res.municipio, v_res.parroquia, v_res.sector,
        v_res.direccion, v_res.referencia, v_res.estatus_vivienda, v_res.geom, v_res.fotos,
        v_res.observaciones, v_res.tipo_tenencia, v_res.perdio_todo, v_res.perdidas_materiales,
        v_ahora, v_user
      );
    end if;

    v_familia_origen_traslado := p_familia_id;
  else
    select * into v_aloj
    from public.alojamientos_refugiados a
    where a.id = p_alojamiento_id
    for update;

    if not found then
      raise exception 'Alojamiento no encontrado';
    end if;

    if v_aloj.centro_id is distinct from p_centro_origen then
      raise exception 'El alojamiento no pertenece al campamento origen indicado';
    end if;

    if v_aloj.familia_id is not null then
      raise exception 'Este alojamiento pertenece a una familia; use alojamiento_ids';
    end if;

    if v_aloj.estado not in ('activo', 'observacion') then
      raise exception 'El alojamiento no está activo';
    end if;

    if exists (
      select 1 from public.alojamientos_refugiados d
      where d.refugiado_id = v_aloj.refugiado_id
        and d.centro_id = p_centro_destino
        and d.estado in ('activo', 'observacion', 'transito')
    ) then
      raise exception 'La persona ya tiene plaza activa en el destino';
    end if;

    insert into public.familias_centro (
      centro_id, nombre, notas,
      updated_at, updated_by
    ) values (
      p_centro_destino,
      'Hogar individual',
      '',
      v_ahora,
      v_user
    )
    returning id into v_fam_destino_id;

    update public.alojamientos_refugiados
    set
      estado = 'egresado',
      fecha_egreso = v_fecha,
      motivo_egreso = 'Traslado entre campamentos',
      destino_egreso = v_destino_label,
      updated_at = v_ahora,
      updated_by = v_user
    where id = v_aloj.id;

    insert into public.alojamientos_refugiados (
      refugiado_id, centro_id, familia_id,
      fecha_ingreso, fecha_egreso, estado,
      itinerante, es_jefe_familia, parentesco_jefe,
      tipo_alojamiento, plaza_modulo,
      motivo_egreso, destino_egreso,
      creada_ts, creada_por, updated_at, updated_by
    ) values (
      v_aloj.refugiado_id, p_centro_destino, v_fam_destino_id,
      v_fecha, null, 'activo',
      v_aloj.itinerante, true, '',
      coalesce(v_aloj.tipo_alojamiento, ''), coalesce(v_aloj.plaza_modulo, ''),
      '', '',
      v_ahora, v_user, v_ahora, v_user
    )
    returning id into v_nuevo_aloj_id;

    v_miembros := jsonb_build_array(jsonb_build_object(
      'refugiado_id', v_aloj.refugiado_id,
      'alojamiento_origen_id', v_aloj.id,
      'alojamiento_destino_id', v_nuevo_aloj_id,
      'es_jefe_familia', true
    ));

    v_familia_origen_traslado := null;
  end if;

  insert into public.traslados (
    familia_id_origen, familia_id_destino,
    centro_origen, centro_destino,
    motivo, miembros, creada_ts, creada_por
  ) values (
    v_familia_origen_traslado, v_fam_destino_id,
    p_centro_origen, p_centro_destino,
    v_motivo, v_miembros, v_ahora, v_user
  )
  returning id into v_traslado_id;

  return jsonb_build_object(
    'traslado_id', v_traslado_id,
    'familia_id_destino', v_fam_destino_id,
    'miembros', v_miembros,
    'centro_origen', p_centro_origen,
    'centro_destino', p_centro_destino
  );
end;
$$;

revoke all on function public.trasladar_entre_centros(
  text, text, text, uuid[], uuid, uuid, uuid, date
) from public, anon;
grant execute on function public.trasladar_entre_centros(
  text, text, text, uuid[], uuid, uuid, uuid, date
) to authenticated;
