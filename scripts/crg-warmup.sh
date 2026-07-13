#!/bin/sh
# Warm-up rápido del grafo de código para un chat/sesión nueva de IA.
# Imprime en ~2s todo lo que un asistente necesita para orientarse:
#   1. Estado del grafo (tamaño, frescura, commit en el que se construyó)
#   2. Cambios en curso vs el grafo, con puntaje de riesgo
# Uso: ./scripts/crg-warmup.sh   (o pega su salida al inicio de un chat)
CRG_BIN="${CRG_BIN:-/root/.local/bin/code-review-graph}"
if ! [ -x "$CRG_BIN" ]; then
  CRG_BIN="$(command -v code-review-graph)" || {
    echo "code-review-graph no está instalado (uv tool install code-review-graph)"; exit 1;
  }
fi
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "=== Grafo de código — $(basename "$REPO_DIR") ==="
timeout 30 "$CRG_BIN" status --repo "$REPO_DIR" || {
  echo "Grafo no construido. Ejecuta: code-review-graph build"; exit 1;
}
echo ""
echo "=== Cambios en curso vs el grafo ==="
timeout 60 "$CRG_BIN" detect-changes --brief --repo "$REPO_DIR" 2>/dev/null \
  || echo "(sin cambios pendientes o análisis no disponible)"
echo ""
echo "Guía de uso para IAs: GRAPH_REPORT.md · Reglas: .cursor/rules/code-review-graph.mdc"
