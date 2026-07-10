-- Gran Colombia: 4 edificios (centro-03/51/52/54) comparten nro oficial 3
-- y complejoId "gran-colombia" para contar como 1 campamento en totales de red.

update centros
set
  data = data
    || jsonb_build_object(
      'nro', 3,
      'complejoId', 'gran-colombia'
    ),
  updated_at = (extract(epoch from now()) * 1000)::bigint
where id in ('centro-03', 'centro-51', 'centro-52', 'centro-54')
  and coalesce(deleted, false) = false;
