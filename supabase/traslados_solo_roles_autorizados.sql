-- Restringe traslados entre campamentos a admin, analista_sae y supervisor.
-- Aplicar junto con traslados_parcial_rpc.sql (RPC parcial con guard de rol).
-- Proyecto: xzwifkckkakldnzkdeby

create or replace function public.puede_trasladar_entre_centros()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (select public.mi_rol()) in ('admin', 'analista_sae', 'supervisor');
end;
$$;

revoke all on function public.puede_trasladar_entre_centros() from public, anon, authenticated;

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
  if not public.puede_trasladar_entre_centros() then
    return false;
  end if;
  if v_rol in ('admin', 'analista_sae') then
    return true;
  end if;
  if v_rol = 'supervisor'
     and p_centro_a = any (v_centros)
     and p_centro_b = any (v_centros) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.puede_escribir_ambos_centros(text, text) from public, anon, authenticated;

create or replace function public.puede_leer_centro_traslado(p_centro_id text)
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
  if v_rol is null then
    return false;
  end if;
  if v_rol in ('admin', 'analista_sae', 'autoridad') then
    return true;
  end if;
  if v_rol = 'supervisor' then
    return p_centro_id = any (v_centros);
  end if;
  return false;
end;
$$;

revoke all on function public.puede_leer_centro_traslado(text) from public, anon, authenticated;

-- Tras aplicar este archivo, ejecutar también supabase/traslados_parcial_rpc.sql
-- (incluye guard `puede_trasladar_entre_centros` en trasladar_miembros_entre_centros)
-- y, si aplica, el bloque de helpers/RPC legacy en traslados_entre_centros.sql.
