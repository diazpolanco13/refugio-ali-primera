-- Carga ministerio_ente (censo oficial) en responsables_coordinacion
-- como categoría "comunitaria" (Ente encargado) → campo "ente".
--
-- Idempotente:
--   - Si ya hay comunitaria con ente vacío → rellena ente.
--   - Si no hay comunitaria → agrega un responsable mínimo con el ente.
--   - No pisa ente ya cargado manualmente.
--
-- Fuente: censo/json/campamentos_transitorios.json (vía data.censo_oficial).

begin;

-- 1) Rellenar ente vacío en responsables ya existentes (categoría comunitaria)
update public.centros c
set
  data = jsonb_set(
    c.data,
    '{responsables_coordinacion}',
    (
      select coalesce(jsonb_agg(
        case
          when r->>'categoria' = 'comunitaria'
            and nullif(trim(coalesce(r->>'ente', '')), '') is null
          then r || jsonb_build_object(
            'ente', trim(c.data->'censo_oficial'->>'ministerio_ente')
          )
          else r
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(coalesce(c.data->'responsables_coordinacion', '[]'::jsonb)) r
    )
  ),
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'import_entes_responsables'
where coalesce(c.deleted, false) = false
  and nullif(trim(coalesce(c.data->'censo_oficial'->>'ministerio_ente', '')), '') is not null
  and exists (
    select 1
    from jsonb_array_elements(coalesce(c.data->'responsables_coordinacion', '[]'::jsonb)) r
    where r->>'categoria' = 'comunitaria'
      and nullif(trim(coalesce(r->>'ente', '')), '') is null
  );

-- 2) Crear responsable "Ente encargado" donde aún no hay ninguno comunitaria
update public.centros c
set
  data = jsonb_set(
    c.data,
    '{responsables_coordinacion}',
    coalesce(c.data->'responsables_coordinacion', '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object(
          'id', 'ente-' || c.id,
          'nombre', trim(c.data->'censo_oficial'->>'ministerio_ente'),
          'cedula', '',
          'ente', trim(c.data->'censo_oficial'->>'ministerio_ente'),
          'categoria', 'comunitaria',
          'subtipo', 'funcionario',
          'personal_mando', 0,
          'telefonos', jsonb_build_array(''),
          'logistica', '[]'::jsonb,
          'transporte', jsonb_build_object('vehiculos', 0)
        )
      )
  ),
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  updated_by = 'import_entes_responsables'
where coalesce(c.deleted, false) = false
  and nullif(trim(coalesce(c.data->'censo_oficial'->>'ministerio_ente', '')), '') is not null
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(c.data->'responsables_coordinacion', '[]'::jsonb)) r
    where r->>'categoria' = 'comunitaria'
  );

commit;
