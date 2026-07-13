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
# conocida; el respaldo fiable está en .cursor/rules/code-review-graph.mdc
# y .cursor/rules/caveman.mdc (caveman default ON).
# Además escribe ~/.claude/.caveman-active=full y env CAVEMAN_LEVEL.
set -euo pipefail

cat > /dev/null  # consumir stdin

export PATH="$HOME/.local/bin:$PATH"
CRG_BIN="/root/.local/bin/code-review-graph"
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="$REPO_DIR/.code-review-graph"
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Caveman ON por defecto (nivel full). Flag compatible con plugin Claude Code.
CAVEMAN_LEVEL="${CAVEMAN_LEVEL:-full}"
CAVEMAN_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CAVEMAN_DIR" 2>/dev/null || true
printf '%s\n' "$CAVEMAN_LEVEL" > "$CAVEMAN_DIR/.caveman-active" 2>/dev/null || true
printf '%s\n' "$CAVEMAN_LEVEL" > "$LOG_DIR/caveman-active" 2>/dev/null || true

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
5. CAVEMAN DEFAULT ON (nivel $CAVEMAN_LEVEL): respuestas concisas en español,
   sin relleno. Skill .agents/skills/caveman/. Regla .cursor/rules/caveman.mdc.
   Código/CLI/errores exactos. Off: \"stop caveman\" / \"modo normal\".
   Guía: CURSOR.md.

### Estado del grafo
$estado

### Cambios en curso (riesgo)
$riesgo

### Caveman
activo=$CAVEMAN_LEVEL (flag: $CAVEMAN_DIR/.caveman-active)"

# Log de diagnóstico (Cursor Hooks channel + este archivo)
{
  echo "[sessionStart $(date -Iseconds)] pid=$$ repo=$REPO_DIR caveman=$CAVEMAN_LEVEL"
  echo "$mensaje" | head -c 500
  echo "..."
} >> "$LOG_DIR/session-start.log" 2>/dev/null || true

# Schema oficial de Cursor: additional_context + env (no message/passed)
python3 -c '
import json, sys
msg = sys.stdin.read()
level = """'"$CAVEMAN_LEVEL"'""".strip() or "full"
print(json.dumps({
  "additional_context": msg,
  "env": {"CAVEMAN_LEVEL": level, "CAVEMAN_ACTIVE": "1"},
}, ensure_ascii=False))
' <<< "$mensaje" 2>/dev/null || echo '{"additional_context":"(hook sessionStart falló al serializar)"}'

exit 0
