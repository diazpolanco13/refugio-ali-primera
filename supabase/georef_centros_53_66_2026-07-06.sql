-- Georreferencia centros 53–66 (14 campamentos agregados al reporte 06-jul-2026).
-- Fuentes: OpenStreetMap/Nominatim, Photon, direcciones del reporte oficial y prensa.
-- Aplicado vía MCP execute_sql el 06-jul-2026.

UPDATE centros c
SET
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'admin',
  geom = ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)::geography,
  data = jsonb_set(
    jsonb_set(
      jsonb_set(
        c.data,
        '{geom}',
        jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array(m.lng, m.lat)),
        true
      ),
      '{direccion}',
      to_jsonb(COALESCE(NULLIF(c.data->>'direccion', ''), m.direccion)),
      true
    ),
    '{mapsUrl}',
    to_jsonb('https://www.google.com/maps?q=' || m.lat || ',' || m.lng),
    true
  )
FROM (VALUES
  ('centro-53', 10.4733015, -66.898632, 'Gimnasio Vertical, Av. Intercomunal de El Valle, El Valle, Caracas'),
  ('centro-54', 10.4780435, -66.9080905, 'UEN Gran Colombia — Edif. Bolivia, Av. Ayacucho, Santa Rosalía, Caracas'),
  ('centro-55', 10.4927778, -66.8044444, 'Coliseo La Urbina, Prolongación Av. El Samán, La Urbina, Petare'),
  ('centro-56', 10.5108370, -66.9536397, 'Ciudadela de Catia 2, Av. Lomas de Urdaneta, Catia, Caracas'),
  ('centro-57', 10.4940810, -66.9184370, 'Gimnasio Vertical Santa Teresa, Quinta Crespo, Caracas'),
  ('centro-58', 10.5096263, -66.9301135, 'San Pedro Claver, Calle Ayacucho, 23 de Enero, Caracas'),
  ('centro-59', 10.5111432, -66.8902384, 'GBM Pinto Salinas, Gimnasio Vertical, Maripérez, Caracas'),
  ('centro-60', 10.4976248, -66.9335190, 'UEN Zoe Xiques Silva, Av. José Ángel Lamas, San Juan, Caracas'),
  ('centro-61', 10.5168716, -66.8996855, 'Estacionamiento Hotel Ávila, Av. George Washington, San Bernardino, Caracas'),
  ('centro-62', 10.5063638, -66.9154010, 'PSUV Caracas, Casa Amarilla, Av. Oeste, El Silencio, Caracas'),
  ('centro-63', 10.4854692, -67.0030363, 'CMAPP El Junquito, El Junquito, Caracas'),
  ('centro-64', 10.4597444, -67.0894220, 'UNES del Junquito, Vía Principal de El Junquito, Caracas'),
  ('centro-65', 10.5146988, -66.8963917, 'Complejo Cultural y Deportivo Guayana Esequiba, Av. Los Próceres, San Bernardino, Caracas'),
  ('centro-66', 10.4284278, -66.9767301, 'Gran Base de Misiones de Paz Caricuao, Gimnasio Vertical, UD-4 Caricuao, Caracas')
) AS m(centro_id, lat, lng, direccion)
WHERE c.id = m.centro_id
  AND c.deleted = false;
