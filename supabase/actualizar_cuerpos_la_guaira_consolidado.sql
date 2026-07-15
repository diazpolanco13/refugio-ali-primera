-- Fuente: campamentos_consolidado_estados.md (2026-07-15)
-- La Guaira + La Lucha / Mare Abajo. Emparejamiento manual centro_id ↔ fila del MD.
-- Vacío: «No tiene», «No asignado», «—», FANB (no es cuerpo).
-- Doble organismo: cuerpo = primero listado; seguridad.organismo = texto completo del MD.

UPDATE centros c
SET
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'admin',
  data = jsonb_set(
    jsonb_set(
      c.data,
      '{cuerpo}',
      to_jsonb(m.cuerpo::text),
      true
    ),
    '{seguridad}',
    COALESCE(c.data->'seguridad', '{}'::jsonb) || jsonb_build_object('organismo', m.org_json),
    true
  )
FROM (VALUES
  ('centro-67', 'Armada Bolivariana', 'Armada Bolivariana'),
  ('centro-68', 'PNB', 'PNB / Ejército'),
  ('centro-69', 'GNB', 'GNB / PNB'),
  ('centro-70', 'GNB', 'GNB'),
  ('centro-71', 'GNB', 'GNB'),
  ('centro-72', 'GNB', 'GNB'),
  ('centro-73', 'GNB', 'GNB'),
  ('centro-74', 'GNB', 'GNB'),
  ('centro-75', 'GNB', 'GNB'),
  ('centro-76', '', ''),
  ('centro-77', 'Guardia del Pueblo', 'Guardia del Pueblo'),
  ('centro-78', 'GNB', 'GNB'),
  ('centro-79', 'GNB', 'GNB'),
  ('centro-80', 'Milicia', 'Milicia / Ejército'),
  ('centro-81', 'Ejército', 'Ejército'),
  ('centro-82', 'GNB', 'GNB'),
  ('centro-83', 'GNB', 'GNB'),
  ('centro-84', '', ''),
  ('centro-85', 'GNB', 'GNB'),
  ('centro-86', 'GNB', 'GNB'),
  ('centro-87', 'GNB', 'GNB'),
  ('centro-88', 'Armada Bolivariana', 'Armada'),
  ('centro-89', 'Armada Bolivariana', 'Armada'),
  ('centro-90', 'GNB', 'GNB'),
  ('centro-91', '', ''),
  ('centro-92', 'PNB', 'PNB'),
  ('79017db9-1e76-4157-a4b5-0c49c07b2daa', 'PNB', 'PNB'),
  ('039c414d-159a-412f-abc0-7668dd30ee26', 'GNB', 'GNB')
) AS m(centro_id, cuerpo, org_json)
WHERE c.id = m.centro_id
  AND c.deleted = false;
