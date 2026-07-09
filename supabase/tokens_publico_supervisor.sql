-- El supervisor debe ver el QR/enlace público de denuncias de SUS
-- campamentos asignados (token tipo 'publico'). El token 'personal' de
-- terreno sigue restringido a admin/analista_sae.
-- Referencia de la migración `tokens_publico_supervisor`.

drop policy if exists tokens_centros_select on public.tokens_centros;
create policy tokens_centros_select on public.tokens_centros
  for select to authenticated using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and tipo = 'publico'
      and activo
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );
