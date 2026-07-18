-- Campamentos cuyas alertas Telegram están silenciadas para el operador
-- (sigue asignado; solo deja de recibir recordatorios de esos centros).
-- Migración: perfiles_alertas_silenciadas

alter table public.perfiles
  add column if not exists alertas_silenciadas text[] not null default '{}';

comment on column public.perfiles.alertas_silenciadas is
  'IDs de campamentos cuyas alertas Telegram están silenciadas. Requiere vínculo Telegram; la suscripción al centro (centros_asignados) se mantiene.';
