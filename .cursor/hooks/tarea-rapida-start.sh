#!/usr/bin/env bash
# Hook Cursor sessionStart: solo estado dinámico (grafo + riesgo + flag caveman).
# Instrucciones estáticas viven en .cursor/rules/ — no duplicar aquí.
#
# Schema: {"additional_context": "...", "env": {...}}
# Falla en silencio. Cursor a veces descarta additional_context (race).
set -euo pipefail

cat > /dev/null  # consumir stdin

export PATH="$HOME/.local/bin:$PATH"
CRG_BIN="/root/.local/bin/code-review-graph"
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="$REPO_DIR/.code-review-graph"
mkdir -p "$LOG_DIR" 2>/dev/null || true

CAVEMAN_LEVEL="${CAVEMAN_LEVEL:-full}"
CAVEMAN_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CAVEMAN_DIR" 2>/dev/null || true
printf '%s\n' "$CAVEMAN_LEVEL" > "$CAVEMAN_DIR/.caveman-active" 2>/dev/null || true
printf '%s\n' "$CAVEMAN_LEVEL" > "$LOG_DIR/caveman-active" 2>/dev/null || true

estado="(grafo no disponible)"
riesgo="(sin análisis)"
if [ -x "$CRG_BIN" ]; then
  estado=$(timeout 15 "$CRG_BIN" status --repo "$REPO_DIR" 2>&1) || estado="(grafo no construido)"
  riesgo=$(timeout 30 "$CRG_BIN" detect-changes --brief --repo "$REPO_DIR" 2>&1 \
    | grep -v -E '^[┌│└]|Token Savings|Full context|Graph context|Saved:|Breakdown:' \
    || true)
  [ -n "${riesgo// }" ] || riesgo="(sin cambios en curso)"
fi

mensaje="## Sesión (dinámico)
grafo: $estado
riesgo: $riesgo
caveman=$CAVEMAN_LEVEL
Traspaso: docs/traspaso.md (bajo demanda). Rules: .cursor/rules/."

{
  echo "[sessionStart $(date -Iseconds)] pid=$$ repo=$REPO_DIR caveman=$CAVEMAN_LEVEL"
  echo "$mensaje" | head -c 400
  echo "..."
} >> "$LOG_DIR/session-start.log" 2>/dev/null || true

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
