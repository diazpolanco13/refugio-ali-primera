-- Traslados formales entre campamentos (familia completa o persona sola).
-- Tabla de historial + RPC atómica SECURITY DEFINER.
-- Proyecto: xzwifkckkakldnzkdeby
--
-- Gotcha: CREATE OR REPLACE resetea EXECUTE a PUBLIC → revoke/grant al final.

-- ============================================================================
-- 1) Tabla traslados
-- ============================================================================
create table if not exists public.traslados (
  id uuid primary key default gen_random_uuid(),
  familia_id_origen uuid references public.familias_centro(id) on delete set null,
  familia_id_destino uuid references public.familias_centro(id) on delete set null,
  centro_origen text not null references public.centros(id),
  centro_destino text not null references public.centros(id),
  motivo text not null default '',
  miembros jsonb not null default '[]'::jsonb,
  creada_ts bigint not null,
  creada_por text not null default '',
  constraint traslados_centros_distintos check (centro_origen <> centro_destino)
);

create index if not exists traslados_creada_ts_idx on public.traslados (creada_ts desc);
create index if not exists traslados_centro_origen_idx on public.traslados (centro_origen);
create index if not exists traslados_centro_destino_idx on public.traslados (centro_destino);

alter table public.traslados enable row level security;

drop policy if exists traslados_select on public.traslados;
create policy traslados_select on public.traslados
  for select to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or centro_origen = any ((select public.mis_centros())::text[])
    or centro_destino = any ((select public.mis_centros())::text[])
  );

-- INSERT/UPDATE/DELETE solo vía RPC (SECURITY DEFINER). Sin policies de escritura.

-- ============================================================================
-- 2) Helper: ¿puede escribir en ambos centros?
-- ============================================================================
create or replace function public.puede_escribir_ambos_centros(
  p_centro_a text,
  p_centro_b text
)
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
  if v_rol in ('admin', 'analista_sae') then
    return true;
  end if;
  if v_rol in ('supervisor', 'operador')
     and p_centro_a = any (v_centros)
     and p_centro_b = any (v_centros) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.puede_escribir_ambos_centros(text, text) from public, anon, authenticated;

-- ============================================================================
-- 3) RPC principal
-- ============================================================================
create or replace function public.trasladar_entre_centros(
  p_centro_origen text,
  p_centro_destino text,
  p_motivo text,
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

  if (p_familia_id is null and p_alojamiento_id is null)
     or (p_familia_id is not null and p_alojamiento_id is not null) then
    raise exception 'Indique exactamente familia_id o alojamiento_id (persona sin hogar)';
  end if;

  if not public.puede_escribir_ambos_centros(p_centro_origen, p_centro_destino) then
    raise exception 'Sin permiso de escritura en ambos campamentos (origen y destino)';
  end if;

  -- Etiqueta destino para destino_egreso
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

  -- ---------- Caso familia completa ----------
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

    -- Lock plazas activas
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

    -- Ningún miembro ya activo en destino
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

    -- Crear familia destino (copiar metadata)
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

    -- Egresar + alta destino por miembro
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

    -- Copiar residencia afectada si existe
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

  -- ---------- Caso persona sin hogar ----------
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
      raise exception 'Este alojamiento pertenece a una familia; use el traslado por familia_id';
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
  end if;

  insert into public.traslados (
    familia_id_origen, familia_id_destino,
    centro_origen, centro_destino,
    motivo, miembros, creada_ts, creada_por
  ) values (
    p_familia_id, v_fam_destino_id,
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

revoke all on function public.trasladar_entre_centros(text, text, text, uuid, uuid, date)
  from public, anon;
grant execute on function public.trasladar_entre_centros(text, text, text, uuid, uuid, date)
  to authenticated;
