-- Campamento sandbox para desarrollo y pruebas (id fijo `centro-prueba`).
-- Solo visible para rol `admin`; excluido de parte numérico, KPIs, PDF y Telegram.
--
-- Aplicar en Supabase SQL Editor o: psql $DATABASE_URL -f supabase/centro_prueba_sandbox.sql

insert into public.centros (id, updated_at, updated_by, deleted, data, geom)
values (
  'centro-prueba',
  (extract(epoch from now()) * 1000)::bigint,
  'sistema',
  false,
  jsonb_build_object(
    'id', 'centro-prueba',
    'nro', 0,
    'nombre', 'Campamento Sandbox (PRUEBA)',
    'es_prueba', true,
    'grupo', 'Área Metropolitana',
    'cuerpo', 'SEBIN',
    'parroquia', 'Catedral',
    'direccion', 'Solo pruebas de desarrollo — no es un campamento real',
    'mapsUrl', 'https://www.google.com/maps?q=10.506098,-66.914527',
    'geom', jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array(-66.914527, 10.506098)),
    'notas', 'Datos ficticios. No contabiliza en la red operativa.',
    'fecha_levantamiento', to_char(current_date, 'YYYY-MM-DD'),
    'estado_federativo', 'Distrito Capital',
    'municipio', 'Libertador',
    'coord_politico', jsonb_build_object('ente', '', 'cedula', '', 'nombre', '', 'telefono', ''),
    'coord_ministerial', jsonb_build_object('ente', 'Desarrollo', 'cedula', '', 'nombre', 'Equipo técnico', 'telefono', ''),
    'seguridad', jsonb_build_object('cedula', '', 'nombre', '', 'telefono', '', 'organismo', '', 'vehiculos', 0, 'personal_mando', 0),
    'servicios', jsonb_build_object('medicos', true, 'psicologo', false, 'ambulancias', false, 'contacto_juez_paz', null),
    'total_afectados', 42,
    'censo_en_proceso', false,
    'novedades', 'Campamento de prueba para desarrollo.',
    'supervision', jsonb_build_object('telefono', '', 'unidad_sebin', 'dir_reg', 'supervisor_sebin', ''),
    'requerimientos', '[]'::jsonb,
    'capacidad', jsonb_build_object(
      'agua_litros', 5000, 'agua_tanque', true, 'agua_operativa', true,
      'camas_instaladas', 50, 'camas_operativas', 45,
      'duchas_instaladas', 8, 'duchas_operativas', 6,
      'pocetas_instaladas', 6, 'pocetas_operativas', 5,
      'lavaderos_instalados', 2, 'lavaderos_operativos', 2,
      'contenedores_instalados', 4, 'contenedores_operativos', 4
    ),
    'ocupacion', jsonb_build_object(
      'recien_nacidos_h', 1, 'recien_nacidos_m', 0,
      'ninos', 4, 'ninas', 3,
      'adolescentes_h', 2, 'adolescentes_m', 2,
      'adultos_h', 10, 'adultos_m', 12,
      'adultos_mayores_h', 2, 'adultos_mayores_m', 3,
      'embarazadas', 1,
      'discapacidad_h', 1, 'discapacidad_m', 1,
      'mascotas', 2
    ),
    'personal', jsonb_build_object(
      'funcionarios', 5, 'trabajadores', 2,
      'medicos', 1, 'psicologos', 0,
      'justicia_tjs', 0, 'justicia_mp', 0, 'justicia_defensoria', 0
    ),
    'familias_ocupadas', 12,
    'responsables', jsonb_build_array(
      jsonb_build_object('nombre', 'Responsable Prueba', 'telefono', '04120000000', 'rol', 'coordinador')
    ),
    'responsables_coordinacion', '[]'::jsonb,
    'foto_url', '',
    'estado', 'operativo',
    'deleted', false,
    'updated_at', (extract(epoch from now()) * 1000)::bigint,
    'updated_by', 'sistema'
  ),
  ST_SetSRID(ST_MakePoint(-66.914527, 10.506098), 4326)::geography
)
on conflict (id) do update set
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by,
  deleted = false,
  data = excluded.data,
  geom = excluded.geom;

-- Snapshot inicial de ocupación (opcional; el frontend también escribe al editar).
insert into public.ocupaciones_centros (
  centro_id, dia, ts, total_afectados, familias, personal_total, ocupacion, updated_at, updated_by
)
values (
  'centro-prueba',
  current_date,
  (extract(epoch from now()) * 1000)::bigint,
  42,
  12,
  8,
  (select data->'ocupacion' from public.centros where id = 'centro-prueba'),
  (extract(epoch from now()) * 1000)::bigint,
  'sistema'
)
on conflict (centro_id, dia) do update set
  total_afectados = excluded.total_afectados,
  familias = excluded.familias,
  personal_total = excluded.personal_total,
  ocupacion = excluded.ocupacion,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

select id, data->>'nombre' as nombre, data->>'es_prueba' as es_prueba
from public.centros
where id = 'centro-prueba';
