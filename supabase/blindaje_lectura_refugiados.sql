-- Blindaje de lectura de la ficha humanitaria (migración
-- `blindaje_lectura_refugiados`, 09-jul-2026).
--
-- Problema: `refugiados_select` y `beneficios_otorgados_select` estaban en
-- `true` → cualquier sesión autenticada (incluidos los operadores compartidos
-- del QR de terreno) podía leer los datos personales de TODA la red.
--
-- Ahora: admin/analista_sae/autoridad ven toda la red; supervisor/operador
-- solo lo vinculado a sus campamentos. En `refugiados` el vínculo es vía
-- `alojamientos_refugiados` + el caso especial `updated_by = mi_username()`:
-- el alta hace `insert ... returning id` ANTES de crear el alojamiento y
-- RETURNING exige policy de SELECT sobre la fila recién creada.
--
-- (La sesión del QR además queda reducida en la UI a Reporte + Población +
-- Infraestructura de sus campamentos: `esRolTerreno`/`rutaPermitidaParaRol`
-- en src/domain/permisos.ts, menú en AppSidebar y pestañas en FichaCentroView.)

drop policy refugiados_select on public.refugiados;
create policy refugiados_select on public.refugiados
  for select to authenticated using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and (
        updated_by = (select public.mi_username())
        or exists (
          select 1 from public.alojamientos_refugiados a
          where a.refugiado_id = refugiados.id
            and a.centro_id = any ((select public.mis_centros())::text[])
        )
      )
    )
  );

drop policy beneficios_otorgados_select on public.beneficios_otorgados;
create policy beneficios_otorgados_select on public.beneficios_otorgados
  for select to authenticated using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or (
      (select public.mi_rol()) in ('supervisor', 'operador')
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );
