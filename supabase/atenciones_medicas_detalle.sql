-- Detalle de atenciones médicas por reporte diario (xzwifkckkakldnzkdeby).
--
-- Array jsonb de casos individuales: nombre, cédula, edad, tipo_atencion,
-- síntomas, diagnóstico. La columna `atenciones_medicas` (int) se mantiene
-- sincronizada con array.length para gráficos y filas legacy.

alter table public.reportes_centros
  add column if not exists atenciones_medicas_detalle jsonb not null default '[]'::jsonb;
