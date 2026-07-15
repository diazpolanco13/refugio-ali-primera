-- Amplía el check de tipo en eventos_reportes: neutro | positivo | negativo.
-- Neutro es el default en la app al crear novedades.
--
-- ✅ APLICADA (migración `eventos_reportes_tipo_neutro`, 15-jul-2026, vía MCP).

alter table public.eventos_reportes
  drop constraint if exists eventos_reportes_tipo_check;

alter table public.eventos_reportes
  add constraint eventos_reportes_tipo_check
  check (tipo in ('neutro', 'positivo', 'negativo'));
