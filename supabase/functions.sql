-- Funciones Postgres del proyecto Supabase (xzwifkckkakldnzkdeby).
--
-- ✅ APLICADA (migración `upsert_centro_rpc`, 04-jul-2026, vía MCP
-- `apply_migration`). Este archivo queda como referencia versionada del SQL
-- que corre en producción. El frontend la invoca con
-- `supabase.rpc("upsert_centro", ...)` desde `src/data/reposSupabase.ts`.

-- upsert_centro(p_id, p_data, p_lng, p_lat)
--
-- Upsert completo de un centro: actualiza el blob `data` (igual que las demás
-- tablas blob) y además recalcula la columna `geom` (geography Point 4326) si
-- llegan coordenadas. Encapsula en una sola llamada RPC lo que supabase-js no
-- puede hacer directamente (PostGIS + upsert blob). Sirve tanto para editar
-- centros existentes como para crear centros nuevos.
--
-- Parámetros:
--   p_id  text        — id del centro (p. ej. "centro-01" o un uuid nuevo)
--   p_data jsonb      — blob completo del centro (todo el objeto)
--   p_lng double precision — longitud [lng, lat] o NULL si no hay coords
--   p_lat double precision — latitud o NULL
--
-- Seguridad: SECURITY INVOKER → corre con los permisos del usuario autenticado,
-- así que las políticas RLS de `centros` siguen aplicando. Solo `authenticated`
-- puede ejecutarla. IMPORTANTE: se hace UPDATE primero y INSERT solo si no
-- existe la fila. Un `INSERT … ON CONFLICT DO UPDATE` también evalúa la
-- política INSERT (solo admin/analista_sae), y el operador de terreno
-- (que sí puede UPDATE su campamento) fallaría al guardar desde /terreno.
create or replace function public.upsert_centro(
  p_id text,
  p_data jsonb,
  p_lng double precision default null,
  p_lat double precision default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now bigint := coalesce((p_data->>'updated_at')::bigint, (extract(epoch from now()) * 1000)::bigint);
  v_geom geography(Point, 4326) := null;
  v_by text := coalesce(p_data->>'updated_by', auth.uid()::text);
  v_updated int;
begin
  if p_lng is not null and p_lat is not null then
    v_geom := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  end if;

  update public.centros
  set
    updated_at = v_now,
    updated_by = v_by,
    deleted = false,
    data = p_data,
    geom = coalesce(v_geom, geom)
  where id = p_id;

  get diagnostics v_updated = row_count;
  if v_updated > 0 then
    return;
  end if;

  insert into public.centros (id, updated_at, updated_by, deleted, data, geom)
  values (p_id, v_now, v_by, false, p_data, v_geom);
end;
$$;

revoke execute on function public.upsert_centro(text, jsonb, double precision, double precision) from public, anon;
grant execute on function public.upsert_centro(text, jsonb, double precision, double precision) to authenticated;

-- Nota: `updated_by` lleva el username (no el UUID) por compatibilidad con el
-- resto de la capa de datos, que usa `updated_by = username` en todas las
-- tablas blob. En una futura normalización se puede migrar a
-- `uuid references auth.users`.
