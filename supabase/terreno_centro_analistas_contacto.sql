-- terreno_centro: añade contactos Telegram de analistas SAE asignados al
-- campamento (supervision.analistas_sae → perfiles.nombre/telegram).

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
  analistas_contacto jsonb
)
language sql stable security definer set search_path = public as $$
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
            'telegram', nullif(trim(p.telegram), '')
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
    ) as analistas_contacto
  from public.centros c
  where c.id = public.centro_de_token(p_token, 'personal') and not c.deleted;
$$;

revoke all on function public.terreno_centro(text) from public;
grant execute on function public.terreno_centro(text) to anon, authenticated;
