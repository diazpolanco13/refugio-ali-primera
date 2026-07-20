-- ============================================================================
-- Identidad de operadores de terreno — Fase A (migración
-- `identidad_operadores_fase_a`, aplicada el 16-jul-2026).
-- Referencia versionada; la fuente de verdad es la migración en Supabase.
-- Plan completo: docs/plan-identidad-terreno.md.
--
-- Qué hace:
--   1. `perfiles` gana la identidad por cédula: `cedula_norm` (solo dígitos,
--      única por operador → una persona = un usuario `op-<cedula_norm>`),
--      `verificado_nexus` (el nombre salió de Nexus, no fue tecleado) y la
--      bandeja de aprobación `aprobacion` / `aprobacion_por` / `aprobacion_ts`
--      (decisión (b): los analistas aprueban a posteriori, sin bloquear el
--      trabajo; un rechazo bloquea el próximo login en `login-terreno`).
--   2. Helper `mi_identidad()` (patrón mi_hash_id) para que el propio usuario
--      NO pueda tocar su cédula/verificación/aprobación al editar su perfil.
--   3. RLS: `analista_sae` ve y gestiona perfiles de rol `operador` (la
--      bandeja `/usuarios/terreno`), sin poder sacarlos de ese rol.
--   4. `app_secrets`: tabla RLS deny-all que solo lee la service role de las
--      Edge Functions (guarda `nexus_gateway_secret` para que `login-terreno`
--      consulte el gateway Nexus server-side con X-Gateway-Secret).
--
-- ⚠️ Gotcha de siempre: tras CUALQUIER `create or replace function` verificar
-- los grants EXECUTE (se resetean a PUBLIC). Ver docs/traspaso.md.
-- ============================================================================

alter table public.perfiles
  add column if not exists cedula_norm text,
  add column if not exists verificado_nexus boolean not null default false,
  add column if not exists aprobacion text
    check (aprobacion in ('pendiente','aprobada','rechazada')),
  add column if not exists aprobacion_por text,
  add column if not exists aprobacion_ts bigint;

comment on column public.perfiles.cedula_norm is
  'Cédula normalizada (V12345678). Única por operador: una persona = un usuario.';
comment on column public.perfiles.aprobacion is
  'Bandeja de identificaciones de terreno: pendiente/aprobada/rechazada. NULL = usuario de oficina (no aplica).';

create unique index if not exists perfiles_cedula_norm_operador_uq
  on public.perfiles (cedula_norm)
  where rol = 'operador' and cedula_norm is not null;

create or replace function public.mi_identidad()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cedula_norm', cedula_norm,
    'verificado_nexus', verificado_nexus,
    'aprobacion', aprobacion
  ) from public.perfiles where user_id = auth.uid()
$$;

revoke execute on function public.mi_identidad() from public, anon;
grant execute on function public.mi_identidad() to authenticated;

drop policy if exists perfiles_select on public.perfiles;
drop policy if exists perfiles_update on public.perfiles;

create policy perfiles_select on public.perfiles
  for select to authenticated
  using (
    (select public.mi_rol()) = 'admin'
    or auth.uid() = user_id
    or ((select public.mi_rol()) = 'analista_sae' and rol = 'operador')
  );

create policy perfiles_update on public.perfiles
  for update to authenticated
  using (
    (select public.mi_rol()) = 'admin'
    or auth.uid() = user_id
    or ((select public.mi_rol()) = 'analista_sae' and rol = 'operador')
  )
  with check (
    (select public.mi_rol()) = 'admin'
    -- analista solo gestiona operadores y no puede ascenderlos de rol
    or ((select public.mi_rol()) = 'analista_sae' and rol = 'operador' and auth.uid() <> user_id)
    or (
      auth.uid() = user_id
      and rol = (select public.mi_rol())
      and centros_asignados = (select public.mis_centros())
      and hash_id is not distinct from (select public.mi_hash_id())
      and cedula_norm is not distinct from ((select public.mi_identidad())->>'cedula_norm')
      and verificado_nexus = (((select public.mi_identidad())->>'verificado_nexus')::boolean)
      and aprobacion is not distinct from ((select public.mi_identidad())->>'aprobacion')
    )
  );

-- Secretos de servidor (solo service role; RLS sin policies = nadie entra).
create table if not exists public.app_secrets (
  clave text primary key,
  valor text not null,
  actualizado_ts bigint
);
alter table public.app_secrets enable row level security;
revoke all on table public.app_secrets from public, anon, authenticated;

-- El valor de `nexus_gateway_secret` se insertó aparte (nunca en migraciones);
-- vive también en /etc/dokploy/nexus-vpn/env.secret (PROXY_SECRET).
