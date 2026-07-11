-- Reasigna N° oficial por región:
--   Caracas y Miranda (Distrito Capital + Miranda) → 1..61
--   La Guaira → 62..N
-- Complejos (p. ej. Gran Colombia) comparten un solo N°.
-- También normaliza "DTTO. CAPITAL" → "Distrito Capital".

with base as (
  select
    id,
    data,
    data->>'nombre' as nombre,
    coalesce(nullif(trim(data->>'estado_federativo'), ''), '') as estado,
    (data->>'nro')::int as nro_actual,
    coalesce(nullif(trim(data->>'complejoId'), ''), id::text) as unidad
  from centros
  where coalesce(deleted, false) = false
),
norm as (
  select *,
    case
      when upper(estado) in ('DISTRITO CAPITAL', 'DTTO. CAPITAL', 'DTTO CAPITAL', 'CARACAS') then 1
      when upper(estado) = 'MIRANDA' then 1
      when upper(estado) in ('LA GUAIRA', 'VARGAS') then 2
      else 9
    end as region_ord
  from base
),
rep as (
  select distinct on (unidad)
    unidad,
    region_ord,
    nro_actual,
    nombre
  from norm
  order by unidad, nro_actual nulls last, nombre
),
ordenados as (
  select
    unidad,
    row_number() over (order by region_ord, nro_actual nulls last, nombre) as nro_nuevo
  from rep
)
update centros c
set
  data = jsonb_set(
    case
      when upper(trim(c.data->>'estado_federativo')) in ('DTTO. CAPITAL', 'DTTO CAPITAL')
        then jsonb_set(c.data, '{estado_federativo}', '"Distrito Capital"'::jsonb, true)
      else c.data
    end,
    '{nro}',
    to_jsonb(o.nro_nuevo),
    true
  ),
  updated_at = (extract(epoch from now()) * 1000)::bigint
from norm n
join ordenados o on o.unidad = n.unidad
where c.id = n.id
  and (
    (c.data->>'nro')::int is distinct from o.nro_nuevo
    or upper(trim(c.data->>'estado_federativo')) in ('DTTO. CAPITAL', 'DTTO CAPITAL')
  );
