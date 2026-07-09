-- Reabrir censo: elimina cierres declarados del campamento.
-- Solo admin / analista SAE (sesión autenticada).
-- Migración remota: censo_reabrir (vía MCP apply_migration).

create or replace function public.censo_reabrir(p_centro_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrados int;
begin
  if (select public.mi_rol()) not in ('admin', 'analista_sae') then
    raise exception 'Acceso denegado';
  end if;

  if not exists (
    select 1 from public.centros c
    where c.id = p_centro_id and not c.deleted
  ) then
    raise exception 'Refugio inválido';
  end if;

  delete from public.censo_cierres
  where centro_id = p_centro_id;

  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

revoke all on function public.censo_reabrir(text) from public;
grant execute on function public.censo_reabrir(text) to authenticated;
