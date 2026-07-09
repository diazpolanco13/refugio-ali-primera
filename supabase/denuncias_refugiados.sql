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
  titulo text check (titulo is null or char_length(titulo) between 3 and 120),
  texto text not null check (char_length(texto) between 10 and 1200),
  contacto text check (contacto is null or char_length(contacto) <= 120),
  estado text not null default 'abierta' check (estado in ('abierta', 'resuelta')),
  resuelta_ts bigint,
  resuelta_por text,
  nota_resolucion text,
  -- Telemetría de origen (anti-abuso). La MAC no es accesible desde el navegador.
  ip text,
  user_agent text,
  dispositivo_huella text,
  dispositivo_meta jsonb,
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

-- Alta anónima con el token 'publico' del QR. Valida catálogo y largo, captura
-- telemetría de origen (IP/UA/huella) y frena spam: por centro, por IP y por
-- huella. Ver también supabase/denuncias_titulo_telemetria.sql.
create or replace function public.denuncia_registrar(
  p_token text,
  p_categoria text,
  p_texto text,
  p_contacto text default null,
  p_titulo text default null,
  p_user_agent text default null,
  p_dispositivo_huella text default null,
  p_dispositivo_meta jsonb default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_centro_id text;
  v_titulo text;
  v_texto text;
  v_contacto text;
  v_ip text;
  v_ua text;
  v_huella text;
  v_meta jsonb;
  v_headers json;
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

  v_titulo := nullif(left(trim(coalesce(p_titulo, '')), 120), '');
  if v_titulo is null or char_length(v_titulo) < 3 then
    raise exception 'Escriba un título de al menos 3 caracteres';
  end if;

  v_texto := trim(coalesce(p_texto, ''));
  if char_length(v_texto) < 10 then
    raise exception 'Describa la situación con al menos 10 caracteres';
  end if;
  if char_length(v_texto) > 1200 then
    raise exception 'El texto es demasiado largo (máximo 1200 caracteres)';
  end if;

  v_contacto := nullif(left(trim(coalesce(p_contacto, '')), 120), '');

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := '{}'::json;
  end;
  v_ip := nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), '');
  if v_ip is null then
    v_ip := nullif(trim(coalesce(v_headers->>'cf-connecting-ip', '')), '');
  end if;
  if v_ip is null then
    v_ip := nullif(trim(coalesce(v_headers->>'x-real-ip', '')), '');
  end if;

  v_ua := nullif(left(trim(coalesce(p_user_agent, v_headers->>'user-agent', '')), 500), '');
  v_huella := nullif(left(trim(coalesce(p_dispositivo_huella, '')), 128), '');
  v_meta := case
    when p_dispositivo_meta is null then null
    when jsonb_typeof(p_dispositivo_meta) = 'object' then p_dispositivo_meta
    else null
  end;

  if (select count(*) from public.denuncias_centros d
      where d.centro_id = v_centro_id
        and d.ts > (extract(epoch from now()) * 1000)::bigint - 3600000) >= 20 then
    raise exception 'Se han recibido muchos reportes en la última hora. Intente más tarde.';
  end if;

  if v_ip is not null and (select count(*) from public.denuncias_centros d
      where d.ip = v_ip
        and d.ts > (extract(epoch from now()) * 1000)::bigint - 3600000) >= 10 then
    raise exception 'Se han recibido muchos reportes desde esta red. Intente más tarde.';
  end if;

  if v_huella is not null and (select count(*) from public.denuncias_centros d
      where d.dispositivo_huella = v_huella
        and d.ts > (extract(epoch from now()) * 1000)::bigint - 3600000) >= 8 then
    raise exception 'Se han recibido muchos reportes desde este dispositivo. Intente más tarde.';
  end if;

  insert into public.denuncias_centros (
    centro_id, categoria, titulo, texto, contacto,
    ip, user_agent, dispositivo_huella, dispositivo_meta,
    updated_at, updated_by
  ) values (
    v_centro_id, p_categoria, v_titulo, v_texto, v_contacto,
    v_ip, v_ua, v_huella, v_meta,
    (extract(epoch from now()) * 1000)::bigint, 'denuncia_qr'
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.denuncia_registrar(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.denuncia_registrar(text, text, text, text, text, text, text, jsonb) to anon, authenticated;

-- ── Cap obligatorio (migración denuncia_registrar_cap_ip, 10-jul) ───────────
-- El alta dejó de ir por la RPC directa. Ahora pasa SOLO por la Edge Function
-- `denuncia-registrar` (supabase/functions/denuncia-registrar/), que verifica
-- el token de Cap (siteverify, secret CAP_SECRET compartido con
-- login-with-cap) antes de insertar. Se revocó el execute de anon sobre la RPC
-- (para que Cap no sea burlable) y se le añadió `p_ip` (la Edge Function pasa
-- la IP real del cliente porque, al ser ella el caller, ya no llega en
-- request.headers). Solo service_role puede ejecutar la RPC:
--   revoke all on function public.denuncia_registrar(...9 args...) from public, anon, authenticated;
--   grant execute on function public.denuncia_registrar(...9 args...) to service_role;
-- Frontend: DenunciaView monta el widget <cap-widget> y reposDenuncias llama a
-- la Edge Function con el capToken. Si algún día se retira Cap, hay que volver
-- a conceder execute a anon y quitar el widget.
