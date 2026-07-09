-- Catálogo de supervisores SEBIN para el formulario de campamentos.
--
-- ✅ APLICADA (migración `perfiles_select_supervisores_catalogo`, 09-jul-2026).
--
-- Antes: `perfiles_select` solo dejaba ver perfiles ajenos al admin (o el propio).
-- Los roles que editan campamentos necesitan leer username+nombre de los
-- supervisores para asignar la revista rotatoria en CentroForm.
-- Solo SELECT de filas con rol=supervisor; no expone hash_id ni otros roles.

create policy perfiles_select_supervisores
  on public.perfiles
  for select
  to authenticated
  using (
    rol = 'supervisor'
    and (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'supervisor')
  );
