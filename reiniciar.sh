#!/usr/bin/env bash
#
# Reinicia el entorno de desarrollo completo de la Sala Situacional:
#   - Backend  (Fastify + PGlite)  → http://localhost:3001
#   - Frontend (Vite, expuesto)    → http://localhost:5173  (y por IP de red)
#
# Uso:
#   ./reiniciar.sh          Reinicia ambos servidores (los deja en segundo plano)
#   ./reiniciar.sh stop     Solo detiene los servidores
#   ./reiniciar.sh logs     Muestra los logs en vivo (Ctrl-C para salir)
#
# Los logs se guardan en .dev-logs/{backend,frontend}.log
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$RAIZ/.dev-logs"
PUERTO_API=3001
PUERTO_WEB=5173

detener() {
  echo "→ Deteniendo procesos en los puertos $PUERTO_API y $PUERTO_WEB…"
  fuser -k "${PUERTO_API}/tcp" "${PUERTO_WEB}/tcp" 2>/dev/null || true
  sleep 1
}

esperar() { # $1=url  $2=nombre
  printf "→ Esperando a %s" "$2"
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null "$1" 2>/dev/null; then echo " ✓"; return 0; fi
    printf "."; sleep 1
  done
  echo " ✗ (revisa $LOGS)"
  return 1
}

case "${1:-restart}" in
  stop)
    detener
    echo "Servidores detenidos."
    exit 0
    ;;
  logs)
    tail -n 50 -f "$LOGS/backend.log" "$LOGS/frontend.log"
    exit 0
    ;;
esac

mkdir -p "$LOGS"
detener

# Instalar dependencias si faltan (primera vez o tras clonar).
[ -d "$RAIZ/node_modules" ]        || (echo "→ npm install (frontend)…"; cd "$RAIZ" && npm install)
[ -d "$RAIZ/server/node_modules" ] || (echo "→ npm install (backend)…";  cd "$RAIZ/server" && npm install)

echo "→ Levantando backend (:$PUERTO_API)…"
( cd "$RAIZ/server" && setsid nohup npm run dev >"$LOGS/backend.log" 2>&1 & )

echo "→ Levantando frontend (:$PUERTO_WEB)…"
( cd "$RAIZ" && setsid nohup npm run dev -- --host 0.0.0.0 >"$LOGS/frontend.log" 2>&1 & )

esperar "http://localhost:$PUERTO_API/api/health" "backend"
esperar "http://localhost:$PUERTO_WEB/" "frontend"

IP="$(curl -s -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo "Listo. Servidores de desarrollo en segundo plano:"
echo "  • Backend :  http://localhost:$PUERTO_API/api/health"
echo "  • Frontend:  http://localhost:$PUERTO_WEB/"
[ -n "$IP" ] && echo "               (desde la red / teléfono: http://$IP:$PUERTO_WEB/)"
echo "  • Logs    :  ./reiniciar.sh logs   (o mira $LOGS/)"
echo "  • Detener :  ./reiniciar.sh stop"
