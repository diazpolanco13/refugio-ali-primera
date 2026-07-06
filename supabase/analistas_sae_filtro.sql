-- Permite a cualquier usuario autenticado leer perfiles con rol analista_sae
-- (username, nombre, centros_asignados) para el filtro de campamentos en el tablero.
-- La policy existente perfiles_select sigue limitando el resto de perfiles a admin/propio.

drop policy if exists perfiles_select_analistas_sae on public.perfiles;

create policy perfiles_select_analistas_sae on public.perfiles
  for select to authenticated
  using (rol = 'analista_sae');
