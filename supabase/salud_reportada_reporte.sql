-- Marca explícita para indicar que la sección Salud fue revisada en el reporte
-- diario, incluso cuando no hubo atenciones médicas que registrar.

alter table public.reportes_centros
  add column if not exists salud_reportada boolean not null default false;

update public.reportes_centros
set salud_reportada = true
where
  coalesce(atenciones_medicas, 0) > 0
  or (
    jsonb_typeof(atenciones_medicas_detalle) = 'array'
    and jsonb_array_length(atenciones_medicas_detalle) > 0
  )
  or btrim(coalesce(observaciones, '')) <> '';
