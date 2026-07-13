#!/usr/bin/env bash
# Hook de Cursor (sessionStart): inyecta en cada chat nuevo las instrucciones
# clave para tareas rápidas + el estado del grafo + el riesgo de los cambios
# en curso. Así la IA arranca orientada sin re-explorar el repo.
#
# Schema Cursor (docs): {"additional_context": "..." , "env": {...}}
# NO usar {"message","passed"} — eso es de Claude Code y Cursor lo ignora.
#
# Falla en silencio: nunca bloquea el editor.
# Nota: Cursor a veces descarta additional_context por una race condition
# conocida; el respaldo fiable está en .cursor/rules/code-review-graph.mdc.
set -euo pipefail

cat > /dev/null  # consumir stdin

export PATH="$HOME/.local/bin:$PATH"
CRG_BIN="/root/.local/bin/code-review-graph"
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="$REPO_DIR/.code-review-graph"
mkdir -p "$LOG_DIR" 2>/dev/null || true

estado="(grafo no disponible — ejecuta: code-review-graph build)"
riesgo="(sin análisis de cambios)"
if [ -x "$CRG_BIN" ]; then
  estado=$(timeout 15 "$CRG_BIN" status --repo "$REPO_DIR" 2>&1) || estado="(grafo no construido)"
  # --brief sin el cuadro de Token Savings (ruido en el contexto del agente)
  riesgo=$(timeout 30 "$CRG_BIN" detect-changes --brief --repo "$REPO_DIR" 2>&1 \
    | grep -v -E '^[┌│└]|Token Savings|Full context|Graph context|Saved:|Breakdown:' \
    || true)
  [ -n "${riesgo// }" ] || riesgo="(sin cambios en curso)"
fi

mensaje="## Instrucciones clave (tarea rápida — refugio-ali-primera)

1. GRAFO PRIMERO: antes de grep/leer archivos usa las tools MCP de
   code-review-graph: semantic_search_nodes (buscar símbolos),
   query_graph callers_of/callees_of/tests_for (relaciones),
   get_impact_radius (blast radius), detect_changes (riesgo del trabajo).
2. Contexto de negocio: CLAUDE.md (traspaso maestro). Guía del grafo:
   GRAPH_REPORT.md. Proyecto y comentarios EN ESPAÑOL.
3. Al cerrar la tarea: corre detect_changes y menciona funciones sin test
   antes de proponer commit. NO 'arregles' .git/hooks/pre-commit (es un
   no-op a propósito; el grafo se actualiza vía post-commit).
4. Permisos/RLS y Supabase: no toques funciones SECURITY DEFINER sin releer
   el gotcha de CREATE OR REPLACE en CLAUDE.md.

### Estado del grafo
$estado

### Cambios en curso (riesgo)
$riesgo"

# Log de diagnóstico (Cursor Hooks channel + este archivo)
{
  echo "[sessionStart $(date -Iseconds)] pid=$$ repo=$REPO_DIR"
  echo "$mensaje" | head -c 500
  echo "..."
} >> "$LOG_DIR/session-start.log" 2>/dev/null || true

# Schema oficial de Cursor: additional_context (no message/passed)
python3 -c '
import json, sys
msg = sys.stdin.read()
print(json.dumps({"additional_context": msg}, ensure_ascii=False))
' <<< "$mensaje" 2>/dev/null || echo '{"additional_context":"(hook sessionStart falló al serializar)"}'

exit 0
