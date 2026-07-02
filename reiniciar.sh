#!/usr/bin/env bash
#
# Reinicia el entorno de desarrollo completo de la Sala Situacional:
#   - Backend  (Fastify + PGlite)  → http://localhost:3001
#   - Frontend (Vite, expuesto)    → http://localhost:5173  (y por IP de red)
#
# Uso:
#   ./reiniciar.sh          Reinicia ambos servidores (los deja en segundo plano)
#   ./reiniciar.sh update   Trae cambios de git (ff-only) y reinicia
#   ./reiniciar.sh stop     Solo detiene los servidores
#   ./reiniciar.sh logs     Muestra los logs en vivo (Ctrl-C para salir)
#
# En cada arranque reinstala dependencias automáticamente si cambió
# package-lock.json (p. ej. tras un git pull) — así "todo se actualiza bien".
# Los logs se guardan en .dev-logs/{backend,frontend}.log
#
# OJO: esto es SOLO el entorno de DESARROLLO (backend PGlite + Vite). NO toca
# producción. La producción corre en Dokploy y se actualiza aparte (ver
# CLAUDE.md → "Desplegar / actualizar producción (Dokploy)").
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

# Reinstala dependencias si faltan o si package-lock.json cambió desde la última
# instalación (usa un sello en node_modules). Así, tras un `git pull` que añada o
# suba deps, quedan instaladas sin tener que acordarse de correr npm install.
instalar_deps() { # $1=dir  $2=nombre
  local dir="$1" nombre="$2"
  local lock="$dir/package-lock.json"
  local sello="$dir/node_modules/.reiniciar-stamp"
  if [ ! -d "$dir/node_modules" ] || [ ! -f "$sello" ] \
     || { [ -f "$lock" ] && [ "$lock" -nt "$sello" ]; }; then
    echo "→ npm install ($nombre)…"
    ( cd "$dir" && npm install ) && touch "$sello"
  fi
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
  update)
    echo "→ Trayendo cambios de git (ff-only)…"
    if git -C "$RAIZ" pull --ff-only; then
      echo "→ Repo actualizado."
    else
      echo "⚠ No se pudo hacer fast-forward (¿hay commits locales sin subir o"
      echo "  conflicto?). Revisa 'git status'. Se reinicia con el código actual."
    fi
    ;;
esac

mkdir -p "$LOGS"
detener

# Dependencias del frontend y del backend (se saltan si ya están al día).
instalar_deps "$RAIZ"        "frontend"
instalar_deps "$RAIZ/server" "backend"

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
