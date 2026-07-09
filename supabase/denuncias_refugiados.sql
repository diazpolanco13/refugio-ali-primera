-- Canal público de denuncias/sugerencias de los damnificados (Fase 3 del
-- plan de acceso de campo). Referencia de la migración `denuncias_refugiados`
-- aplicada el 09-jul-2026. Ver también supabase/tokens_terreno.sql.
--
-- Flujo: QR 'publico' pegado en las carteleras del campamento →
-- /denuncia?t=<token> → RPC `denuncia_registrar` (anónima, sin login).
-- Las gestionan quienes VIGILAN el centro: admin/analista_sae (toda la red),
-- autoridad (toda la red, solo lectura), supervisor (SOLO sus campamentos —
-- pasa revista diaria y acciona). El operador de terreno (cuenta compartida
-- del personal DENTRO del centro, potencial denunciado) NO aparece en
-- ninguna policy: no ve nada.

create table public.denuncias_centros (
  id uuid primary key default gen_random_uuid(),
  centro_id text not null references public.centros(id) on delete cascade,
  dia date not null default (now() at time zone 'America/Caracas')::date,
  ts bigint not null default (extract(epoch from now()) * 1000)::bigint,
  categoria text not null check (categoria in
    ('comida', 'dotaciones', 'trato', 'seguridad', 'salud', 'infraestructura', 'otro')),
  texto text not null check (char_length(texto) between 10 and 1200),
  contacto text check (contacto is null or char_length(contacto) <= 120),
  estado text not null default 'abierta' check (estado in ('abierta', 'resuelta')),
  resuelta_ts bigint,
  resuelta_por text,
  nota_resolucion text,
  updated_at bigint,
  updated_by text
);

create index denuncias_centros_dia_idx on public.denuncias_centros (dia);
create index denuncias_centros_centro_dia_idx on public.denuncias_centros (centro_id, dia);
create index denuncias_centros_estado_idx on public.denuncias_centros (estado);

alter table public.denuncias_centros enable row level security;

create policy denuncias_centros_select on public.denuncias_centros
  for select to authenticated using (
    (select public.mi_rol()) in ('admin', 'analista_sae', 'autoridad')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy denuncias_centros_update on public.denuncias_centros
  for update to authenticated using (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  ) with check (
    (select public.mi_rol()) in ('admin', 'analista_sae')
    or (
      (select public.mi_rol()) = 'supervisor'
      and centro_id = any ((select public.mis_centros())::text[])
    )
  );

create policy denuncias_centros_delete on public.denuncias_centros
  for delete to authenticated using ((select public.mi_rol()) = 'admin');

-- Sin policy de INSERT: la única vía de alta es la RPC security definer.

alter publication supabase_realtime add table public.denuncias_centros;

-- Nombre del campamento de un token 'publico' (para la página /denuncia).
create or replace function public.denuncia_centro(p_token text)
returns table(id text, nombre text)
language sql stable security definer set search_path = public as $$
  select c.id, coalesce(nullif(trim(c.data->>'nombre'), ''), c.id) as nombre
  from public.centros c
  where c.id = public.centro_de_token(p_token, 'publico') and not c.deleted;
$$;
revoke all on function public.denuncia_centro(text) from public;
grant execute on function public.denuncia_centro(text) to anon, authenticated;

-- Alta anónima con el token 'publico' del QR. Valida catálogo y largo, y
-- frena spam básico: máximo 20 denuncias por centro por hora.
create or replace function public.denuncia_registrar(
  p_token text,
  p_categoria text,
  p_texto text,
  p_contacto text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_centro_id text;
  v_texto text;
  v_contacto text;
  v_id uuid;
begin
  v_centro_id := public.centro_de_token(p_token, 'publico');
  if v_centro_id is null then
    raise exception 'Código QR no válido o revocado';
  end if;
  if not exists (select 1 from public.centros c where c.id = v_centro_id and not c.deleted) then
    raise exception 'El campamento ya no existe';
  end if;

  if p_categoria is null or p_categoria not in
    ('comida', 'dotaciones', 'trato', 'seguridad', 'salud', 'infraestructura', 'otro') then
    raise exception 'Seleccione una categoría';
  end if;

  v_texto := trim(coalesce(p_texto, ''));
  if char_length(v_texto) < 10 then
    raise exception 'Describa la situación con al menos 10 caracteres';
  end if;
  if char_length(v_texto) > 1200 then
    raise exception 'El texto es demasiado largo (máximo 1200 caracteres)';
  end if;

  v_contacto := nullif(left(trim(coalesce(p_contacto, '')), 120), '');

  if (select count(*) from public.denuncias_centros d
      where d.centro_id = v_centro_id
        and d.ts > (extract(epoch from now()) * 1000)::bigint - 3600000) >= 20 then
    raise exception 'Se han recibido muchos reportes en la última hora. Intente más tarde.';
  end if;

  insert into public.denuncias_centros (centro_id, categoria, texto, contacto, updated_at, updated_by)
  values (
    v_centro_id, p_categoria, v_texto, v_contacto,
    (extract(epoch from now()) * 1000)::bigint, 'denuncia_qr'
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.denuncia_registrar(text, text, text, text) from public;
grant execute on function public.denuncia_registrar(text, text, text, text) to anon, authenticated;
