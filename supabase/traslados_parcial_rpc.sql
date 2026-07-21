-- Traslado parcial por lista de alojamientos (RPC dedicada).
-- La función legacy trasladar_entre_centros se mantiene aparte.

create or replace function public.trasladar_miembros_entre_centros(
  p_centro_origen text,
  p_centro_destino text,
  p_motivo text,
  p_alojamiento_ids uuid[],
  p_jefe_alojamiento_id uuid default null,
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
  v_hoy date := (timezone('America/Caracas', now()))::date;
  v_miembro jsonb;
begin
  if v_rol is null then raise exception 'No autenticado'; end if;
  if not public.puede_trasladar_entre_centros() then
    raise exception 'Sin permiso para registrar traslados entre campamentos';
  end if;
  if p_centro_origen is null or p_centro_destino is null then
    raise exception 'Origen y destino son obligatorios';
  end if;
  if p_centro_origen = p_centro_destino then
    raise exception 'El campamento destino debe ser distinto del origen';
  end if;
  if v_motivo is null then raise exception 'El motivo del traslado es obligatorio'; end if;
  if p_alojamiento_ids is null or cardinality(p_alojamiento_ids) = 0 then
    raise exception 'Indique al menos un miembro a trasladar';
  end if;
  if not public.puede_escribir_ambos_centros(p_centro_origen, p_centro_destino) then
    raise exception 'Sin permiso de escritura en ambos campamentos (origen y destino)';
  end if;

  select coalesce(nullif(btrim(c.data->>'nombre'), ''), c.id)
  into v_destino_label from public.centros c where c.id = p_centro_destino;
  if v_destino_label is null then
    raise exception 'Campamento destino no encontrado: %', p_centro_destino;
  end if;
  if not exists (select 1 from public.centros c where c.id = p_centro_origen) then
    raise exception 'Campamento origen no encontrado: %', p_centro_origen;
  end if;

  v_ids := (select array_agg(distinct x) from unnest(p_alojamiento_ids) x);

  perform 1 from public.alojamientos_refugiados a where a.id = any (v_ids) for update;

  select count(*) into v_count from public.alojamientos_refugiados a
  where a.id = any (v_ids) and a.centro_id = p_centro_origen
    and a.estado in ('activo', 'observacion');
  if v_count <> cardinality(v_ids) then
    raise exception 'Uno o más alojamientos no están activos en el campamento origen';
  end if;

  select count(distinct coalesce(a.familia_id::text, 'solo:' || a.id::text)) into v_count
  from public.alojamientos_refugiados a where a.id = any (v_ids);
  if v_count <> 1 then
    raise exception 'Todos los miembros seleccionados deben pertenecer al mismo hogar';
  end if;

  select distinct a.familia_id into v_familia_origen
  from public.alojamientos_refugiados a where a.id = any (v_ids) limit 1;

  if exists (
    select 1 from public.alojamientos_refugiados a
    where a.id = any (v_ids)
      and exists (
        select 1 from public.alojamientos_refugiados d
        where d.refugiado_id = a.refugiado_id and d.centro_id = p_centro_destino
          and d.estado in ('activo', 'observacion', 'transito')
      )
  ) then
    raise exception 'Uno o más miembros ya tienen plaza activa en el destino';
  end if;

  if v_familia_origen is not null then
    select * into v_fam_origen from public.familias_centro f
    where f.id = v_familia_origen for update;
    if not found then raise exception 'Familia no encontrada'; end if;
    if v_fam_origen.centro_id is distinct from p_centro_origen then
      raise exception 'La familia no pertenece al campamento origen indicado';
    end if;
    insert into public.familias_centro (
      centro_id, nombre, notas, foto_familiar_url, consentimiento_foto_familiar,
      familiares_referencia, familiares_separados,
      miembros_damnificados_declarados, fallecidos_confirmados, desaparecidos,
      updated_at, updated_by
    ) values (
      p_centro_destino, v_fam_origen.nombre, v_fam_origen.notas,
      v_fam_origen.foto_familiar_url, v_fam_origen.consentimiento_foto_familiar,
      v_fam_origen.familiares_referencia, v_fam_origen.familiares_separados,
      v_fam_origen.miembros_damnificados_declarados, v_fam_origen.fallecidos_confirmados,
      v_fam_origen.desaparecidos, v_ahora, v_user
    ) returning id into v_fam_destino_id;
    select * into v_res from public.residencias_afectadas r where r.familia_id = v_familia_origen;
    if found then
      insert into public.residencias_afectadas (
        familia_id, centro_id, pais, estado_federativo, municipio, parroquia, sector,
        direccion, referencia, estatus_vivienda, geom, fotos,
        observaciones, tipo_tenencia, perdio_todo, perdidas_materiales, updated_at, updated_by
      ) values (
        v_fam_destino_id, p_centro_destino, v_res.pais,
        v_res.estado_federativo, v_res.municipio, v_res.parroquia, v_res.sector,
        v_res.direccion, v_res.referencia, v_res.estatus_vivienda, v_res.geom, v_res.fotos,
        v_res.observaciones, v_res.tipo_tenencia, v_res.perdio_todo, v_res.perdidas_materiales,
        v_ahora, v_user
      );
    end if;
  end if;

  select a.id into v_jefe_aloj_id from public.alojamientos_refugiados a
  where a.id = any (v_ids) and a.es_jefe_familia limit 1;
  if v_jefe_aloj_id is null then
    if p_jefe_alojamiento_id is not null and p_jefe_alojamiento_id = any (v_ids) then
      v_jefe_aloj_id := p_jefe_alojamiento_id;
    else
      select a.id into v_jefe_aloj_id
      from public.alojamientos_refugiados a
      inner join public.refugiados r on r.id = a.refugiado_id
      where a.id = any (v_ids) and r.fecha_nacimiento is not null
        and extract(year from age(v_hoy, r.fecha_nacimiento))::int >= 18
      order by a.fecha_ingreso limit 1;
      if v_jefe_aloj_id is null then
        select a.id into v_jefe_aloj_id from public.alojamientos_refugiados a
        where a.id = any (v_ids) order by a.fecha_ingreso limit 1;
      end if;
    end if;
  end if;

  for v_aloj in
    select a.* from public.alojamientos_refugiados a
    where a.id = any (v_ids)
    order by a.es_jefe_familia desc, a.fecha_ingreso
  loop
    if v_familia_origen is null then
      insert into public.familias_centro (centro_id, nombre, notas, updated_at, updated_by)
      values (p_centro_destino, 'Hogar individual', '', v_ahora, v_user)
      returning id into v_fam_destino_id;
    end if;
    update public.alojamientos_refugiados set
      estado = 'egresado', fecha_egreso = v_fecha,
      motivo_egreso = v_motivo, destino_egreso = v_destino_label,
      updated_at = v_ahora, updated_by = v_user
    where id = v_aloj.id;
    insert into public.alojamientos_refugiados (
      refugiado_id, centro_id, familia_id, fecha_ingreso, fecha_egreso, estado,
      itinerante, es_jefe_familia, parentesco_jefe, tipo_alojamiento, plaza_modulo,
      motivo_egreso, destino_egreso, creada_ts, creada_por, updated_at, updated_by
    ) values (
      v_aloj.refugiado_id, p_centro_destino, v_fam_destino_id, v_fecha, null, 'activo',
      v_aloj.itinerante, (v_aloj.id = v_jefe_aloj_id),
      case when v_aloj.id = v_jefe_aloj_id then '' else v_aloj.parentesco_jefe end,
      coalesce(v_aloj.tipo_alojamiento, ''), coalesce(v_aloj.plaza_modulo, ''),
      '', '', v_ahora, v_user, v_ahora, v_user
    ) returning id into v_nuevo_aloj_id;
    v_miembros := v_miembros || jsonb_build_array(jsonb_build_object(
      'refugiado_id', v_aloj.refugiado_id,
      'alojamiento_origen_id', v_aloj.id,
      'alojamiento_destino_id', v_nuevo_aloj_id,
      'es_jefe_familia', (v_aloj.id = v_jefe_aloj_id)
    ));
  end loop;

  insert into public.traslados (
    familia_id_origen, familia_id_destino, centro_origen, centro_destino,
    motivo, miembros, creada_ts, creada_por, fuente
  ) values (
    v_familia_origen, v_fam_destino_id, p_centro_origen, p_centro_destino,
    v_motivo, v_miembros, v_ahora, v_user, 'wizard'
  ) returning id into v_traslado_id;

  for v_miembro in select * from jsonb_array_elements(v_miembros)
  loop
    insert into public.historial (ts, usuario, accion, entidad, entidad_id, detalle)
    values (
      v_ahora, v_user, 'trasladar_familia', 'refugiado',
      (v_miembro->>'refugiado_id'),
      jsonb_build_object(
        'centro_origen', p_centro_origen,
        'centro_destino', p_centro_destino,
        'motivo', v_motivo,
        'traslado_id', v_traslado_id,
        'fuente', 'wizard',
        'es_jefe_familia', coalesce((v_miembro->>'es_jefe_familia')::boolean, false)
      )
    );
  end loop;

  return jsonb_build_object(
    'traslado_id', v_traslado_id,
    'familia_id_destino', v_fam_destino_id,
    'miembros', v_miembros,
    'centro_origen', p_centro_origen,
    'centro_destino', p_centro_destino
  );
end;
$$;

revoke all on function public.trasladar_miembros_entre_centros(
  text, text, text, uuid[], uuid, date
) from public, anon;
grant execute on function public.trasladar_miembros_entre_centros(
  text, text, text, uuid[], uuid, date
) to authenticated;
