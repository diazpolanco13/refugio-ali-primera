-- Generado por scripts/importar_censo_oficial.py
-- Fusiona censo_oficial en centros.data. No pisa población si ya hay damnificados.
begin;

-- U.E.N.B. Coronel Carlos Delgado Chalbaud → UENB coronel Carlos Delgado Chalboud (centro-33) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 28, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Instituto Nacional de Hipodromos", "estatus_instalacion": "instalado", "capacidad_maxima": 450, "capacidad_instalada": 426}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-33'
  and coalesce(deleted, false) = false;

-- E.D Juan Antonio Perez Bonalde → UED Juan Antonio Perez Bonal (centro-34) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 32, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Comunicación e Información", "estatus_instalacion": "instalado", "capacidad_maxima": 200, "capacidad_instalada": 203}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-34'
  and coalesce(deleted, false) = false;

-- UE Jesus Enrique Losada → UE Jesús Enrique Lossada (centro-11) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 51, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para el Comercio Exterior", "estatus_instalacion": "instalado", "capacidad_maxima": 326, "capacidad_instalada": 208}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-11'
  and coalesce(deleted, false) = false;

-- Gimnasio Vertical (Pinto Salina) → GBM Pinto Salinas (Gimnasio Vertical) (centro-59) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 64, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 600, "capacidad_instalada": 600}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-59'
  and coalesce(deleted, false) = false;

-- Gimnasio Vertical (Quinta Crespo) → Gimnasio Vertical Santa Teresa (centro-57) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 65, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 400, "capacidad_instalada": 400}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-57'
  and coalesce(deleted, false) = false;

-- C.E.I.N. Mamá Rosa → CEIN Mamá Rosa, Urb La Limonera (centro-36) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 69, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Cancillería", "estatus_instalacion": "instalado", "capacidad_maxima": 50, "capacidad_instalada": 50}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-36'
  and coalesce(deleted, false) = false;

-- C.E.I.N. Lino de Clemente → CEIN Lino Clemente, Baruta (centro-38) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 70, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "IVSS", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 50, "capacidad_instalada": 60}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-38'
  and coalesce(deleted, false) = false;

-- U.E.N. Jesús María Alfaro Zamora → UEN Jesús Maria Alfaro, Cafetal (centro-39) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 73, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "INEA", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 50, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-39'
  and coalesce(deleted, false) = false;

-- C.E.N. Negro Primero → CEN Negro Primero Caucaguita (centro-44) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 76, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Obras Públicas", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 120, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-44'
  and coalesce(deleted, false) = false;

-- C.E.N. Ana María Campos → CEN Ana Maria Campos, Filas de Mariche (centro-46) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 77, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Sucre", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 120, "capacidad_instalada": 120}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-46'
  and coalesce(deleted, false) = false;

-- U.E.N. Rafael Napoleón Baute → UEN Rafael Napoleón Baite (centro-43) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 86, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "SUDEBAN", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 150, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-43'
  and coalesce(deleted, false) = false;

-- Refugio Para Adultos Y Adultas Mayores (Escuela Santa Eduvigis) → Refugio para Adultos y Adultas Mayores (Escuela Santa Eduvigis) (centro-77) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 10, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Abuelos y Frente Francisco de Miranda", "estatus_instalacion": "instalado", "capacidad_maxima": 173, "capacidad_instalada": 173}, "total_afectados": 57, "familias_ocupadas": 3}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-77'
  and coalesce(deleted, false) = false;

-- U.E.N. Generalísimo Francisco de Miranda → UEN Generalisimo Francisco de Miranda, Filas de Mariche (centro-45) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 78, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "SUNDEE", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 60, "capacidad_instalada": 60}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-45'
  and coalesce(deleted, false) = false;

-- Estacionamiento del Hotel Avila → Estacionamiento Hotel Ávila (centro-61) score=0.75
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 59, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 200, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-61'
  and coalesce(deleted, false) = false;

-- GBM Caricuao (Gimnasio Vertical) → GBM Caricuao (Gimnasio Vertical) (centro-66) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 62, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 400, "capacidad_instalada": 400}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-66'
  and coalesce(deleted, false) = false;

-- GBM El Valle (Gimnasio Vertical) → GBM El Valle (Gimnasio Vertical) (centro-53) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 63, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 400, "capacidad_instalada": 400}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-53'
  and coalesce(deleted, false) = false;

-- Ciudad Vacacional Los Caracas → Ciudad Vacacional Los Caracas (centro-91) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 12, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Vivienda", "estatus_instalacion": "instalado", "capacidad_maxima": 933, "capacidad_instalada": 933}, "total_afectados": 933}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-91'
  and coalesce(deleted, false) = false;

-- E.B.N Dr Guillermo Delgado Palacios → EBN Dr. Guillermo Delgado Palacios (centro-05) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 35, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "CANTV", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 200, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-05'
  and coalesce(deleted, false) = false;

-- C.E.N. Luis Beltrán Prieto Figueroa → CEN Luis Beltran Prieto Figueroa (centro-42) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 80, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "FVF", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 180, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-42'
  and coalesce(deleted, false) = false;

-- Canes Escuela De Grumetes → Escuela de Grumetes (Canes) (centro-67) score=0.83
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 1, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Deporte", "estatus_instalacion": "instalado", "capacidad_maxima": 480, "capacidad_instalada": 480}, "total_afectados": 422, "familias_ocupadas": 117}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-67'
  and coalesce(deleted, false) = false;

-- U.E.N Jose Ignacio Paz Castillo → UE Jose Ignacio Paz Castillo (centro-24) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 33, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Movilnet", "estatus_instalacion": "instalado", "capacidad_maxima": 130, "capacidad_instalada": 130}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-24'
  and coalesce(deleted, false) = false;

-- Complejo Guayana Esequiba → Complejo Guayana Esequiba (centro-65) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 56, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 296, "capacidad_instalada": 296}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-65'
  and coalesce(deleted, false) = false;

-- Gustavo Olivares Bosques → U.E.N. Gustavo Olivares Bosques (centro-74) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 23, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "FOGADES", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 400, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-74'
  and coalesce(deleted, false) = false;

-- Manuel Segundo Sanchez → E.N.B. Manuel Segundo Sánchez (centro-86) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 24, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 200, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-86'
  and coalesce(deleted, false) = false;

-- U.E.N. Armando Zuloaga Blanco → UEN Armando Zuloaga (centro-13) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 41, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Bolipuertos", "estatus_instalacion": "instalado", "capacidad_maxima": 400, "capacidad_instalada": 272}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-13'
  and coalesce(deleted, false) = false;

-- Ciudadanela de Catia 2 → Ciudadela de Catia 2 (centro-56) score=0.75
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 55, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 121, "capacidad_instalada": 121}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-56'
  and coalesce(deleted, false) = false;

-- U.E.N. Josefa Irausquin López → UEN Josefa Irausquin Lopez, El Cafetal (centro-37) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 72, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Energía Eléctrica", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 144, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-37'
  and coalesce(deleted, false) = false;

-- Complejo Educativo Antonio José de Sucre → Complejo Educativo Antonio José de Sucre (centro-72) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 17, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Bolipuerto", "estatus_instalacion": "instalado", "capacidad_maxima": 300, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-72'
  and coalesce(deleted, false) = false;

-- U.E.E. Adolfo Navas Coronado → UEE Adolfo Nava Coronado (centro-30) score=0.80
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 71, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para las Finanzas", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 60, "capacidad_instalada": 60}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-30'
  and coalesce(deleted, false) = false;

-- Liceo Leopoldo Aguerrevere → Liceo Leopoldo Aguerrevere (centro-08) score=1.05
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 38, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Procuraduría General de Venezuela", "estatus_instalacion": "instalado", "capacidad_maxima": 432, "capacidad_instalada": 212}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-08'
  and coalesce(deleted, false) = false;

-- U.E.N. Vicente Landaeta Gil → UEN Vicente Gil (centro-21) score=0.83
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 44, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Saren", "estatus_instalacion": "instalado", "capacidad_maxima": 60, "capacidad_instalada": 60}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-21'
  and coalesce(deleted, false) = false;

-- U.E.N. José de Jesús Arocha → UEN Jose de Jesús Arocha, Petare (centro-49) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 85, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Energía Eléctrica", "estatus_instalacion": "instalado", "capacidad_maxima": 100, "capacidad_instalada": 50}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-49'
  and coalesce(deleted, false) = false;

-- Complejo Educativo República de Panamá → Complejo Educativo República de Panamá (centro-87) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 6, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Proceso Social del Trabajo", "estatus_instalacion": "instalado", "capacidad_maxima": 600, "capacidad_instalada": 600}, "total_afectados": 709, "familias_ocupadas": 152}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-87'
  and coalesce(deleted, false) = false;

-- Universidad Maritima Del Caribe → Universidad Marítima del Caribe (centro-68) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 11, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Interior y Justicia", "estatus_instalacion": "instalado", "capacidad_maxima": 1000, "capacidad_instalada": 500}, "total_afectados": 3176, "familias_ocupadas": 930}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-68'
  and coalesce(deleted, false) = false;

-- C.E.N. Mariano Picón Salas → U. E. N. Mariano Picón Salas (centro-10) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 83, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para el Desarrollo Minero Ecológico e Industrias Básicas", "estatus_instalacion": "instalado", "capacidad_maxima": 420, "capacidad_instalada": 420}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-10'
  and coalesce(deleted, false) = false;

-- Juan German Roscio → U.E.N. Juan Germán Roscio (centro-83) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 5, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Educacion", "estatus_instalacion": "instalado", "capacidad_maxima": 200, "capacidad_instalada": 200}, "total_afectados": 204, "familias_ocupadas": 68}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-83'
  and coalesce(deleted, false) = false;

-- Escuela Angel Valero Hosto → Escuela Ángel Valero Hostos (centro-71) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 15, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Min. Aguas", "estatus_instalacion": "instalado", "capacidad_maxima": 300, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-71'
  and coalesce(deleted, false) = false;

-- U.E.N. Francisco Pimentel → UEN Francisco Pimentel (centro-02) score=1.05
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 29, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "SENIAT", "estatus_instalacion": "instalado", "capacidad_maxima": 500, "capacidad_instalada": 750}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-02'
  and coalesce(deleted, false) = false;

-- Centro de Educación Inicial Paula Maria Nieves → C.E.I. Paula María Nieves (centro-95) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 54, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "TSJ", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 250, "capacidad_instalada": 250}, "familias_ocupadas": 31}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-95'
  and coalesce(deleted, false) = false;

-- Escuela Estadal La Guaira → Escuela Estadal La Guaira (centro-88) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 7, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio Salud e Ipasme", "estatus_instalacion": "instalado", "capacidad_maxima": 172, "capacidad_instalada": 172}, "total_afectados": 169, "familias_ocupadas": 56}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-88'
  and coalesce(deleted, false) = false;

-- Liceo Licenciado Aranda → Liceo Licenciado Aranda (centro-84) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 19, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "SUNAGRO", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 600, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-84'
  and coalesce(deleted, false) = false;

-- U.E.N. Pedro Emilio Coll → UEN Pedro Emilio Coll (centro-01) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 27, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Metro de Caracas, C.A.", "estatus_instalacion": "instalado", "capacidad_maxima": 1200, "capacidad_instalada": 1200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-01'
  and coalesce(deleted, false) = false;

-- C.E. Claudio Feliciano → CE Claudio Feliciano (centro-19) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 45, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Movilnet", "estatus_instalacion": "instalado", "capacidad_maxima": 200, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-19'
  and coalesce(deleted, false) = false;

-- CMAPP El Junquito → CMAPP El Junquito (centro-63) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 58, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 32, "capacidad_instalada": 32}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-63'
  and coalesce(deleted, false) = false;

-- C.E.N. Francisco Iznardi → CEN Francisco Iznardi (centro-48) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 82, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "FVF", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 120, "capacidad_instalada": 120}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-48'
  and coalesce(deleted, false) = false;

-- Coliseo La Urbina → Coliseo La Urbina (centro-55) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 87, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "", "estatus_instalacion": "instalado", "capacidad_maxima": 186, "capacidad_instalada": 186}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-55'
  and coalesce(deleted, false) = false;

-- Liceo Lorenzo Gonzalez → Liceo Lorenzo González (centro-80) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 3, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio Pueblos Indigenas", "estatus_instalacion": "instalado", "capacidad_maxima": 286, "capacidad_instalada": 286}, "total_afectados": 286, "familias_ocupadas": 93}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-80'
  and coalesce(deleted, false) = false;

-- U.E. Gervasio Artigas → UE Gervacio Artigas (centro-17) score=0.83
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 42, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Banco del Tesoro", "estatus_instalacion": "instalado", "capacidad_maxima": 400, "capacidad_instalada": 400}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-17'
  and coalesce(deleted, false) = false;

-- UEN Zoe Xiques Silva → UEN Zoe Xiques Silva (centro-60) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 52, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "FONDEN", "estatus_instalacion": "instalado", "capacidad_maxima": 384, "capacidad_instalada": 384}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-60'
  and coalesce(deleted, false) = false;

-- UNES El Junquito → UNES del Junquito (centro-64) score=0.75
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 57, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 80, "capacidad_instalada": 80}, "total_afectados": 80, "familias_ocupadas": 66}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-64'
  and coalesce(deleted, false) = false;

-- San Pedro Claver → San Pedro Claver (centro-58) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 61, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 180, "capacidad_instalada": 180}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-58'
  and coalesce(deleted, false) = false;

-- E.T.I. Leonardo Infante → ETI Leonardo Infante (centro-09) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 84, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para el Desarrollo Minero Ecológico e Industrias Básicas", "estatus_instalacion": "instalado", "capacidad_maxima": 300, "capacidad_instalada": 272}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-09'
  and coalesce(deleted, false) = false;

-- Liceo Armando Reveron → Liceo Armando Reverón (centro-75) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 2, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Educación Universitaria", "estatus_instalacion": "instalado", "capacidad_maxima": 246, "capacidad_instalada": 246}, "total_afectados": 246, "familias_ocupadas": 70}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-75'
  and coalesce(deleted, false) = false;

-- Liceo Agustín Aveledo → Liceo Agustín Aveledo (centro-23) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 48, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "PEQUIVEN", "estatus_instalacion": "instalado", "capacidad_maxima": 300, "capacidad_instalada": 300}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-23'
  and coalesce(deleted, false) = false;

-- UEN Dr Luis Padrino → UE Luis Padrino (centro-20) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 50, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para Servicios Penitenciario", "estatus_instalacion": "instalado", "capacidad_maxima": 226, "capacidad_instalada": 220}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-20'
  and coalesce(deleted, false) = false;

-- Escuela Nuestra América → Escuela Nuestra América (centro-94) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 53, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Banco del Tesoro", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 200, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-94'
  and coalesce(deleted, false) = false;

-- U.E.N. Alejo Fortique → UEN Alejo Fortique (centro-31) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 68, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para Servicios Penitenciarios", "estatus_instalacion": "instalado", "capacidad_maxima": 240, "capacidad_instalada": 218}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-31'
  and coalesce(deleted, false) = false;

-- Refugio Para Niños Y Niñas → Refugio para Niños y Niñas (centro-76) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 9, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Sede del Ministerio de la Mujer", "estatus_instalacion": "instalado", "capacidad_maxima": 100, "capacidad_instalada": 100}, "total_afectados": 5}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-76'
  and coalesce(deleted, false) = false;

-- Narciso Gonel → U.E.N. Narciso Gonell (centro-70) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 13, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio Comunas", "estatus_instalacion": "instalado", "capacidad_maxima": 232, "capacidad_instalada": 232}, "total_afectados": 232, "familias_ocupadas": 71}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-70'
  and coalesce(deleted, false) = false;

-- Fundacion Sol de Vargas → Fundación Sol de Vargas (centro-89) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 16, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "", "estatus_instalacion": "instalado", "capacidad_maxima": 100, "capacidad_instalada": 100}, "total_afectados": 86, "familias_ocupadas": 21}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-89'
  and coalesce(deleted, false) = false;

-- Juan de Urpin → E.N.B. Juan de Urpín (centro-78) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 20, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Banco de Venezuela", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 300, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-78'
  and coalesce(deleted, false) = false;

-- Universidad Simón Bolívar → Universidad Simón Bolívar – Sede Litoral (Camurí Grande) (centro-92) score=0.92
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 22, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Interior y Justicia", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 1000, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-92'
  and coalesce(deleted, false) = false;

-- Estadio Miguel Montes → Estadio Miguel Montes (centro-79) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 26, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "ONU", "estatus_instalacion": "instalado", "capacidad_maxima": 600, "capacidad_instalada": 600}, "total_afectados": 260}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-79'
  and coalesce(deleted, false) = false;

-- Liceo Juan Landaeta → Liceo Juan Landaeta (centro-16) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 31, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Banco de Venezuela", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 200, "capacidad_instalada": 0}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-16'
  and coalesce(deleted, false) = false;

-- U.E Gran Colombia → UEN Gran Colombia — Edif. Ecuador (centro-52) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 34, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio Pueblos Indigenas / BDT", "estatus_instalacion": "instalado", "capacidad_maxima": 1780, "capacidad_instalada": 1148}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-52'
  and coalesce(deleted, false) = false;

-- Judith Liendo → Liceo Judith Liendo (centro-06) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 36, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para la Pesca y Acuicultura", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 200, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-06'
  and coalesce(deleted, false) = false;

-- UEN Eduardo Crema → UEN Eduardo Crema (centro-27) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 46, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Ciencia y Tecnología", "estatus_instalacion": "instalado", "capacidad_maxima": 400, "capacidad_instalada": 400}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-27'
  and coalesce(deleted, false) = false;

-- UE Cesar Rengifo → UE Cesar Rengifo (centro-12) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 47, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para la Cultura", "estatus_instalacion": "instalado", "capacidad_maxima": 50, "capacidad_instalada": 30}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-12'
  and coalesce(deleted, false) = false;

-- U.E.N. El Libertador → UEN EI Libertador (centro-40) score=0.83
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 74, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Vivienda y Hábitat", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 130, "capacidad_instalada": 130}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-40'
  and coalesce(deleted, false) = false;

-- E.U. Conopoima → EU Conopoima (centro-41) score=0.83
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 75, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Superintendencia de Seguros", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 100, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-41'
  and coalesce(deleted, false) = false;

-- Escuela Guaicamacuto → Escuela Integral Básica Guaicamacuto (centro-90) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 14, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Banco Central de Venezuela", "estatus_instalacion": "instalado", "capacidad_maxima": 500, "capacidad_instalada": 198}, "total_afectados": 156}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-90'
  and coalesce(deleted, false) = false;

-- Escuela Juan Aranaga → E.B.E. Juan Aranaga (centro-85) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 21, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Teatro Teresa Carreño", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 100, "capacidad_instalada": null}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-85'
  and coalesce(deleted, false) = false;

-- Campamento Cesar Nieves → Campamento César Nieves (centro-73) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 25, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "ONU", "estatus_instalacion": "instalado", "capacidad_maxima": 1260, "capacidad_instalada": 1260}, "total_afectados": 1260}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-73'
  and coalesce(deleted, false) = false;

-- E.T.I. Rafael Vegas → E.T.I. Rafael Vegas (centro-93) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 30, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para la Alimentación", "estatus_instalacion": "instalado", "capacidad_maxima": 250, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-93'
  and coalesce(deleted, false) = false;

-- C.E Andres Bello → CE Andres Bello (centro-32) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 39, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Agricultura Tierra", "estatus_instalacion": "instalado", "capacidad_maxima": 600, "capacidad_instalada": 400}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-32'
  and coalesce(deleted, false) = false;

-- U.E.N. Pedro Fontes → UEN Pedro Fontes (centro-25) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 43, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Contraloría General de la República", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 300, "capacidad_instalada": 300}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-25'
  and coalesce(deleted, false) = false;

-- UE Luis Hurtado → UE Luis Hurtado (centro-26) score=1.05
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 49, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para las Comunas", "estatus_instalacion": "instalado", "capacidad_maxima": 300, "capacidad_instalada": 259}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-26'
  and coalesce(deleted, false) = false;

-- PSUV Caracas → PSUV Caracas (centro-62) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 60, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Alcaldía de Caracas y Gobierno de Caracas", "estatus_instalacion": "instalado", "capacidad_maxima": 60, "capacidad_instalada": 60}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-62'
  and coalesce(deleted, false) = false;

-- Escuela de Liderazgo → Escuela Internacional de Liderazgo Antonio José de Sucre (centro-50) score=1.00
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 79, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "", "estatus_instalacion": "instalado", "capacidad_maxima": 200, "capacidad_instalada": 200}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-50'
  and coalesce(deleted, false) = false;

-- Unidad Educativa 10 De Marzo → Unidad Educativa 10 de Marzo (centro-81) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 4, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de la Juventud", "estatus_instalacion": "instalado", "capacidad_maxima": 350, "capacidad_instalada": 350}, "total_afectados": 320, "familias_ocupadas": 109}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-81'
  and coalesce(deleted, false) = false;

-- C.E.I Manuel Gual → C.E.I. Manuel Gual (centro-69) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 8, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio de Cultura", "estatus_instalacion": "instalado", "capacidad_maxima": 115, "capacidad_instalada": 115}, "total_afectados": 110, "familias_ocupadas": 53}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-69'
  and coalesce(deleted, false) = false;

-- Liceo Jose Avalos → Liceo Jose Avalos (centro-04) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 37, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Banco Central de Venezuela", "estatus_instalacion": "instalado", "capacidad_maxima": 300, "capacidad_instalada": 300}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-04'
  and coalesce(deleted, false) = false;

-- Liceo Juan Lovera → Liceo Juan Lovera (centro-18) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 40, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "Ministerio del Poder Popular para la Planificación", "estatus_instalacion": "instalado", "capacidad_maxima": 200, "capacidad_instalada": 15}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-18'
  and coalesce(deleted, false) = false;

-- U.E.N. Tito Salas → UEN Tito Salas (centro-28) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 66, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "CANTV", "estatus_instalacion": "instalado", "capacidad_maxima": 270, "capacidad_instalada": 100}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-28'
  and coalesce(deleted, false) = false;

-- U.E.N. Sorocaima → UEN Sorocaima (centro-29) score=1.08
update public.centros
set data = data || '{"censo_oficial": {"id_oficial": 67, "fecha_corte": "2026-07-07T10:00:00", "ministerio_ente": "BAER", "estatus_instalacion": "proceso_de_instalacion", "capacidad_maxima": 144, "capacidad_instalada": 50}}'::jsonb,
    updated_at = (extract(epoch from now()) * 1000)::bigint,
    updated_by = 'import_censo_oficial'
where id = 'centro-29'
  and coalesce(deleted, false) = false;

commit;
