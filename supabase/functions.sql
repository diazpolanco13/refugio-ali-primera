-- Funciones Postgres para la migración a Supabase (Fase 3).
--
-- Estas funciones aún NO están aplicadas en Supabase. Se incluyen aquí como
-- referencia para que se desplieguen vía MCP `apply_migration` (o psql) en una
-- próxima fase. El código del frontend las referenciará con `supabase.rpc(...)`
-- cuando corresponda (ver TODO en `src/data/reposSupabase.ts`).
--
-- Requisitos: PostGIS habilitado en el proyecto Supabase (ya lo está en
-- `xzwifkckkakldnzkdeby`).

-- upsert_centro(p_id, p_data, p_lng, p_lat)
--
-- Upsert completo de un centro: actualiza el blob `data` (igual que las demás
-- tablas blob) y además recalcula la columna `geom` (geography Point 4326) si
-- llegan coordenadas. Encapsula en una sola llamada RPC lo que supabase-js no
-- puede hacer directamente (PostGIS + upsert blob).
--
-- Parámetros:
--   p_id  text        — id del centro (p. ej. "centro-01")
--   p_data jsonb      — blob completo del centro (todo el objeto)
--   p_lng double precision — longitud [lng, lat] o NULL si no hay coords
--   p_lat double precision — latitud o NULL
--
-- Seguridad: ejecutar como `SECURITY DEFINER` con search_path locked, y
-- validar que el llamador esté autenticado y tenga rol campo/coordinador/admin
-- en `perfiles`. (La verificación fina de RLS queda en las policies de la tabla
-- `centros`.)
create or replace function public.upsert_centro(
  p_id text,
  p_data jsonb,
  p_lng double precision default null,
  p_lat double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now bigint := extract(epoch from now()) * 1000;
  v_user text;
  v_geom geography(Point, 4326) := null;
begin
  if p_lng is not null and p_lat is not null then
    v_geom := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  end if;

  insert into centros (id, updated_at, updated_by, deleted, data, geom)
  values (p_id, v_now, coalesce((p_data->>'updated_by'), auth.uid()::text), false, p_data, v_geom)
  on conflict (id) do update
    set
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by,
      deleted = false,
      data = excluded.data,
      geom = coalesce(excluded.geom, centros.geom);
end;
$$;

-- Nota: `updated_by` debería venir del JWT (auth.uid()). Como esta función la
-- invoca el frontend con la anon key, `auth.uid()` devuelve el UUID del usuario
-- autenticado. El frontend pasa el `username` en `p_data->>'updated_by'` por
-- compatibilidad con el resto de la capa (donde `updated_by` es el username,
-- no el UUID). En una futura normalización se puede migrar `updated_by` a
-- `uuid references auth.users`.
