-- Extiende terreno_centro con flag geolocalizado (geom IS NOT NULL)
-- para pintar el botón verde en el menú de /terreno sin login previo.

drop function if exists public.terreno_centro(text);

create or replace function public.terreno_centro(p_token text)
returns table(id text, nombre text, geolocalizado boolean)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    coalesce(nullif(trim(c.data->>'nombre'), ''), c.id) as nombre,
    (c.geom is not null) as geolocalizado
  from public.centros c
  where c.id = public.centro_de_token(p_token, 'personal') and not c.deleted;
$$;

revoke all on function public.terreno_centro(text) from public;
grant execute on function public.terreno_centro(text) to anon, authenticated;
