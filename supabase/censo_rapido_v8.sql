-- Censo rápido v8 — «NO SE» en cédula del jefe no intenta enlazar menores.
--
-- Cuando el operador marca que no conoce la cédula del jefe de familia, el
-- frontend guarda jefe_documento = 'NO SE'. Sin este ajuste, el normalizador
-- produciría jefe_norm = 'NOSE' y podría intentar enlazar a un registro ajeno.

create or replace function public.censo_normalizar_jefe_doc(p_doc text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when upper(trim(coalesce(p_doc, ''))) in ('NO SE', 'NOSE') then null::text
    else nullif(upper(regexp_replace(trim(p_doc), '[^A-Za-z0-9]', '', 'g')), '')
  end;
$$;

-- Sustituir en censo_registrar y censo_actualizar la línea:
--   v_jefe_norm := nullif(upper(regexp_replace(v_jefe_documento, ...
-- por:
--   v_jefe_norm := censo_normalizar_jefe_doc(v_jefe_documento);
--
-- (Recrear ambas funciones desde censo_rapido_v5.sql / v6.sql con ese cambio.)
