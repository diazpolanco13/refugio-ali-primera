-- Soft-delete vía RPC: el UPDATE directo falla para analista_sae porque
-- PostgREST exige poder SELECT la fila resultante, y las eliminadas solo las
-- ve el admin. La RPC valida el rol y actualiza sin devolver la fila.
-- Referencia de la migración `denuncia_soft_delete_rpc`.

create or replace function public.denuncia_soft_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := public.mi_rol();
  v_user text := public.mi_username();
  v_updated int;
  v_ahora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_rol is distinct from 'admin' and v_rol is distinct from 'analista_sae' then
    raise exception 'No autorizado a eliminar denuncias';
  end if;

  update public.denuncias_centros
  set
    deleted = true,
    deleted_at = v_ahora,
    deleted_by = coalesce(v_user, v_rol),
    updated_at = v_ahora,
    updated_by = coalesce(v_user, v_rol)
  where id = p_id
    and deleted is not true;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Denuncia no encontrada o ya eliminada';
  end if;
end;
$$;

revoke all on function public.denuncia_soft_delete(uuid) from public;
grant execute on function public.denuncia_soft_delete(uuid) to authenticated;
