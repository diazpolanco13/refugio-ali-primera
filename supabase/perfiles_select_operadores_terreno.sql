-- Atribución legible en reportes diarios: nombre + jerarquía de operadores de terreno.
--
-- Antes: `perfiles_select` solo deja ver perfiles ajenos al admin (o el propio).
-- Quien ve reportes (autoridad, analista SAE, supervisor) veía el username críptico
-- `operador-centro-10-471aa379` sin poder resolver el perfil del funcionario.
-- Solo SELECT de filas operador con username de terreno; no expone hash_id ni otros roles.

drop policy if exists perfiles_select_operadores_terreno on public.perfiles;

create policy perfiles_select_operadores_terreno
  on public.perfiles
  for select
  to authenticated
  using (
    rol = 'operador'
    and username like 'operador-%'
    and (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'supervisor')
  );
