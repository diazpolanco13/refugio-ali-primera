-- terreno_centro: progreso del censo nominal vs parte numérico del campamento
-- (para el botón Censo del portal /terreno).

drop function if exists public.terreno_centro(text);

create or replace function public.terreno_centro(p_token text)
returns table(
  id text,
  nombre text,
  geolocalizado boolean,
  autoridades_ok boolean,
  capacidad_ok boolean,
  geolocalizacion_ts bigint,
  autoridades_ts bigint,
  capacidad_ts bigint,
  analistas_contacto jsonb,
  parte_personas int,
  parte_familias int,
  censados_personas int,
  censados_familias int,
  reporte_ts bigint,
  censo_ts bigint
)
language sql stable security definer set search_path = public as $$
  with hoy as (
    select (timezone('America/Caracas', now()))::date as dia
  )
  select
    c.id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id) as nombre,
    (c.geom is not null) as geolocalizado,
    (
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(c.data->'responsables_coordinacion', '[]'::jsonb)
        ) as r
        where coalesce(r->>'categoria', '') in (
          'politica', 'seguridad', 'salud', 'justicia', 'comunitaria'
        )
          and nullif(btrim(coalesce(r->>'nombre', '')), '') is not null
      )
      or exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(c.data->'ambitos_sin_autoridad', '[]'::jsonb)
        ) as a(val)
        where a.val in (
          'politica', 'seguridad', 'salud', 'justicia', 'comunitaria'
        )
      )
    ) as autoridades_ok,
    (
      jsonb_typeof(c.data->'censo_oficial'->'capacidad_instalada') = 'number'
      or coalesce((c.data->'capacidad'->>'camas_instaladas')::int, 0) > 0
      or coalesce((c.data->'capacidad'->>'pocetas_instaladas')::int, 0) > 0
      or coalesce((c.data->'capacidad'->>'duchas_instaladas')::int, 0) > 0
      or coalesce((c.data->'capacidad'->>'lavaderos_instalados')::int, 0) > 0
      or coalesce((c.data->'capacidad'->>'contenedores_instalados')::int, 0) > 0
      or (
        coalesce((c.data->'capacidad'->>'agua_tanque')::boolean, false)
        and coalesce((c.data->'capacidad'->>'agua_litros')::int, 0) > 0
      )
    ) as capacidad_ok,
    nullif((c.data->'terreno_actualizado'->>'geolocalizacion')::bigint, 0) as geolocalizacion_ts,
    nullif((c.data->'terreno_actualizado'->>'autoridades')::bigint, 0) as autoridades_ts,
    coalesce(
      nullif((c.data->'terreno_actualizado'->>'capacidad')::bigint, 0),
      case
        when jsonb_typeof(c.data->'censo_oficial'->'capacidad_instalada') = 'number'
          or coalesce((c.data->'capacidad'->>'camas_instaladas')::int, 0) > 0
          or coalesce((c.data->'capacidad'->>'pocetas_instaladas')::int, 0) > 0
          or coalesce((c.data->'capacidad'->>'duchas_instaladas')::int, 0) > 0
          or coalesce((c.data->'capacidad'->>'lavaderos_instalados')::int, 0) > 0
          or coalesce((c.data->'capacidad'->>'contenedores_instalados')::int, 0) > 0
          or (
            coalesce((c.data->'capacidad'->>'agua_tanque')::boolean, false)
            and coalesce((c.data->'capacidad'->>'agua_litros')::int, 0) > 0
          )
        then c.updated_at
        else null
      end
    ) as capacidad_ts,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'nombre', coalesce(
              nullif(trim(p.nombre), ''),
              nullif(trim(p.username), ''),
              'Analista SAE'
            ),
            'telegram', nullif(trim(p.telegram), ''),
            'whatsapp', nullif(trim(p.whatsapp), '')
          )
          order by p.nombre nulls last
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements_text(
        coalesce(c.data->'supervision'->'analistas_sae', '[]'::jsonb)
      ) as ids(uid)
      join public.perfiles p
        on p.user_id::text = ids.uid
       and p.rol = 'analista_sae'
    ) as analistas_contacto,
    -- Meta del parte: último snapshot; si no hay, familias_ocupadas / 0.
    greatest(
      coalesce((
        select o.total_afectados
        from public.ocupaciones_centros o
        where o.centro_id = c.id
        order by o.dia desc
        limit 1
      ), 0),
      0
    )::int as parte_personas,
    greatest(
      coalesce((
        select o.familias
        from public.ocupaciones_centros o
        where o.centro_id = c.id
        order by o.dia desc
        limit 1
      ), 0),
      coalesce((c.data->>'familias_ocupadas')::int, 0),
      0
    )::int as parte_familias,
    (
      select count(*)::int
      from public.alojamientos_refugiados a
      where a.centro_id = c.id and a.estado = 'activo'
    ) as censados_personas,
    (
      (
        select count(distinct a.familia_id)::int
        from public.alojamientos_refugiados a
        where a.centro_id = c.id
          and a.estado = 'activo'
          and a.familia_id is not null
      )
      + case when exists (
        select 1
        from public.alojamientos_refugiados a
        where a.centro_id = c.id
          and a.estado = 'activo'
          and a.familia_id is null
      ) then 1 else 0 end
    )::int as censados_familias,
    nullif(
      greatest(
        coalesce((
          select max(r.updated_at)
          from public.reportes_centros r
          cross join hoy
          where r.centro_id = c.id and r.dia = hoy.dia
        ), 0),
        coalesce((
          select max(r.salud_updated_at)
          from public.reportes_centros r
          cross join hoy
          where r.centro_id = c.id and r.dia = hoy.dia
        ), 0),
        coalesce((
          select max(r.trabajos_updated_at)
          from public.reportes_centros r
          cross join hoy
          where r.centro_id = c.id and r.dia = hoy.dia
        ), 0),
        coalesce((
          select max(r.requerimientos_updated_at)
          from public.reportes_centros r
          cross join hoy
          where r.centro_id = c.id and r.dia = hoy.dia
        ), 0),
        coalesce((
          select max(r.eventos_updated_at)
          from public.reportes_centros r
          cross join hoy
          where r.centro_id = c.id and r.dia = hoy.dia
        ), 0),
        coalesce((
          select max(rc.updated_at)
          from public.reportes_control_dia rc
          cross join hoy
          where rc.centro_id = c.id and rc.dia = hoy.dia
        ), 0),
        coalesce((
          select max(greatest(coalesce(o.updated_at, 0), coalesce(o.ts, 0)))
          from public.ocupaciones_centros o
          cross join hoy
          where o.centro_id = c.id and o.dia = hoy.dia
        ), 0),
        coalesce((
          select max(greatest(coalesce(e.updated_at, 0), coalesce(e.ts, 0)))
          from public.eventos_reportes e
          cross join hoy
          where e.centro_id = c.id and e.dia = hoy.dia
        ), 0)
      ),
      0
    )::bigint as reporte_ts,
    nullif(
      (
        select max(greatest(coalesce(a.updated_at, 0), coalesce(a.creada_ts, 0)))
        from public.alojamientos_refugiados a
        where a.centro_id = c.id and a.estado = 'activo'
      ),
      0
    )::bigint as censo_ts
  from public.centros c
  cross join hoy
  where c.id = public.centro_de_token(p_token, 'personal') and not c.deleted;
$$;

revoke all on function public.terreno_centro(text) from public;
grant execute on function public.terreno_centro(text) to anon, authenticated;
