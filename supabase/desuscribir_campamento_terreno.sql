-- Desuscribir operador de terreno de uno o todos sus campamentos.
-- Migración: desuscribir_campamento_terreno
--
-- Quita el centro de `perfiles.centros_asignados`. Eso corta las alertas /
-- recordatorios de Telegram (recordatorio-partes itera esa lista).
--
-- Quién puede:
--   - El propio operador (p_user_id null → auth.uid())
--   - admin / analista_sae sobre cualquier operador (bandeja /usuarios/terreno)
--
-- p_centro_id null o '' → baja de TODOS los campamentos.

create or replace function public.desuscribir_campamento_terreno(
  p_centro_id text default null,
  p_user_id uuid default null
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_rol text := public.mi_rol();
  v_target uuid;
  v_perfil public.perfiles%rowtype;
  v_nuevos text[];
  v_todos boolean;
begin
  if v_actor is null then
    raise exception 'No autenticado';
  end if;

  v_target := coalesce(p_user_id, v_actor);
  v_todos := p_centro_id is null or btrim(p_centro_id) = '';

  if v_target <> v_actor and v_rol not in ('admin', 'analista_sae') then
    raise exception 'Sin permiso para desuscribir a otro usuario';
  end if;

  select * into v_perfil
  from public.perfiles
  where user_id = v_target
  for update;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  if v_perfil.rol is distinct from 'operador' then
    raise exception 'Solo aplica a operadores de terreno';
  end if;

  if v_todos then
    v_nuevos := '{}';
  else
    v_nuevos := coalesce(
      (
        select array_agg(c order by c)
        from unnest(coalesce(v_perfil.centros_asignados, '{}'::text[])) as c
        where c is distinct from btrim(p_centro_id)
      ),
      '{}'::text[]
    );
  end if;

  update public.perfiles
  set centros_asignados = v_nuevos
  where user_id = v_target;

  insert into public.historial (ts, usuario, accion, entidad, entidad_id, detalle)
  values (
    (extract(epoch from clock_timestamp()) * 1000)::bigint,
    coalesce(public.mi_username(), 'sistema'),
    'desuscribir_campamento',
    'usuario',
    v_target::text,
    jsonb_build_object(
      'centro_id', case when v_todos then null else btrim(p_centro_id) end,
      'todos', v_todos,
      'centros_restantes', to_jsonb(v_nuevos),
      'username', v_perfil.username,
      'nombre', v_perfil.nombre
    )
  );

  return v_nuevos;
end;
$$;

revoke execute on function public.desuscribir_campamento_terreno(text, uuid) from public, anon;
grant execute on function public.desuscribir_campamento_terreno(text, uuid) to authenticated;
