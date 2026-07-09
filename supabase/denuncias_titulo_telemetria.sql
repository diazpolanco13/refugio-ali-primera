-- Título + telemetría de origen en denuncias (anti-spam / detección de abuso).
-- La MAC no es accesible desde el navegador; se captura IP (cabecera del
-- request), user-agent y una huella del dispositivo enviada por el cliente.

alter table public.denuncias_centros
  add column if not exists titulo text,
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists dispositivo_huella text,
  add column if not exists dispositivo_meta jsonb;

alter table public.denuncias_centros
  drop constraint if exists denuncias_centros_titulo_check;

alter table public.denuncias_centros
  add constraint denuncias_centros_titulo_check
  check (titulo is null or char_length(titulo) between 3 and 120);

create index if not exists denuncias_centros_ip_idx
  on public.denuncias_centros (ip) where ip is not null;
create index if not exists denuncias_centros_huella_idx
  on public.denuncias_centros (dispositivo_huella) where dispositivo_huella is not null;

-- Sustituye la firma anterior (4 args) por una con título + telemetría.
drop function if exists public.denuncia_registrar(text, text, text, text);

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

  -- Tope por campamento (spam masivo).
  if (select count(*) from public.denuncias_centros d
      where d.centro_id = v_centro_id
        and d.ts > (extract(epoch from now()) * 1000)::bigint - 3600000) >= 20 then
    raise exception 'Se han recibido muchos reportes en la última hora. Intente más tarde.';
  end if;

  -- Tope por IP (mismo origen enviando muchas denuncias).
  if v_ip is not null and (select count(*) from public.denuncias_centros d
      where d.ip = v_ip
        and d.ts > (extract(epoch from now()) * 1000)::bigint - 3600000) >= 10 then
    raise exception 'Se han recibido muchos reportes desde esta red. Intente más tarde.';
  end if;

  -- Tope por huella de dispositivo.
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
