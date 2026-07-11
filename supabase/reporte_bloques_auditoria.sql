-- Auditoría por bloque del reporte diario (quién/cuándo revisó cada área).
-- Antes de esto solo existía updated_at/updated_by a nivel de fila completa.

alter table public.reportes_centros
  add column if not exists salud_updated_at bigint,
  add column if not exists salud_updated_by text,
  add column if not exists trabajos_updated_at bigint,
  add column if not exists trabajos_updated_by text,
  add column if not exists requerimientos_updated_at bigint,
  add column if not exists requerimientos_updated_by text,
  add column if not exists eventos_updated_at bigint,
  add column if not exists eventos_updated_by text;

-- Relleno inicial: si el bloque ya estaba marcado, hereda la meta de la fila.
update public.reportes_centros
set
  salud_updated_at = case
    when coalesce(salud_reportada, false) and salud_updated_at is null then updated_at
    else salud_updated_at
  end,
  salud_updated_by = case
    when coalesce(salud_reportada, false) and (salud_updated_by is null or salud_updated_by = '')
      then updated_by
    else salud_updated_by
  end,
  trabajos_updated_at = case
    when coalesce(trabajos_revisados, false) and trabajos_updated_at is null then updated_at
    else trabajos_updated_at
  end,
  trabajos_updated_by = case
    when coalesce(trabajos_revisados, false) and (trabajos_updated_by is null or trabajos_updated_by = '')
      then updated_by
    else trabajos_updated_by
  end,
  requerimientos_updated_at = case
    when coalesce(requerimientos_revisados, false) and requerimientos_updated_at is null then updated_at
    else requerimientos_updated_at
  end,
  requerimientos_updated_by = case
    when coalesce(requerimientos_revisados, false)
      and (requerimientos_updated_by is null or requerimientos_updated_by = '')
      then updated_by
    else requerimientos_updated_by
  end,
  eventos_updated_at = case
    when coalesce(eventos_revisados, false) and eventos_updated_at is null then updated_at
    else eventos_updated_at
  end,
  eventos_updated_by = case
    when coalesce(eventos_revisados, false) and (eventos_updated_by is null or eventos_updated_by = '')
      then updated_by
    else eventos_updated_by
  end;
