-- Fuente: campamentos_consolidado_estados.md — sección Caracas/Miranda (2026-07-15)
-- Emparejamiento manual centro_id ↔ fila del MD (nombres en Supabase pueden variar).
-- Vacío = sin organismo conocido (— / No asignado / campamento fuera del MD).

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
  -- MD #1  GBM El Valle
  ('centro-53', 'Guardia del Pueblo', 'Guardia del Pueblo'),
  -- MD #2  GBM Caricuao
  ('centro-66', 'GNB', 'GNB'),
  -- MD #3  U.E.N Josefa Irasquin López → UEN Josefa Irausquin Lopez, El Cafetal
  ('centro-37', 'Poli Baruta', 'Poli Baruta'),
  -- MD #4  CEN Simoncito Mamá Rosa → CEIN Mamá Rosa, Urb La Limonera
  ('centro-36', 'GNB', 'GNB'),
  -- MD #5  UE Juan Antonio Pérez Bonalde → UED Juan Antonio Perez Bonalde
  ('centro-34', 'PoliCaracas', 'PoliCaracas'),
  -- MD #6  UEN Juan Landaeta → Liceo Juan Landaeta
  ('centro-16', 'CICPC', 'CICPC'),
  -- MD #7  Complejo José Gervasio Artigas → UE Gervacio Artigas
  ('centro-17', 'CICPC', 'CICPC'),
  -- MD #8  Liceo Juan Lovera
  ('centro-18', 'CICPC', 'CICPC'),
  -- MD #9  UEN Claudio Feliciano → CE Claudio Feliciano
  ('centro-19', 'CICPC', 'CICPC'),
  -- MD #10 Gimnasio Vertical Pinto Salinas → GBM Pinto Salinas
  ('centro-59', 'GNB', 'GNB'),
  -- MD #11 Liceo Miguel Antonio Caro → CE Miguel Antonio Caro
  ('centro-14', 'CICPC', 'CICPC'),
  -- MD #12 U.E. Armando Zuloaga → UEN Armando Zuluaga
  ('centro-13', 'DGCIM', 'DGCIM'),
  -- MD #13 Complejo Guayana Esequiba
  ('centro-65', 'PoliCaracas', 'PoliCaracas'),
  -- MD #14 ETI Leonardo Infante
  ('centro-09', 'SEBIN', 'SEBIN'),
  -- MD #15 UEN Mariano Picón Salas
  ('centro-10', 'SEBIN', 'SEBIN'),
  -- MD #16 Gimnasio Vertical Santa Teresa
  ('centro-57', 'GNB', 'GNB'),
  -- MD #17 San Pedro Claver — No asignado
  ('centro-58', '', ''),
  -- MD #18 UEN Luis Hurtado Higuera → UE Luis Hurtado
  ('centro-26', 'PNB', 'PNB'),
  -- MD #19 CMAPP El Junquito
  ('centro-63', 'GNB', 'GNB'),
  -- MD #20 UNES del Junquito
  ('centro-64', 'PNB', 'PNB'),
  -- MD #21 Escuela Nuestra América —
  ('centro-94', '', ''),
  -- MD #22 CEI Paula María Nieves → C.E.I. Paula María Nieves
  ('centro-95', '', ''),
  -- MD #23 UE Jesús Enrique Lozada → UE Jesús Enrique Lossada
  ('centro-11', 'SEBIN', 'SEBIN'),
  -- MD #24 UN Francisco Pimentel → UEN Francisco Pimentel
  ('centro-02', 'GNB', 'GNB'),
  -- MD #25 U.E.N. Pedro Emilio Coll → UEN Pedro Emilio Coll
  ('centro-01', 'GNB', 'GNB'),
  -- MD #26 Andrés Bello → CE Andres Bello
  ('centro-32', 'PoliCaracas', 'PoliCaracas'),
  -- MD #27 UENB Carlos Delgado Chalbaud
  ('centro-33', 'PoliCaracas', 'PoliCaracas'),
  -- MD #28 PSUV Caracas — No asignado (en BD: U.E.N VICENTE LANDAETA GIL, centro-62)
  ('centro-62', '', ''),
  -- MD #29 Gran Colombia 1 → Edif. Colombia
  ('centro-03', 'GNB', 'GNB'),
  -- MD #30 Gran Colombia 2 → Edif. Perú
  ('centro-51', 'GNB', 'GNB'),
  -- MD #31 Gran Colombia 3 → Edif. Ecuador
  ('centro-52', 'GNB', 'GNB'),
  -- MD #32 Gran Colombia 4 → Edif. Bolivia
  ('centro-54', 'GNB', 'GNB'),
  -- MD #33 UEN Vicente Gil
  ('centro-21', 'PNB', 'PNB'),
  -- MD #34 UE Luis Padrino
  ('centro-20', 'PNB', 'PNB'),
  -- MD #35 UEN Zoe Xiques Silva
  ('centro-60', 'GNB', 'GNB'),
  -- MD #36 Estacionamiento Hotel Ávila
  ('centro-61', 'PoliCaracas', 'PoliCaracas'),
  -- MD #37 UEN Maestra Judith Liendo → Liceo Judith Liendo
  ('centro-06', 'GNB', 'GNB'),
  -- MD #38 Liceo Leopoldo Aguerrevere
  ('centro-08', 'GNB', 'GNB'),
  -- MD #39 Escuela Nacional Artes Escénicas César Rengifo → UE Cesar Rengifo
  ('centro-12', 'SEBIN', 'SEBIN'),
  -- MD #40 E.T.I. Rafael Vegas —
  ('centro-93', '', ''),
  -- MD #41 UEN Dr. Guillermo Delgado Palacios → EBN Dr. Guillermo Delgado Palacios
  ('centro-05', 'GNB', 'GNB'),
  -- MD #42 Liceo José Ávalos → Liceo Jose Avalos
  ('centro-04', 'GNB', 'GNB'),
  -- MD #43 Coliseo La Urbina
  ('centro-55', 'Poli Sucre', 'Poli Sucre'),
  -- MD #44 Escuela Internacional Liderazgo Sucre
  ('centro-50', 'PNB', 'PNB'),
  -- MD #45 UEN Generalísimo Francisco de Miranda
  ('centro-45', 'Poli Sucre', 'Poli Sucre'),
  -- MD #46 UEN Rafael Napoleón Baute
  ('centro-43', 'Poli Sucre', 'Poli Sucre'),
  -- MD #47 CEN Negro Primero Caucagüita
  ('centro-44', 'Poli Sucre', 'Poli Sucre'),
  -- MD #48 UEN Eduardo Crema
  ('centro-27', 'PNB', 'PNB'),
  -- MD #49 UEN Pedro Fontes
  ('centro-25', 'PNB', 'PNB'),
  -- MD #50 UE José Ignacio Paz Castillo
  ('centro-24', 'PNB', 'PNB'),
  -- MD #51 Liceo Agustín Aveledo
  ('centro-23', 'PNB', 'PNB'),
  -- MD #52 Ciudadela Catia 2 → Ciudadela de Catia 2
  ('centro-56', 'PNB', 'PNB'),
  -- MD #53 UE Alejo Fortique → UEN Alejo Fortique
  ('centro-31', 'Poli Baruta', 'Poli Baruta'),
  -- MD #54 UEN Conopoima → EU Conopoima
  ('centro-41', 'Poli El Hatillo', 'Poli El Hatillo'),
  -- MD #55 UEN Lino de Clemente → CEIN Lino Clemente, Baruta
  ('centro-38', 'Poli Baruta', 'Poli Baruta'),
  -- MD #56 UEN El Libertador (Chacao) → UEN EI Libertador
  ('centro-40', 'PoliChacao', 'PoliChacao'),
  -- MD #57 UEN Jesús María Alfaro Zamora → UEN Jesús Maria Alfaro, Cafetal
  ('centro-39', 'Poli Baruta', 'Poli Baruta'),
  -- MD #58 CEN Luis Beltrán Prieto Figuera
  ('centro-42', 'Poli Sucre', 'Poli Sucre'),
  -- MD #59 UEE Adolfo Navas Coronado → UEE Adolfo Nava Coronado
  ('centro-30', 'Poli Baruta', 'Poli Baruta'),
  -- MD #60 Unidad Educativa Tito Salas → UEN Tito Salas
  ('centro-28', 'Poli Baruta', 'Poli Baruta'),
  -- MD #61 UEN Sorocaima
  ('centro-29', 'Poli Baruta', 'Poli Baruta'),
  -- MD #62 CEN Ana María Campos
  ('centro-46', 'Poli Miranda', 'Poli Miranda'),
  -- MD #63 Unidad Educ. Estadal Francisco Iznardi → CEN Francisco Iznardi
  ('centro-48', 'Poli Miranda', 'Poli Miranda'),
  -- MD #64 UEN Dr. José de Jesús Arocha
  ('centro-49', 'Poli Miranda', 'Poli Miranda')
) AS m(centro_id, cuerpo, org_json)
WHERE c.id = m.centro_id
  AND c.deleted = false;

-- Campamentos fuera del MD (La Guaira, otros): sin organismo conocido.
UPDATE centros c
SET
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'admin',
  data = jsonb_set(
    jsonb_set(
      c.data,
      '{cuerpo}',
      to_jsonb(''::text),
      true
    ),
    '{seguridad}',
    COALESCE(c.data->'seguridad', '{}'::jsonb) || jsonb_build_object('organismo', ''),
    true
  )
WHERE c.deleted = false
  AND c.id NOT IN (
    SELECT centro_id FROM (VALUES
      ('centro-53'), ('centro-66'), ('centro-37'), ('centro-36'), ('centro-34'),
      ('centro-16'), ('centro-17'), ('centro-18'), ('centro-19'), ('centro-59'),
      ('centro-14'), ('centro-13'), ('centro-65'), ('centro-09'), ('centro-10'),
      ('centro-57'), ('centro-58'), ('centro-26'), ('centro-63'), ('centro-64'),
      ('centro-94'), ('centro-95'), ('centro-11'), ('centro-02'), ('centro-01'),
      ('centro-32'), ('centro-33'), ('centro-62'), ('centro-03'), ('centro-51'),
      ('centro-52'), ('centro-54'), ('centro-21'), ('centro-20'), ('centro-60'),
      ('centro-61'), ('centro-06'), ('centro-08'), ('centro-12'), ('centro-93'),
      ('centro-05'), ('centro-04'), ('centro-55'), ('centro-50'), ('centro-45'),
      ('centro-43'), ('centro-44'), ('centro-27'), ('centro-25'), ('centro-24'),
      ('centro-23'), ('centro-56'), ('centro-31'), ('centro-41'), ('centro-38'),
      ('centro-40'), ('centro-39'), ('centro-42'), ('centro-30'), ('centro-28'),
      ('centro-29'), ('centro-46'), ('centro-48'), ('centro-49')
    ) AS t(centro_id)
  )
  AND c.id NOT IN ('centro-prueba');
