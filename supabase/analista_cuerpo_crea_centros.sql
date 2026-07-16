-- =============================================================================
-- Analista de cuerpo crea campamentos (16-jul-2026) — REFERENCIA de la
-- migración aplicada: `analista_cuerpo_crea_centros`.
--
-- Extiende el ámbito del analista (ver `ambito_analista.sql`): el analista con
-- ámbito 'cuerpo' puede REGISTRAR campamentos, con una condición dura — la
-- unidad de supervisión del centro nuevo debe pertenecer a SU cuerpo. Así el
-- campamento nace dentro de su propio alcance (`mis_centros()` resuelve por el
-- join centros × unidades_sebin × cuerpo_clave) y nunca "desaparece" para él.
--
-- Piezas:
--   * `es_analista_de_cuerpo()` → rol analista_sae + ambito 'cuerpo' +
--     cuerpo_asignado no nulo.
--   * `centros_insert`: rama nueva — es_analista_de_cuerpo() y la unidad
--     (`data #>> '{supervision,unidad_sebin}'`) existe en `unidades_sebin`
--     activa con `cuerpo_clave = mi_cuerpo_asignado()`.
--   * `centros_update`: with_check endurecido — el analista de cuerpo no puede
--     mover un campamento suyo a una unidad de otro cuerpo (escaparía de su
--     alcance sin que mis_centros() lo detecte dentro del mismo statement).
--     El borrado suave (deleted=true) conserva la unidad → sigue pasando.
--   * `siguiente_nro_centro()` → siguiente N° libre de TODA la red (el
--     analista de cuerpo no ve todos los centros; el cálculo cliente
--     duplicaría N°). Solo expone un entero. La usa `NuevoCentroView`.
--
-- Frontend: `puedeCrearCentros()` acepta ámbito 'cuerpo' (permisos.ts);
-- `AsignacionOperativaCampos` fija el cuerpo del analista y limita las
-- unidades; `CentroForm` exige unidad de supervisión antes de guardar;
-- `/qrs-terreno` y su botón quedaron en `puedeImprimirQrsTerreno()` (solo
-- admin/analista de red: la RLS de tokens no da el token personal al scoped).
--
-- ⚠️ Al recrear funciones, Postgres re-otorga EXECUTE a PUBLIC: repetir los
-- revoke/grant (patrón del repo).
-- =============================================================================

create or replace function public.es_analista_de_cuerpo()
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.perfiles
    where user_id = auth.uid()
      and rol = 'analista_sae'
      and ambito_analista = 'cuerpo'
      and cuerpo_asignado is not null
  );
$$;

revoke all on function public.es_analista_de_cuerpo() from public, anon;
grant execute on function public.es_analista_de_cuerpo() to authenticated;

drop policy if exists centros_insert on public.centros;
create policy centros_insert
  on public.centros for insert to authenticated
  with check (
    (select public.mi_rol()) = 'admin'
    or (select public.es_analista_total())
    or (
      (select public.es_analista_de_cuerpo())
      and exists (
        select 1 from public.unidades_sebin u
        where u.valor_db = (data #>> '{supervision,unidad_sebin}')
          and u.cuerpo_clave = (select public.mi_cuerpo_asignado())
          and u.activo
      )
    )
  );

drop policy if exists centros_update on public.centros;
create policy centros_update
  on public.centros for update to authenticated
  using (
    (select public.mi_rol()) = 'admin'
    or (select public.es_analista_total())
    or (
      (select public.mi_rol()) in ('analista_sae', 'supervisor', 'operador')
      and id = any ((select public.mis_centros())::text[])
    )
  )
  with check (
    (select public.mi_rol()) = 'admin'
    or (select public.es_analista_total())
    or (
      (select public.mi_rol()) in ('analista_sae', 'supervisor', 'operador')
      and id = any ((select public.mis_centros())::text[])
      and (
        not (select public.es_analista_de_cuerpo())
        or exists (
          select 1 from public.unidades_sebin u
          where u.valor_db = (data #>> '{supervision,unidad_sebin}')
            and u.cuerpo_clave = (select public.mi_cuerpo_asignado())
        )
      )
    )
  );

create or replace function public.siguiente_nro_centro()
returns int
language sql stable security definer
set search_path to ''
as $$
  select coalesce(max((data ->> 'nro')::int), 0) + 1
  from public.centros
  where deleted is not true
    and (data ->> 'nro') ~ '^[0-9]+$';
$$;

revoke all on function public.siguiente_nro_centro() from public, anon;
grant execute on function public.siguiente_nro_centro() to authenticated;
