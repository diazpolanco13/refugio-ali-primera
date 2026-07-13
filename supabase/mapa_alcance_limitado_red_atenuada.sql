-- ✅ APLICADA (migración `mapa_alcance_limitado_red_atenuada`, 13-jul-2026,
-- vía MCP execute_sql en xzwifkckkakldnzkdeby). Este archivo queda como
-- referencia versionada del SQL en producción.
--
-- Mapa con alcance limitado (supervisor / operador): lectura de toda la red
-- de campamentos de producción para atenuar los no asignados en el mapa
-- (mismo efecto visual que el filtro por unidad SEBIN).
--
-- Listas, KPIs, ficha y reportes siguen filtrados en cliente con
-- `centrosEnAlcanceUsuario`. Escritura y tablas operativas (reportes,
-- incidencias, etc.) no cambian: solo SELECT de `centros` y
-- `ocupaciones_centros` (población en marcadores).
--
-- Preserva el blindaje del sandbox (`centro-prueba` / `es_prueba`) de
-- `centro_prueba_rls.sql`.

-- ---- centros ---------------------------------------------------------------
drop policy if exists centros_select on public.centros;
create policy centros_select on public.centros
  for select to authenticated
  using (
    (
      (select public.mi_rol()) in (
        'admin', 'analista_sae', 'autoridad', 'censo_rapido',
        'supervisor', 'operador'
      )
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
      (select public.mi_rol()) in (
        'admin', 'analista_sae', 'autoridad', 'censo_rapido',
        'supervisor', 'operador'
      )
      or centro_id = any ((select public.mis_centros())::text[])
    )
    and (
      (select public.mi_rol()) = 'admin'
      or centro_id = any ((select public.mis_centros())::text[])
      or centro_id <> 'centro-prueba'
    )
  );
