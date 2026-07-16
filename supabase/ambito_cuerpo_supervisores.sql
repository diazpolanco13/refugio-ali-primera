-- =============================================================================
-- Alcance por cuerpo para supervisores y operadores (16-jul-2026) —
-- REFERENCIA de la migración aplicada: `ambito_cuerpo_supervisores`.
--
-- Generaliza el ámbito por cuerpo (ver `ambito_analista.sql`) a los 3 roles de
-- alcance limitado: `perfiles.ambito_analista = 'cuerpo'` + `cuerpo_asignado`
-- ya no es exclusivo del analista. `mis_centros()` resuelve el alcance
-- dinámico (campamentos supervisados por unidades del cuerpo) también para
-- supervisor y operador; TODA la RLS que ya filtra por mis_centros() fluye
-- sin cambios. 'red' sigue siendo significativo SOLO para el analista
-- (`es_analista_total()`); en supervisor/operador se corrige a 'centros'.
--
-- Piezas fuera de esta migración:
--   * Edge Function `create-user` v4: acepta ambito 'cuerpo'|'centros' para
--     supervisor/operador (valida el cuerpo contra `cuerpos_policiales`).
--   * Frontend: `tieneAlcancePorCuerpo()` + `puedeEditarCentro` (permisos.ts),
--     formulario de usuarios con selector de alcance para los 3 roles,
--     multi-select de campamentos agrupado por cuerpo (con atajo "Todos los
--     de <cuerpo>"), filtro por cuerpo en la lista y badge en la tarjeta.
--
-- ⚠️ Al recrear funciones, Postgres re-otorga EXECUTE a PUBLIC: repetir los
-- revoke/grant (patrón del repo).
-- =============================================================================

create or replace function public.mis_centros()
returns text[]
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v record;
begin
  select rol, centros_asignados, ambito_analista, cuerpo_asignado
    into v
    from public.perfiles
   where user_id = auth.uid();
  if v is null then
    return '{}';
  end if;
  if v.rol in ('analista_sae', 'supervisor', 'operador')
     and v.ambito_analista = 'cuerpo'
     and v.cuerpo_asignado is not null then
    return coalesce((
      select array_agg(c.id)
      from public.centros c
      join public.unidades_sebin u
        on u.valor_db = (c.data->'supervision'->>'unidad_sebin')
      where u.cuerpo_clave = v.cuerpo_asignado
        and c.deleted is not true
    ), '{}');
  end if;
  return coalesce(v.centros_asignados, '{}');
end;
$$;

revoke all on function public.mis_centros() from public, anon;
grant execute on function public.mis_centros() to authenticated;
