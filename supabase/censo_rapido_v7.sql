-- Censo rápido v7 — eliminar registro desde la planilla pública.
--
-- Complementa censo_rapido_v6 (censo_actualizar). Permite al operador en
-- campo borrar un registro erróneo del mismo refugio.

create or replace function public.censo_eliminar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.censo_registros r where r.id = p_id) then
    raise exception 'Registro no encontrado';
  end if;

  delete from public.censo_registros where id = p_id;
end;
$$;

revoke all on function public.censo_eliminar(uuid) from public;
grant execute on function public.censo_eliminar(uuid) to anon, authenticated;
