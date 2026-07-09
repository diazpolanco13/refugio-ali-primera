-- Tokens de terreno por campamento — cierre del acceso anónimo al censo.
-- (Referencia de las migraciones `tokens_terreno_censo` y
-- `storage_fotos_solo_autenticados`, aplicadas el 09-jul-2026.)
--
-- Problema que corrige: el rol `anon` podía ejecutar censo_listado /
-- censo_listado_red_paginado / censo_eliminar / censo_actualizar etc., es
-- decir, cualquiera con la anon key (pública por diseño) podía descargar,
-- alterar o borrar el censo completo de la red sin autenticarse.
--
-- Modelo nuevo: cada campamento tiene tokens secretos y revocables en
-- `tokens_centros` (tipo 'personal' para funcionarios, 'publico' reservado
-- para el canal de denuncias de la Fase 3). El QR/enlace de terreno lleva
-- `?t=<token>`; sin sesión autenticada, las RPC del censo exigen un token
-- 'personal' vigente y limitan todo al centro de ese token. Con sesión
-- autenticada el comportamiento no cambia (el token se ignora).
--
-- Revocar el QR de un campamento (y generar uno nuevo):
--   update tokens_centros set activo = false, revocado_en = now()
--     where centro_id = 'centro-NN' and tipo = 'personal' and activo;
--   insert into tokens_centros (centro_id, tipo) values ('centro-NN', 'personal');

-- 1) Tabla de tokens revocables por campamento
create table public.tokens_centros (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  centro_id text not null references public.centros(id) on delete cascade,
  tipo text not null check (tipo in ('personal', 'publico')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  revocado_en timestamptz
);

create index tokens_centros_centro_idx on public.tokens_centros (centro_id);
create unique index tokens_centros_activo_unico
  on public.tokens_centros (centro_id, tipo) where activo;

alter table public.tokens_centros enable row level security;

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
create policy tokens_centros_insert on public.tokens_centros
  for insert to authenticated with check ((select public.mi_rol()) in ('admin', 'analista_sae'));
create policy tokens_centros_update on public.tokens_centros
  for update to authenticated using ((select public.mi_rol()) in ('admin', 'analista_sae'))
  with check ((select public.mi_rol()) in ('admin', 'analista_sae'));
create policy tokens_centros_delete on public.tokens_centros
  for delete to authenticated using ((select public.mi_rol()) = 'admin');

-- 2) Helpers (solo uso interno de las funciones definer: sin grants)
create or replace function public.centro_de_token(p_token text, p_tipo text)
returns text language sql stable security definer set search_path = public as $$
  select t.centro_id from public.tokens_centros t
  where t.token = p_token and t.tipo = p_tipo and t.activo;
$$;
revoke all on function public.centro_de_token(text, text) from public, anon, authenticated;

-- Guardia común: con sesión autenticada pasa siempre; sin sesión, el token
-- 'personal' debe pertenecer exactamente al centro solicitado.
create or replace function public.acceso_censo_centro(p_token text, p_centro_id text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    return;
  end if;
  if p_token is null or p_centro_id is null
     or public.centro_de_token(p_token, 'personal') is distinct from p_centro_id then
    raise exception 'Acceso no autorizado: use el enlace o código QR de su campamento';
  end if;
end;
$$;
revoke all on function public.acceso_censo_centro(text, text) from public, anon, authenticated;

-- Identifica el campamento de un token de personal (/terreno y /censo).
create or replace function public.terreno_centro(p_token text)
returns table(id text, nombre text)
language sql stable security definer set search_path = public as $$
  select c.id, coalesce(nullif(trim(c.data->>'nombre'), ''), c.id) as nombre
  from public.centros c
  where c.id = public.centro_de_token(p_token, 'personal') and not c.deleted;
$$;
revoke all on function public.terreno_centro(text) from public;
grant execute on function public.terreno_centro(text) to anon, authenticated;

-- 3) RPC del censo: nueva firma con p_token (default null) y guardia al
-- inicio. Los cuerpos son los de censo_rapido_v9 sin otros cambios:
--   censo_registrar(p_centro_id, p_funcionario, p_registro, p_token)
--     → perform acceso_censo_centro(p_token, p_centro_id) antes de validar.
--   censo_actualizar(p_id, p_registro, p_token)
--     → resuelve v_centro_id del registro y aplica la guardia.
--   censo_eliminar(p_id, p_token)
--     → ídem (antes ni siquiera comprobaba el centro).
--   censo_listado(p_centro_id, p_token)  [ahora plpgsql para poder lanzar]
--   censo_completar(p_centro_id, p_funcionario, p_token)
--   censo_cierre(p_centro_id, p_token)   [ahora plpgsql]
-- Se hizo DROP de las firmas viejas (para no dejar sobrecargas ambiguas en
-- PostgREST) y las nuevas tienen: revoke all from public + grant a
-- anon, authenticated. Ver la migración `tokens_terreno_censo` para el SQL
-- completo de los cuerpos.

-- 4) Funciones de red y auxiliares: solo usuarios autenticados. Importante:
-- al recrear una función Postgres vuelve a conceder EXECUTE a PUBLIC, por lo
-- que estos revoke deben repetirse en cualquier migración futura que las toque.
revoke all on function public.censo_centros() from public, anon;
revoke all on function public.censo_listado_red() from public, anon;
revoke all on function public.censo_listado_red_conteo(text, text, text) from public, anon;
revoke all on function public.censo_listado_red_paginado(integer, integer, text, text, text, text) from public, anon;
revoke all on function public.censo_resumen_red() from public, anon;
revoke all on function public.censo_error_cedula_duplicada(text, uuid) from public, anon;
revoke all on function public.censo_normalizar_jefe_doc(text) from public, anon;

grant execute on function public.censo_centros() to authenticated;
grant execute on function public.censo_listado_red() to authenticated;
grant execute on function public.censo_listado_red_conteo(text, text, text) to authenticated;
grant execute on function public.censo_listado_red_paginado(integer, integer, text, text, text, text) to authenticated;
grant execute on function public.censo_resumen_red() to authenticated;
grant execute on function public.censo_error_cedula_duplicada(text, uuid) to authenticated;
grant execute on function public.censo_normalizar_jefe_doc(text) to authenticated;

-- 5) Tokens iniciales para los campamentos activos (personal + publico)
insert into public.tokens_centros (centro_id, tipo)
select c.id, t.tipo
from public.centros c
cross join (values ('personal'), ('publico')) as t(tipo)
where not c.deleted
  and not exists (
    select 1 from public.tokens_centros x
    where x.centro_id = c.id and x.tipo = t.tipo and x.activo
  );

-- 5b) Autogeneración (migración tokens_centro_auto): trigger que crea los
-- tokens personal+publico al insertar un campamento (o al restaurarlo tras un
-- borrado suave). Idempotente gracias al not exists.
create or replace function public.generar_tokens_centro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tokens_centros (centro_id, tipo)
  select new.id, t.tipo
  from (values ('personal'), ('publico')) as t(tipo)
  where not exists (
    select 1 from public.tokens_centros x
    where x.centro_id = new.id and x.tipo = t.tipo and x.activo
  );
  return new;
end;
$$;

drop trigger if exists centros_generar_tokens on public.centros;
create trigger centros_generar_tokens
after insert or update on public.centros
for each row
when (new.deleted is not true)
execute function public.generar_tokens_centro();

-- 6) Storage (migración storage_fotos_solo_autenticados): los buckets
-- centros-fotos / infraestructura-fotos / reparaciones-fotos aceptaban
-- INSERT/UPDATE del rol anon; todos los flujos que suben fotos viven en la
-- app con login, así que se restringieron a authenticated (el SELECT público
-- de los buckets públicos no cambia).
alter policy centros_fotos_insert on storage.objects to authenticated;
alter policy centros_fotos_update on storage.objects to authenticated;
alter policy infraestructura_fotos_insert on storage.objects to authenticated;
alter policy infraestructura_fotos_update on storage.objects to authenticated;
alter policy reparaciones_fotos_insert on storage.objects to authenticated;
alter policy reparaciones_fotos_update on storage.objects to authenticated;
