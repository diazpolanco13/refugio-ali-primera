-- Permite a supervisor/operador anular entregas erróneas en sus campamentos.
-- Antes solo admin/analista_sae podían DELETE en beneficios_otorgados.

drop policy if exists beneficios_otorgados_delete on public.beneficios_otorgados;

create policy beneficios_otorgados_delete on public.beneficios_otorgados
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );
