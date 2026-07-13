-- Centro sandbox / entrenamiento (`centro-prueba` / `es_prueba`).
--
-- Visibilidad:
--   • admin → toda la red (incluido el sandbox).
--   • operador/supervisor con el centro en mis_centros() → pueden
--     leer/escribir (sesión del QR de terreno = centro de entrenamiento).
--   • resto (analista, autoridad, operadores de otros centros) → oculto.
--
-- El frontend también filtra; esto evita fugas por Realtime o deep-links.

-- ---- centros ---------------------------------------------------------------
drop policy if exists centros_select on public.centros;
create policy centros_select on public.centros
  for select to authenticated
  using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
      or id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or id = any ((select public.mis_centros())::text[])
      or (
        id <> 'centro-prueba'
        and coalesce((data->>'es_prueba')::boolean, false) = false
      )
    )
  );

-- ---- ocupaciones_centros ---------------------------------------------------
drop policy if exists ocupaciones_centros_select on public.ocupaciones_centros;
create policy ocupaciones_centros_select on public.ocupaciones_centros
  for select to authenticated
  using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );

drop policy if exists ocupaciones_centros_insert on public.ocupaciones_centros;
create policy ocupaciones_centros_insert on public.ocupaciones_centros
  for insert to authenticated
  with check (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );

drop policy if exists ocupaciones_centros_update on public.ocupaciones_centros;
create policy ocupaciones_centros_update on public.ocupaciones_centros
  for update to authenticated
  using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  )
  with check (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );

drop policy if exists ocupaciones_centros_delete on public.ocupaciones_centros;
create policy ocupaciones_centros_delete on public.ocupaciones_centros
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id <> 'centro-prueba'
    )
  );

-- ---- reportes_centros ------------------------------------------------------
drop policy if exists reportes_centros_select on public.reportes_centros;
create policy reportes_centros_select on public.reportes_centros
  for select to authenticated
  using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad', 'censo_rapido')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );

drop policy if exists reportes_centros_insert on public.reportes_centros;
create policy reportes_centros_insert on public.reportes_centros
  for insert to authenticated
  with check (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );

drop policy if exists reportes_centros_update on public.reportes_centros;
create policy reportes_centros_update on public.reportes_centros
  for update to authenticated
  using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  )
  with check (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );

drop policy if exists reportes_centros_delete on public.reportes_centros;
create policy reportes_centros_delete on public.reportes_centros
  for delete to authenticated
  using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id <> 'centro-prueba'
    )
  );

-- ---- tokens de terreno -----------------------------------------------------
drop policy if exists tokens_centros_select on public.tokens_centros;
create policy tokens_centros_select on public.tokens_centros
  for select to authenticated
  using (
    (
      (select public.mi_rol()) in ('admin', 'analista_sae')
      or (
        (select public.mi_rol()) = 'supervisor'
        and tipo = 'publico'
        and activo
        and centro_id = any ((select public.mis_centros())::text[])
      )
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );
