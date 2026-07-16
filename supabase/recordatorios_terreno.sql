-- ============================================================================
-- Recordatorios de terreno por Telegram (migración `recordatorios_terreno_cron`,
-- aplicada el 16-jul-2026). Referencia versionada; la fuente de verdad es la
-- migración en Supabase. Horarios decididos por Carlos el 16-jul.
--
-- Circuito:
--   pg_cron (UTC = Venezuela + 4h) → net.http_post → Edge Function
--   `recordatorio-partes` (X-Cron-Secret contra app_secrets.cron_secret) →
--   bot @camp_inteligent_bot → DM a operadores con Telegram vinculado.
--
-- Mensajes:
--   - buenos_dias (7:00 VE): estado del reporte del día área por área
--     (Parte numérico · Control · Salud · Trabajos · Requerimientos ·
--     Novedades) + censo (censados vs parte, última actualización) + aviso
--     del recordatorio de las 11:00.
--   - recordatorio (11:00, 12:00, 13:00, 13:30 y cada 30 min hasta las
--     18:00 VE): SOLO a quien tenga áreas pendientes, listándolas. Sin
--     estado propio: cada disparo consulta la BD, así que al completar el
--     reporte dejan de llegar solos.
--
-- Sin Hermes a propósito: los recordatorios son deterministas (regla del
-- plan: validaciones en código; LLM solo para texto). La IA entra después en
-- la revisión de reportes y el resumen a analistas.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.resumen_terreno_centros(p_centros text[], p_dia date)
returns table (
  centro_id text,
  nombre text,
  parte_ok boolean,
  control_ok boolean,
  salud_ok boolean,
  trabajos_ok boolean,
  requerimientos_ok boolean,
  novedades_ok boolean,
  censados int,
  parte_personas int,
  censo_ts bigint
)
language sql stable
set search_path = ''
as $$
  select
    c.id,
    coalesce(c.data->>'nombre', c.id),
    exists (select 1 from public.ocupaciones_centros o where o.centro_id = c.id and o.dia = p_dia),
    exists (select 1 from public.reportes_control_dia rc where rc.centro_id = c.id and rc.dia = p_dia),
    coalesce(r.salud_reportada, false),
    coalesce(r.trabajos_revisados, false),
    coalesce(r.requerimientos_revisados, false),
    coalesce(r.eventos_revisados, false),
    coalesce(a.censados, 0)::int,
    coalesce((
      select o2.total_afectados from public.ocupaciones_centros o2
      where o2.centro_id = c.id order by o2.dia desc limit 1
    ), 0),
    a.censo_ts
  from public.centros c
  left join public.reportes_centros r on r.centro_id = c.id and r.dia = p_dia
  left join lateral (
    select count(*) as censados,
           max(greatest(coalesce(al.updated_at, 0), coalesce(al.creada_ts, 0))) as censo_ts
    from public.alojamientos_refugiados al
    where al.centro_id = c.id and al.estado = 'activo'
  ) a on true
  where c.id = any(p_centros) and c.deleted = false
$$;

revoke execute on function public.resumen_terreno_centros(text[], date) from public, anon, authenticated;
grant execute on function public.resumen_terreno_centros(text[], date) to service_role;

create or replace function public.disparar_recordatorio_terreno(p_modo text)
returns void
language sql
set search_path = ''
as $$
  select net.http_post(
    url := 'https://xzwifkckkakldnzkdeby.supabase.co/functions/v1/recordatorio-partes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select valor from public.app_secrets where clave = 'cron_secret')
    ),
    body := jsonb_build_object('modo', p_modo)
  );
$$;

revoke execute on function public.disparar_recordatorio_terreno(text) from public, anon, authenticated;

-- Horarios (cron en UTC; Venezuela = UTC-4):
select cron.schedule('terreno-buenos-dias',        '0 11 * * *',      $$select public.disparar_recordatorio_terreno('buenos_dias')$$);  -- 7:00 VE
select cron.schedule('terreno-recordatorio-11',    '0 15 * * *',      $$select public.disparar_recordatorio_terreno('recordatorio')$$); -- 11:00 VE
select cron.schedule('terreno-recordatorio-12',    '0 16 * * *',      $$select public.disparar_recordatorio_terreno('recordatorio')$$); -- 12:00 VE
select cron.schedule('terreno-recordatorio-13',    '0 17 * * *',      $$select public.disparar_recordatorio_terreno('recordatorio')$$); -- 13:00 VE
select cron.schedule('terreno-recordatorio-1330',  '30 17 * * *',     $$select public.disparar_recordatorio_terreno('recordatorio')$$); -- 13:30 VE
select cron.schedule('terreno-recordatorio-30min', '0,30 18-21 * * *',$$select public.disparar_recordatorio_terreno('recordatorio')$$); -- 14:00–17:30 VE
select cron.schedule('terreno-recordatorio-fin',   '0 22 * * *',      $$select public.disparar_recordatorio_terreno('recordatorio')$$); -- 18:00 VE (último)

-- Gestión: select * from cron.job;  ·  select cron.unschedule('<jobname>');
-- Log de corridas: select * from cron.job_run_details order by start_time desc limit 20;
