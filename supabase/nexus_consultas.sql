-- Referencia de la migración `nexus_consultas_cache` (aplicada 10-jul-2026).
-- Caché de consultas al gateway Nexus (respuesta slim del censo).
-- Evita re-consultar el endpoint institucional por la misma cédula y permite
-- verificar aunque la VPN esté caída. Solo sesiones autenticadas (mismo
-- alcance que el gateway, que igual responde a cualquier JWT válido).

create table public.nexus_consultas (
  letra text not null default 'V',
  cedula text not null,
  data jsonb not null,
  actualizado_ts bigint not null,
  actualizado_por text,
  primary key (letra, cedula)
);

alter table public.nexus_consultas enable row level security;

create policy nexus_consultas_select on public.nexus_consultas
  for select to authenticated using (true);
create policy nexus_consultas_insert on public.nexus_consultas
  for insert to authenticated with check (true);
create policy nexus_consultas_update on public.nexus_consultas
  for update to authenticated using (true) with check (true);

revoke all on public.nexus_consultas from anon;
