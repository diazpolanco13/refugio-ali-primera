-- ============================================================================
-- Gate de vinculación Telegram en /terreno (migración `gate_telegram_terreno`,
-- aplicada el 19-jul-2026). Referencia versionada; la fuente de verdad es la
-- migración en Supabase.
--
-- Problema: solo un pequeño porcentaje de operadores vinculaba su Telegram, y
-- sin vínculo no reciben alertas de seguridad ni recordatorios de partes.
--
-- Solución (plan 1, decisión 19-jul): tras identificarse con cédula en
-- /terreno, si no hay fila en `telegram_operadores` se muestra una pantalla
-- de vinculación obligatoria (`GateTelegramTerreno.tsx`) con gracia limitada:
-- 3 entradas «Continuar sin vincular» y luego gate duro. El contador vive en
-- el SERVIDOR (`perfiles.entradas_sin_telegram`) porque la app de campo borra
-- caché/localStorage con frecuencia («Borrar caché y actualizar»).
--
-- Frontend: GateTelegramTerreno.tsx + helpers en src/data/telegramOperador.ts
-- (GRACIA_TELEGRAM_MAX, entradasSinTelegram, omitirVinculoTelegram) + wiring
-- en TerrenoView (`requiereGateTelegram`; solo operadores por cédula, los
-- legacy compartidos quedan fuera).
--
-- ⚠️ Gotcha: CREATE OR REPLACE resetea EXECUTE a PUBLIC (verificado tras
-- aplicar: mi_identidad y terreno_omitir_telegram solo authenticated).
-- ============================================================================

alter table public.perfiles
  add column if not exists entradas_sin_telegram int not null default 0;

-- mi_identidad() congela un campo más en el check de perfiles_update: el
-- operador NO puede resetear su propio contador vía update directo.
create or replace function public.mi_identidad()
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'cedula_norm', cedula_norm,
    'verificado_nexus', verificado_nexus,
    'aprobacion', aprobacion,
    'entradas_sin_telegram', entradas_sin_telegram
  ) from public.perfiles where user_id = auth.uid()
$$;

-- perfiles_update recreada igual que en `identidad_operadores_fase_a` + la
-- inmutabilidad de entradas_sin_telegram en el self-update. Admin todo;
-- analista_sae puede corregir filas de operadores (incluye resetear gracia).
drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (
    (select public.mi_rol()) = 'admin'
    or auth.uid() = user_id
    or ((select public.mi_rol()) = 'analista_sae' and rol = 'operador')
  )
  with check (
    (select public.mi_rol()) = 'admin'
    or ((select public.mi_rol()) = 'analista_sae' and rol = 'operador' and auth.uid() <> user_id)
    or (
      auth.uid() = user_id
      and rol = (select public.mi_rol())
      and centros_asignados = (select public.mis_centros())
      and not (hash_id is distinct from (select public.mi_hash_id()))
      and not (cedula_norm is distinct from ((select public.mi_identidad()) ->> 'cedula_norm'))
      and verificado_nexus = (((select public.mi_identidad()) ->> 'verificado_nexus'))::boolean
      and not (aprobacion is distinct from ((select public.mi_identidad()) ->> 'aprobacion'))
      and not (entradas_sin_telegram is distinct from (((select public.mi_identidad()) ->> 'entradas_sin_telegram'))::int)
    )
  );

-- Consume una entrada de gracia (solo si aún no hay vínculo Telegram).
-- Devuelve el total de entradas sin vincular ya consumidas.
create or replace function public.terreno_omitir_telegram()
returns int
language plpgsql security definer
set search_path to ''
as $$
declare
  v_user uuid := auth.uid();
  v_n int;
begin
  if v_user is null then
    raise exception 'Requiere sesión';
  end if;
  if exists (select 1 from public.telegram_operadores where user_id = v_user) then
    return 0; -- ya vinculado: no consume gracia
  end if;
  update public.perfiles
    set entradas_sin_telegram = coalesce(entradas_sin_telegram, 0) + 1
    where user_id = v_user
    returning entradas_sin_telegram into v_n;
  return coalesce(v_n, 0);
end;
$$;

revoke execute on function public.terreno_omitir_telegram() from public, anon;
grant execute on function public.terreno_omitir_telegram() to authenticated;
revoke execute on function public.mi_identidad() from public, anon;
grant execute on function public.mi_identidad() to authenticated;
