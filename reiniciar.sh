#!/usr/bin/env bash
#
# Reinicia el entorno de desarrollo de la Sala Situacional.
# TRAS LA MIGRACIÓN A SUPABASE (Fase 7) ya no hay backend propio que levantar:
# la capa de datos (Postgres, Auth, Realtime, Storage) vive en Supabase y se
# accede desde el frontend vía supabase-js. Solo queda el servidor de Vite.
#
# Uso:
#   ./reiniciar.sh          Reinicia el frontend e indica cómo abrir Dokploy
#   ./reiniciar.sh update   Trae cambios de git (ff-only) y reinicia
#   ./reiniciar.sh stop     Solo detiene el frontend
#   ./reiniciar.sh dokploy  Muestra cómo acceder al panel Dokploy (:3000)
#   ./reiniciar.sh logs     Muestra los logs en vivo (Ctrl-C para salir)
#   ./reiniciar.sh build    Compila el build de producción y lo sirve en :4173
#
# En cada arranque reinstala dependencias automáticamente si cambió
# package-lock.json (p. ej. tras un git pull) — así "todo se actualiza bien".
# Los logs se guardan en .dev-logs/frontend.log
#
# OJO: esto es SOLO el entorno de DESARROLLO (Vite). NO toca producción.
#
# Dokploy: corre en ESTE mismo VPS en :3000, pero el firewall BLOQUEA el 3000
# desde fuera. Por eso desde tu PC/navegador local hace falta un túnel SSH
# (o Port Forward de Cursor), NO un ssh -L lanzado desde el propio servidor.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$RAIZ/.dev-logs"
PUERTO_WEB=5180
PUERTO_PREVIEW=4173
PUERTO_DOKPLOY=3000
DOKPLOY_SSH="root@38.242.223.182"
DOKPLOY_IP="38.242.223.182"

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

# Comprueba Dokploy en este host y recuerda cómo abrirlo DESDE TU PC.
# (Antes el script decía "túnel activo" solo porque Docker escucha :3000 aquí;
#  eso no abre localhost:3000 en tu navegador de Windows/Cursor local.)
mostrar_acceso_dokploy() {
  local ok_local=0
  if curl -sf -o /dev/null --connect-timeout 2 "http://127.0.0.1:${PUERTO_DOKPLOY}/" 2>/dev/null; then
    ok_local=1
    echo "→ Dokploy responde en este VPS (127.0.0.1:$PUERTO_DOKPLOY)."
  else
    echo "⚠ Dokploy no responde en 127.0.0.1:$PUERTO_DOKPLOY (¿contenedor caído?)."
  fi

  echo
  echo "  Acceso al panel (el puerto $PUERTO_DOKPLOY está cerrado al exterior):"
  echo "  1) En tu PC (PowerShell / terminal LOCAL, no en el VPS):"
  echo "       ssh -L ${PUERTO_DOKPLOY}:localhost:${PUERTO_DOKPLOY} ${DOKPLOY_SSH}"
  echo "     Luego abre:  http://localhost:${PUERTO_DOKPLOY}/"
  echo "  2) O en Cursor (Remote SSH): pestaña Ports → Forward Port → ${PUERTO_DOKPLOY}"
  echo "     y abre el localhost que Cursor te muestre."
  if [ "$ok_local" -eq 1 ]; then
    echo "  (Desde una shell YA dentro del VPS sí puedes: curl http://127.0.0.1:${PUERTO_DOKPLOY}/ )"
  fi
}

case "${1:-restart}" in
  stop)
    detener
    echo "Frontend detenido."
    exit 0
    ;;
  dokploy)
    mostrar_acceso_dokploy
    exit 0
    ;;
  logs)
    tail -n 50 -f "$LOGS/frontend.log"
    exit 0
    ;;
  build)
    mkdir -p "$LOGS"
    mostrar_acceso_dokploy
    echo
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
mostrar_acceso_dokploy
echo
detener

# Dependencias del frontend (se saltan si ya están al día).
instalar_deps "$RAIZ" "frontend"

echo "→ Levantando frontend (:$PUERTO_WEB)…"
( cd "$RAIZ" && setsid nohup npm run dev -- --host 0.0.0.0 >"$LOGS/frontend.log" 2>&1 & )

esperar "http://localhost:$PUERTO_WEB/" "frontend"

IP="$(curl -s -4 -m 3 ifconfig.me 2>/dev/null || echo "$DOKPLOY_IP")"
echo
echo "Listo. Frontend de desarrollo en segundo plano:"
echo "  • Frontend:  http://localhost:$PUERTO_WEB/"
[ -n "$IP" ] && echo "               (desde la red / teléfono: http://$IP:$PUERTO_WEB/)"
echo "  • Dokploy :  http://localhost:$PUERTO_DOKPLOY/  ← solo tras el túnel en TU PC"
echo "               (comando: ssh -L ${PUERTO_DOKPLOY}:localhost:${PUERTO_DOKPLOY} ${DOKPLOY_SSH})"
echo "  • Logs    :  ./reiniciar.sh logs"
echo "  • Detener :  ./reiniciar.sh stop"
echo "  • Ayuda Dokploy: ./reiniciar.sh dokploy"
