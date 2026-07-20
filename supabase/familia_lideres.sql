-- Permite hasta 2 "líderes de familia" activos por hogar (antes: exactamente
-- 1 jefe). El índice único `alojamientos_refugiados_un_jefe_activo_familia_uq`
-- (familia_refugiado_redisenio.sql) no puede expresar "como máximo 2" — se
-- reemplaza por un trigger. La columna `es_jefe_familia` NO se renombra (solo
-- cambia el texto visible en la UI a "líder de familia"); mantenemos el
-- nombre interno para no tocar el resto del esquema.

drop index if exists public.alojamientos_refugiados_un_jefe_activo_familia_uq;

create or replace function public.validar_max_lideres_familia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activos int;
begin
  if new.familia_id is null or new.estado = 'egresado' or not new.es_jefe_familia then
    return new;
  end if;

  select count(*) into v_activos
  from public.alojamientos_refugiados a
  where a.familia_id = new.familia_id
    and a.estado <> 'egresado'
    and a.es_jefe_familia
    and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_activos >= 2 then
    raise exception 'Este hogar ya tiene 2 líderes activos. Ajuste uno existente antes de asignar otro.';
  end if;

  return new;
end;
$$;

drop trigger if exists alojamientos_refugiados_max_lideres_trg on public.alojamientos_refugiados;
create trigger alojamientos_refugiados_max_lideres_trg
  before insert or update on public.alojamientos_refugiados
  for each row
  execute function public.validar_max_lideres_familia();

-- Gotcha documentado en docs/traspaso.md: aunque esta función solo debe invocarse
-- como trigger (nunca directo por RPC), Supabase le otorga EXECUTE a
-- anon/authenticated por default al crearla. `get_advisors` lo marcó
-- (`rest/v1/rpc/validar_max_lideres_familia` quedaba invocable). El trigger
-- sigue funcionando igual tras revocar: los triggers SECURITY DEFINER no
-- dependen de que el rol invocador tenga EXECUTE directo sobre la función.
revoke execute on function public.validar_max_lideres_familia() from anon, authenticated, public;
