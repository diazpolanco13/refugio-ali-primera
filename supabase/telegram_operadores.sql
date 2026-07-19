-- ============================================================================
-- Vínculo Telegram de operadores — Fase B (migración
-- `telegram_operadores_fase_b`, aplicada el 16-jul-2026).
-- Referencia versionada; la fuente de verdad es la migración en Supabase.
-- Plan: docs/plan-identidad-terreno.md. Bot: @camp_inteligent_bot.
--
-- Circuito completo:
--   1. Operador identificado (op-<cedula>) toca "Vincular Telegram" en
--      /terreno → RPC `telegram_generar_vinculo()` emite un token de un solo
--      uso (1h) → deep-link t.me/camp_inteligent_bot?start=<token>.
--   2. Telegram entrega el /start al webhook (Edge Function `telegram-bot`,
--      verify_jwt false, autenticada con X-Telegram-Bot-Api-Secret-Token
--      contra app_secrets.telegram_webhook_secret).
--   3. La función consume el token y upserta `telegram_operadores`
--      (primer casamiento gana: unique en user_id Y en chat_id), registra
--      `vincular_telegram` en historial y confirma por el chat.
--
-- Secrets en `app_secrets`: telegram_bot_token, telegram_webhook_secret
-- (copia del token también en /etc/dokploy/campamento-bot.env).
-- ⚠️ Recordar el gotcha: CREATE OR REPLACE resetea EXECUTE a PUBLIC.
-- ============================================================================

-- chat_id SIN unique desde la migración `telegram_chat_multiusuario`
-- (16-jul): la misma persona suele tener cuenta permanente (admin/analista/
-- supervisor) + identidad de terreno op-<cedula>, y un solo Telegram. La
-- protección anti-suplantación se mantiene: cada USUARIO tiene un único chat
-- (user_id PK) y re-vincular un usuario a otro chat sigue bloqueado. Los
-- callbacks "No fui yo" llevan el user_id (`nofui:<uuid>`) por esto mismo.
create table if not exists public.telegram_operadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cedula_norm text,
  chat_id bigint not null,
  telegram_username text,
  telegram_nombre text,
  verificado_ts bigint not null
);
create index if not exists telegram_operadores_chat_idx on public.telegram_operadores (chat_id);

alter table public.telegram_operadores enable row level security;

create policy telegram_operadores_select on public.telegram_operadores
  for select to authenticated
  using (
    auth.uid() = user_id
    or (select public.mi_rol()) in ('admin', 'analista_sae')
  );

-- Desvincular (migración `telegram_desvincular_self`, 19-jul): el propio
-- usuario borra SU fila desde /terreno; admin/analista cualquier fila desde
-- la bandeja /usuarios/terreno. Re-vincular queda libre después.
create policy telegram_operadores_delete on public.telegram_operadores
  for delete to authenticated
  using (
    auth.uid() = user_id
    or (select public.mi_rol()) in ('admin', 'analista_sae')
  );

create table if not exists public.telegram_vinculos (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  creado_ts bigint not null,
  expira_ts bigint not null,
  usado_ts bigint
);
create index if not exists telegram_vinculos_user_idx on public.telegram_vinculos (user_id);
alter table public.telegram_vinculos enable row level security;
revoke all on table public.telegram_vinculos from public, anon, authenticated;

-- p_user_id agregado el 19-jul (migración `telegram_vinculo_para_usuario`):
-- admin/analista_sae generan el enlace PARA otro usuario (tarjeta en
-- /usuarios/:id/editar, se comparte por WhatsApp); sin argumento sigue el
-- flujo self-service (/terreno y Preferencias de cuenta).
create or replace function public.telegram_generar_vinculo(p_user_id uuid default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_target uuid;
  v_token text;
  v_ahora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if v_caller is null then
    raise exception 'Requiere sesión';
  end if;
  v_target := coalesce(p_user_id, v_caller);
  if v_target <> v_caller
     and (select public.mi_rol()) not in ('admin', 'analista_sae') then
    raise exception 'Solo admin o analista SAE pueden generar el vínculo de otro usuario';
  end if;
  if not exists (select 1 from public.perfiles where user_id = v_target) then
    raise exception 'Usuario sin perfil';
  end if;
  if exists (select 1 from public.telegram_operadores where user_id = v_target) then
    raise exception 'Este usuario ya tiene Telegram vinculado';
  end if;

  delete from public.telegram_vinculos
    where user_id = v_target and usado_ts is null;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.telegram_vinculos (token, user_id, creado_ts, expira_ts)
    values (v_token, v_target, v_ahora, v_ahora + 60 * 60 * 1000);
  return v_token;
end;
$$;

revoke execute on function public.telegram_generar_vinculo(uuid) from public, anon;
grant execute on function public.telegram_generar_vinculo(uuid) to authenticated;

-- Webhook registrado con:
--   POST https://api.telegram.org/bot<token>/setWebhook
--   url = https://xzwifkckkakldnzkdeby.supabase.co/functions/v1/telegram-bot
--   secret_token = app_secrets.telegram_webhook_secret
--   allowed_updates = ["message"]
