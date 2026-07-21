-- =============================================================================
-- Censar solo en campamentos del alcance (21-jul-2026) — REFERENCIA de la
-- migración aplicada: `censo_alcance_operador`.
--
-- Hueco: un operador con sesión (por contraseña o QR) entraba a /censo sin
-- `?centro=` y podía (a) ver TODOS los campamentos en el selector —
-- `censo_centros()` es SECURITY DEFINER y no filtraba— y (b) registrar censo
-- en cualquiera: `acceso_censo_centro()` dejaba pasar a cualquier
-- autenticado sin mirar el centro (solo validaba token para anónimos).
--
-- Cierre:
--   1. `acceso_censo_centro`: el token válido del campamento sigue siendo
--      prueba de presencia suficiente. Sin token, los roles de alcance
--      limitado (analista con ámbito, supervisor, operador) solo pasan si el
--      centro está en `mis_centros()`. Roles de red (admin, autoridad,
--      censo_rapido, analista de red) pasan como hoy.
--   2. `censo_centros`: la lista del selector se acota igual, y el sandbox
--      de prueba solo lo ve el admin (espejo de la policy `centros_select`).
--
-- ⚠️ Gotcha #1 CLAUDE.md: CREATE OR REPLACE re-otorga EXECUTE a PUBLIC →
-- revoke/grant repetidos al final.
-- =============================================================================

create or replace function public.acceso_censo_centro(p_token text, p_centro_id text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  -- Token del campamento válido: prueba de presencia (anónimo o autenticado).
  if p_token is not null and p_centro_id is not null
     and public.centro_de_token(p_token, 'personal') = p_centro_id then
    return;
  end if;
  if auth.uid() is not null then
    if (select public.mi_rol()) in ('admin', 'autoridad', 'censo_rapido')
       or (select public.es_analista_total())
       or (
         (select public.mi_rol()) in ('analista_sae', 'supervisor', 'operador')
         and p_centro_id = any ((select public.mis_centros())::text[])
       ) then
      return;
    end if;
    raise exception 'Solo puede censar en sus campamentos asignados';
  end if;
  raise exception 'Acceso no autorizado: use el enlace o código QR de su campamento';
end;
$$;

create or replace function public.censo_centros()
returns table (id text, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, coalesce(nullif(trim(c.data->>'nombre'), ''), c.id) as nombre
  from public.centros c
  where not c.deleted
    and (
      (select public.mi_rol()) in ('admin', 'autoridad', 'censo_rapido')
      or (select public.es_analista_total())
      or c.id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or (c.id <> 'centro-prueba' and coalesce((c.data->>'es_prueba')::boolean, false) = false)
    )
  order by 2;
$$;

-- Grants (gotcha #1)
revoke all on function public.acceso_censo_centro(text, text) from public, anon, authenticated;

revoke all on function public.censo_centros() from public, anon;
grant execute on function public.censo_centros() to authenticated;
