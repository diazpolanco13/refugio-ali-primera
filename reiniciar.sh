#!/usr/bin/env bash
#
# Reinicia el entorno de desarrollo de la Sala Situacional.
# TRAS LA MIGRACIÓN A SUPABASE (Fase 7) ya no hay backend propio que levantar:
# la capa de datos (Postgres, Auth, Realtime, Storage) vive en Supabase y se
# accede desde el frontend vía supabase-js. Solo queda el servidor de Vite.
#
# Uso:
#   ./reiniciar.sh          Reinicia el frontend (lo deja en segundo plano)
#   ./reiniciar.sh update   Trae cambios de git (ff-only) y reinicia
#   ./reiniciar.sh stop     Solo detiene el frontend
#   ./reiniciar.sh logs     Muestra los logs en vivo (Ctrl-C para salir)
#   ./reiniciar.sh build    Compila el build de producción y lo sirve en :4173
#                           (MUCHO más rápido para probar desde conexiones
#                           lentas: 9 archivos empaquetados en vez de cientos
#                           de módulos sueltos del dev server)
#
# En cada arranque reinstala dependencias automáticamente si cambió
# package-lock.json (p. ej. tras un git pull) — así "todo se actualiza bien".
# Los logs se guardan en .dev-logs/frontend.log
#
# OJO: esto es SOLO el entorno de DESARROLLO (Vite). NO toca producción.
# La producción corre en Dokploy y se actualiza aparte (ver CLAUDE.md).
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$RAIZ/.dev-logs"
PUERTO_WEB=5173
PUERTO_PREVIEW=4173

detener() {
  echo "→ Deteniendo procesos en el puerto $PUERTO_WEB…"
  fuser -k "${PUERTO_WEB}/tcp" 2>/dev/null || true
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
    echo "Frontend detenido."
    exit 0
    ;;
  logs)
    tail -n 50 -f "$LOGS/frontend.log"
    exit 0
    ;;
  build)
    mkdir -p "$LOGS"
    instalar_deps "$RAIZ" "frontend"
    echo "→ Compilando build de producción…"
    ( cd "$RAIZ" && npm run build ) || { echo "✗ Falló el build."; exit 1; }
    echo "→ (Re)levantando preview (:$PUERTO_PREVIEW)…"
    fuser -k "${PUERTO_PREVIEW}/tcp" 2>/dev/null || true
    sleep 1
    # `serve` (no `vite preview`) para mandar Cache-Control immutable en los
    # assets con hash: así las recargas del navegador no re-descargan nada.
    # (lee serve.json de la raíz: public=dist, SPA fallback y Cache-Control)
    ( cd "$RAIZ" && setsid nohup npx serve -l "tcp://0.0.0.0:$PUERTO_PREVIEW" >"$LOGS/preview.log" 2>&1 & )
    esperar "http://localhost:$PUERTO_PREVIEW/" "preview"
    IP="$(curl -s -4 -m 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
    echo
    echo "Build servido en:  http://localhost:$PUERTO_PREVIEW/"
    [ -n "$IP" ] && echo "  (desde la red:   http://$IP:$PUERTO_PREVIEW/)"
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

# Dependencias del frontend (se saltan si ya están al día).
instalar_deps "$RAIZ" "frontend"

echo "→ Levantando frontend (:$PUERTO_WEB)…"
( cd "$RAIZ" && setsid nohup npm run dev -- --host 0.0.0.0 >"$LOGS/frontend.log" 2>&1 & )

esperar "http://localhost:$PUERTO_WEB/" "frontend"

IP="$(curl -s -4 -m 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo "Listo. Frontend de desarrollo en segundo plano:"
echo "  • Frontend:  http://localhost:$PUERTO_WEB/"
[ -n "$IP" ] && echo "               (desde la red / teléfono: http://$IP:$PUERTO_WEB/)"
echo "  • Logs    :  ./reiniciar.sh logs   (o mira $LOGS/)"
echo "  • Detener :  ./reiniciar.sh stop"
