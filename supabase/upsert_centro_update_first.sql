-- Operadores/supervisores pueden UPDATE sus centros pero no INSERT.
-- INSERT … ON CONFLICT DO UPDATE también evalúa la política INSERT
-- (WITH CHECK), y falla con RLS aunque la fila ya exista.
-- Solución: UPDATE primero; INSERT solo si no hay fila (alta nueva).

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
