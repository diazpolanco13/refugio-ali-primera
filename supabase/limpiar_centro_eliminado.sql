-- Migración `limpiar_centro_eliminado` (aplicada 17-jul-2026 vía MCP).
-- Al borrar (suave) un centro, un trigger limpia lo que cuelga de él:
--   1. lo quita de perfiles.centros_asignados (chips fantasma en /usuarios;
--      el admin podría vía RLS pero el analista no — por eso es trigger
--      SECURITY DEFINER y no código de frontend);
--   2. revoca sus tokens de terreno (doble seguro: login-terreno ya rechaza
--      centros con deleted=true, esto además apaga el QR en la tabla).
-- No hay caso inverso: si el centro se restaura (deleted=false), los
-- tokens/asignaciones se re-otorgan a mano.
--
-- Verificado: insertar centro de prueba (centros_generar_tokens creó sus 2
-- tokens) → update deleted=true → ambos tokens quedaron activo=false.

create or replace function public.limpiar_centro_eliminado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted = true and coalesce(old.deleted, false) = false then
    update public.perfiles
      set centros_asignados = array_remove(centros_asignados, new.id)
      where new.id = any(centros_asignados);
    update public.tokens_centros
      set activo = false
      where centro_id = new.id and activo;
  end if;
  return new;
end;
$$;

-- Trigger function: nadie la llama directo; revocar EXECUTE igual
-- (gotcha: CREATE OR REPLACE re-otorga a PUBLIC — ver CLAUDE.md).
revoke execute on function public.limpiar_centro_eliminado() from public, anon, authenticated;

drop trigger if exists centros_limpiar_eliminado on public.centros;
create trigger centros_limpiar_eliminado
  after update of deleted on public.centros
  for each row
  execute function public.limpiar_centro_eliminado();
