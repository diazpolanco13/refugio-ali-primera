-- Referencia de la migración `incidentes_servicios` (aplicada 18-jul-2026).
-- Estado del sistema (Fase 1): la vista /estado de la app y el banner público
-- de /censo y /terreno se alimentan de esta tabla.
--
-- Quién escribe: SOLO la Edge Function `registrar-incidente` (service_role;
-- no hay policies de insert/update/delete). El vigilante del VPS
-- (/opt/vigilante-nexus/vigilante-nexus.sh) la llama en cada transición de
-- estado de Nexus con el secret `app_secrets.vigilante_incidentes_secret`
-- (config en /opt/vigilante-nexus/config-incidentes.env).
-- Quién lee: admin / analista_sae / autoridad / supervisor (RLS); sin
-- operador ni censo_rapido. El público solo los incidentes ABIERTOS vía
-- la RPC estado_servicios_publico() (sin PII).

create table public.incidentes_servicios (
  id uuid primary key default gen_random_uuid(),
  servicio text not null,
  tipo text not null default 'externo' check (tipo in ('externo', 'plataforma')),
  estado text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
  causa text,
  detalle jsonb not null default '{}'::jsonb,
  inicio_ts bigint not null,
  fin_ts bigint,
  updated_at bigint not null
);

-- Un solo incidente abierto por servicio (idempotencia del vigilante).
create unique index incidentes_servicios_abierto_uq
  on public.incidentes_servicios (servicio)
  where estado = 'abierto';

create index incidentes_servicios_inicio_idx
  on public.incidentes_servicios (inicio_ts desc);

alter table public.incidentes_servicios enable row level security;

create policy incidentes_servicios_select on public.incidentes_servicios
  for select to authenticated
  using ((select mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'supervisor'));

alter publication supabase_realtime add table public.incidentes_servicios;

-- RPC pública mínima (banner en /censo y /terreno, sin sesión): solo los
-- incidentes abiertos, sin PII. Excepción legítima de acceso anon, como
-- terreno_centro(). ⚠️ Si se recrea, repetir revoke/grant (gotcha EXECUTE
-- a PUBLIC documentado en docs/traspaso.md).
create or replace function public.estado_servicios_publico()
returns table (servicio text, tipo text, causa text, inicio_ts bigint)
language sql
security definer
set search_path = public
stable
as $$
  select servicio, tipo, causa, inicio_ts
  from public.incidentes_servicios
  where estado = 'abierto'
$$;

revoke all on function public.estado_servicios_publico() from public;
grant execute on function public.estado_servicios_publico() to anon, authenticated;

-- Secret server-to-server del vigilante (VPS -> Edge Function).
insert into public.app_secrets (clave, valor, actualizado_ts)
values (
  'vigilante_incidentes_secret',
  encode(gen_random_bytes(24), 'hex'),
  (extract(epoch from now()) * 1000)::bigint
)
on conflict (clave) do nothing;
