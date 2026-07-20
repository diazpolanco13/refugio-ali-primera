-- censo_marcar_procesado: marca una fila del censo manual viejo (censo_registros)
-- como ya verificada en el censo nominal (refugiados vía Nexus).
--
-- La columna `procesado` ya existe (censo_rapido.sql) pero no la usaba nadie.
-- SECURITY DEFINER a propósito: la RLS de update de censo_registros
-- (censo_supervisor_centros_asignados.sql) no incluye al rol `operador`, y es
-- justamente la sesión de terreno (QR) la que suele completar el alta por
-- cédula. Alcance mínimo: solo puede tocar `procesado` de un centro que le
-- corresponda, nunca cualquier otro campo.
--
-- Idempotente: si no hay fila con esa cédula en ese centro (lo normal, la
-- mayoría de altas nominales no tienen contraparte en el censo viejo), no
-- falla, simplemente no actualiza nada.

create or replace function public.censo_marcar_procesado(
  p_documento_norm text,
  p_centro_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := (select public.mi_rol());
begin
  if coalesce(trim(p_documento_norm), '') = '' or coalesce(trim(p_centro_id), '') = '' then
    return;
  end if;

  if v_rol in ('admin', 'analista_sae') then
    null;
  elsif v_rol in ('supervisor', 'operador')
        and p_centro_id = any ((select public.mis_centros())::text[]) then
    null;
  else
    raise exception 'Acceso denegado';
  end if;

  update public.censo_registros
    set procesado = true
    where documento_norm = p_documento_norm
      and centro_id = p_centro_id
      and procesado = false;
end;
$$;

-- Gotcha documentado en docs/traspaso.md: Supabase re-otorga EXECUTE a `anon` vía
-- default privileges al crear/reemplazar la función; `revoke ... from public`
-- NO lo quita. Hace falta el revoke explícito a `anon`.
revoke all on function public.censo_marcar_procesado(text, text) from public;
revoke execute on function public.censo_marcar_procesado(text, text) from anon;
grant execute on function public.censo_marcar_procesado(text, text) to authenticated;
