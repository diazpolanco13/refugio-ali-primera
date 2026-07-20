# GRAPH_REPORT — Grafo de código del proyecto

> **Para cualquier IA (Cursor, Claude Code, Codex, etc.) que abra este repo:**
> este proyecto tiene un grafo de conocimiento del código construido con
> **code-review-graph v2.3.6** (Tree-sitter → SQLite local, sin nube).
> **Consúltalo ANTES de hacer grep o leer archivos a ciegas** — una consulta
> al grafo cuesta ~300–2.500 tokens; escanear el código cuesta >150.000.

## Estado del grafo (13-jul-2026, build inicial)

| Métrica | Valor |
|---|---|
| Archivos indexados | 462 |
| Nodos (funciones, clases, imports) | ~2.700 |
| Aristas (llamadas, herencia, tests) | ~25.700 |
| Lenguajes | typescript, tsx, javascript, python, sql, bash |
| Build inicial | 16 s · commit `ef29f96` (main) |
| BD | `.code-review-graph/` (SQLite, **gitignored**, local-first) |

## Cómo se mantiene actualizado (no requiere acción manual)

1. **Git `post-commit`** (`.git/hooks/post-commit`): actualización incremental
   en segundo plano tras cada commit — con lock, timeout de 120 s y log en
   `.code-review-graph/hook.log`. Nunca bloquea el commit. (El `pre-commit`
   síncrono que instala la herramienta por defecto fue desactivado adrede.)
2. **Cursor** (`/root/.cursor/hooks.json`): `afterFileEdit` → update
   incremental; `sessionStart` → status; fallan en silencio, timeout ~20 s.
   Además, **hook de proyecto** (`.cursor/hooks.json` →
   `.cursor/hooks/tarea-rapida-start.sh`): en cada chat nuevo intenta
   inyectar (campo `additional_context`, schema oficial de Cursor) las
   instrucciones clave de tareas rápidas + estado del grafo + riesgo.
   Es la versión automática de `scripts/crg-warmup.sh`.
   ⚠️ Cursor a veces descarta ese `additional_context` por una race al
   crear el composer; el respaldo fiable son las reglas always-apply en
   `.cursor/rules/code-review-graph.mdc` (la IA debe llamar
   `list_graph_stats_tool` + `detect_changes_tool` al arrancar).
   Log de diagnóstico: `.code-review-graph/session-start.log`.
3. **Claude Code** (`.claude/settings.json`): `PostToolUse` (Edit/Write/Bash)
   → update incremental `--skip-flows`; `SessionStart` → status.
4. Manual, si sospechas que quedó viejo: `code-review-graph update`
   (incremental, <2 s) o `code-review-graph build` (completo, ~16 s).

## Cómo consumirlo

### Desde una IA con MCP (Cursor, Claude Code)

El servidor MCP `code-review-graph` ya está configurado en
`.cursor/mcp.json` (Cursor) y `.mcp.json` (Claude Code) — comando
`/root/.local/bin/code-review-graph serve`, cwd en la raíz del repo.
**Reinicia el editor una vez** para que lo cargue. Expone 30 herramientas;
las importantes:

| Intención | Herramienta MCP |
|---|---|
| Buscar función/clase por nombre o tema | `semantic_search_nodes_tool` |
| Quién llama / a quién llama / imports / tests de X | `query_graph_tool` (patterns: `callers_of`, `callees_of`, `imports_of`, `tests_for`) |
| Radio de impacto de tocar un archivo/símbolo | `get_impact_radius_tool` |
| Revisar cambios en curso (riesgo + gaps de tests) | `detect_changes_tool` → `get_review_context_tool` |
| Vista de arquitectura / módulos (comunidades) | `get_architecture_overview_tool`, `list_communities_tool`, `get_community_tool` |
| Flujos de ejecución y cuáles afecta un cambio | `list_flows_tool`, `get_affected_flows_tool` |
| Renames seguros, código muerto | `refactor_tool` |
| Contexto mínimo para una tarea | `get_minimal_context_tool` |
| Estadísticas / sanity check | `list_graph_stats_tool` |
| Nodos "hub" y puentes entre módulos | `get_hub_nodes_tool`, `get_bridge_nodes_tool` |

### Desde CLI (cualquier terminal / IA sin MCP)

```bash
export PATH="$HOME/.local/bin:$PATH"       # binario en /root/.local/bin
code-review-graph status                    # tamaño y frescura del grafo
code-review-graph detect-changes --brief    # riesgo de los cambios en curso (~1 s)
code-review-graph update --brief            # re-parsear cambios + mismo panel
code-review-graph visualize                 # HTML interactivo del grafo
code-review-graph wiki                      # wiki markdown por comunidades
./scripts/crg-warmup.sh                     # warm-up de chat nuevo (status + cambios)
```

## Prompts de ejemplo (Cursor / Grok / Claude / Composer)

- *"Usando el grafo (query_graph callers_of), ¿quién llama a
  `guardarCentro` y qué se rompe si cambio su firma?"*
- *"Con get_impact_radius, dime el blast radius de tocar
  `src/data/reposRefugiados.ts` antes de refactorizar."*
- *"Corre detect_changes sobre mi trabajo en curso y dime qué funciones
  quedaron sin test."*
- *"Con get_architecture_overview y list_communities, explícame cómo está
  organizado `src/features/censo/` sin leer los archivos."*
- *"Usa semantic_search_nodes para encontrar dónde se calcula el nivel de
  afectación del hogar."*

## Convivencia y notas

- **Local-first:** nada del código sale del VPS; la BD es SQLite en
  `.code-review-graph/` y está en `.gitignore`.
- Convive sin conflicto con el resto del stack de contexto del repo:
  `CLAUDE.md` (índice corto), `docs/traspaso.md` (negocio, bajo demanda),
  `.cursor/rules/code-review-graph.mdc` (regla always-on del grafo) y
  `AGENTS.md` (punteros + Hermes). No hay otro indexador de grafo instalado
  (si algún día se agrega uno tipo Graphify, pueden convivir: este escribe
  solo en `.code-review-graph/`).
- El grafo NO reemplaza a `docs/traspaso.md`: el grafo responde *estructura*
  (quién llama a qué); el traspaso responde *contexto de negocio y decisiones*.
- Límites conocidos (del propio proyecto upstream): la detección de flujos es
  más débil en JS/TS que en Python, y el análisis de impacto es
  deliberadamente conservador (prefiere falsos positivos a perder un
  dependiente).
