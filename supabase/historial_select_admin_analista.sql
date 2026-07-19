-- Bitácora: lectura solo roles de administración (admin + analista_sae).
-- Autoridad deja de leer historial. Aplicada en prod 19-jul-2026.

drop policy if exists historial_select on public.historial;

create policy historial_select on public.historial
  for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'analista_sae'));
