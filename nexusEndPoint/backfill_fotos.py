#!/usr/bin/env python3
"""Backfill de foto SAIME en `nexus_consultas` (consultas precacheadas viejas).

Las consultas guardadas antes del 22-jul-2026 se generaron con el proxy viejo
y su slim no trae `foto_nombre` (ni `fallecido`, `ubicacion_fiscal`, merge de
familiares). Este script las reconsulta SECUENCIALMENTE contra el gateway y
actualiza la fila; si la persona tiene foto, hace un GET /foto para dejarla
precalentada en el MinIO propio.

Diseño (no colapsar Nexus ni disparar el vigilante):
  - Secuencial con pausa fija entre consultas (DELAY_S).
  - Solo pisa la fila si la respuesta trae persona (nunca pisa un slim bueno
    con una respuesta vacía del modo degradado de Nexus).
  - Aborta tras MAX_VACIAS_SEGUIDAS respuestas vacías consecutivas (el
    detector pasivo del gateway cuenta lo mismo; abortamos antes que él).
  - Idempotente/reanudable: el discriminador es la clave `fallecido` del slim
    (el slim nuevo siempre la incluye; el viejo no existe). Al relanzar,
    las filas ya refrescadas quedan excluidas solas.

Config:
  /etc/dokploy/nexus-vpn/env.secret  -> PROXY_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY
  /etc/dokploy/backfill-fotos.env    -> BACKFILL_EMAIL + BACKFILL_PASSWORD
                                        (o SUPABASE_SERVICE_ROLE_KEY)

Uso:
  python3 backfill_fotos.py --contar            # solo contar pendientes
  python3 backfill_fotos.py --limit 10          # prueba corta
  nohup python3 backfill_fotos.py > /var/log/backfill-fotos.log 2>&1 &
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

GATEWAY = "https://nexus.m0n1t0r-d3-3v3nt0s.net"
DELAY_S = 2.0
MAX_VACIAS_SEGUIDAS = 5
PAGINA = 1000


def leer_env(ruta: str) -> dict[str, str]:
    vals: dict[str, str] = {}
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                vals[k.strip()] = v.strip().strip('"')
    return vals


CFG = leer_env("/etc/dokploy/nexus-vpn/env.secret")
try:
    AUTH = leer_env("/etc/dokploy/backfill-fotos.env")
except FileNotFoundError:
    AUTH = {}

SUPABASE_URL = CFG["SUPABASE_URL"].rstrip("/")
ANON = CFG["SUPABASE_ANON_KEY"]
PROXY_SECRET = CFG["PROXY_SECRET"]
SERVICE_ROLE = AUTH.get("SUPABASE_SERVICE_ROLE_KEY", "")

_token: str | None = None


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def http_json(url: str, headers: dict, payload=None, method: str | None = None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method or ("POST" if data else "GET"), headers=headers
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        body = r.read()
        return r.status, json.loads(body) if body else None


def token_supabase() -> str:
    """Sesión para la RLS de nexus_consultas (authenticated)."""
    global _token
    if SERVICE_ROLE:
        return SERVICE_ROLE
    if _token:
        return _token
    if not AUTH.get("BACKFILL_EMAIL"):
        sys.exit("falta /etc/dokploy/backfill-fotos.env con BACKFILL_EMAIL/PASSWORD o SUPABASE_SERVICE_ROLE_KEY")
    status, d = http_json(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        {"apikey": ANON, "Content-Type": "application/json"},
        {"email": AUTH["BACKFILL_EMAIL"], "password": AUTH["BACKFILL_PASSWORD"]},
    )
    if not d or not d.get("access_token"):
        sys.exit(f"login supabase fallo: {d}")
    _token = d["access_token"]
    return _token


def rest_headers() -> dict:
    key = SERVICE_ROLE or ANON
    return {
        "apikey": key,
        "Authorization": f"Bearer {token_supabase()}",
        "Content-Type": "application/json",
    }


def rest(ruta: str, payload=None, method=None, prefer: str | None = None):
    """REST de Supabase con re-login automático si el JWT venció (runs largos)."""
    global _token
    h = rest_headers()
    if prefer:
        h["Prefer"] = prefer
    try:
        return http_json(f"{SUPABASE_URL}/rest/v1/{ruta}", h, payload, method)
    except urllib.error.HTTPError as e:
        if e.code == 401 and not SERVICE_ROLE:
            _token = None
            h = rest_headers()
            if prefer:
                h["Prefer"] = prefer
            return http_json(f"{SUPABASE_URL}/rest/v1/{ruta}", h, payload, method)
        raise


def pendientes() -> list[dict]:
    """Filas cuyo slim es de la versión vieja (sin la clave `fallecido`)."""
    filas: list[dict] = []
    offset = 0
    while True:
        _, page = rest(
            "nexus_consultas"
            "?select=letra,cedula,marca:data->>fallecido"
            f"&order=letra.asc,cedula.asc&limit={PAGINA}&offset={offset}"
        )
        if not page:
            break
        filas.extend(page)
        if len(page) < PAGINA:
            break
        offset += PAGINA
    return [f for f in filas if f["marca"] is None]


def fotos_conocidas() -> list[str]:
    """Nombres de foto ya guardados en los slims (para precalentar el cache)."""
    nombres: list[str] = []
    offset = 0
    while True:
        _, page = rest(
            "nexus_consultas?select=foto:data->>foto_nombre"
            f"&data->>foto_nombre=not.is.null&order=cedula.asc&limit={PAGINA}&offset={offset}"
        )
        if not page:
            break
        nombres.extend(f["foto"] for f in page if f.get("foto"))
        if len(page) < PAGINA:
            break
        offset += PAGINA
    return sorted(set(nombres))


def consultar_gateway(letra: str, cedula: str) -> dict | None:
    status, d = http_json(
        f"{GATEWAY}/v1/person/search/external/full/{letra}/{cedula}/censo",
        {"Content-Type": "application/json", "X-Gateway-Secret": PROXY_SECRET},
        {},
    )
    return d if isinstance(d, dict) else None


def precalentar_foto(nombre: str) -> str:
    try:
        req = urllib.request.Request(
            f"{GATEWAY}/foto/{nombre}", headers={"X-Gateway-Secret": PROXY_SECRET}
        )
        with urllib.request.urlopen(req, timeout=40) as r:
            r.read()
            return "ok" if r.status == 200 else f"http{r.status}"
    except Exception as e:  # noqa: BLE001
        return f"fallo:{str(e)[:60]}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--contar", action="store_true", help="solo contar pendientes")
    ap.add_argument("--limit", type=int, default=0, help="procesar solo N filas (prueba)")
    ap.add_argument(
        "--precalentar", action="store_true",
        help="bajar via gateway todas las fotos con nombre conocido (solo MinIO, no toca el API Nexus)",
    )
    args = ap.parse_args()

    # Salud del gateway antes de empezar
    _, salud = http_json(f"{GATEWAY}/health", {})
    if not (salud and salud.get("ok")):
        sys.exit(f"gateway sin salud: {salud}")
    log(f"gateway ok (foto_minio={salud.get('foto_minio')} foto_cache={salud.get('foto_cache')})")

    if args.precalentar:
        nombres = fotos_conocidas()
        if args.limit:
            nombres = nombres[: args.limit]
        total = len(nombres)
        log(f"precalentando {total} fotos (pausa 0.5 s; ~{total // 3600 + 1} h max)")
        ok = fallos = 0
        for i, nombre in enumerate(nombres, 1):
            r = precalentar_foto(nombre)
            if r == "ok":
                ok += 1
            else:
                fallos += 1
                log(f"({i}/{total}) {nombre} -> {r}")
            if i % 200 == 0:
                log(f"({i}/{total}) avance: {ok} ok, {fallos} fallos")
            time.sleep(0.5)
        log(f"FIN precalentado: {ok} ok, {fallos} fallos, de {total}")
        return

    filas = pendientes()
    log(f"pendientes de refrescar: {len(filas)}")
    if args.contar:
        return
    if args.limit:
        filas = filas[: args.limit]

    total = len(filas)
    refrescadas = fotos = vacias = errores = 0
    vacias_seguidas = 0
    for i, fila in enumerate(filas, 1):
        letra, cedula = fila["letra"], fila["cedula"]
        try:
            slim = consultar_gateway(letra, cedula)
        except Exception as e:  # noqa: BLE001
            errores += 1
            log(f"({i}/{total}) {letra}-{cedula} ERROR gateway: {str(e)[:100]}")
            time.sleep(DELAY_S * 5)
            continue

        con_persona = bool(slim and slim.get("ok") and (slim.get("primer_nombre") or slim.get("nombre_completo")))
        if not con_persona:
            vacias += 1
            vacias_seguidas += 1
            log(f"({i}/{total}) {letra}-{cedula} vacia ({vacias_seguidas} seguidas) — fila intacta")
            if vacias_seguidas >= MAX_VACIAS_SEGUIDAS:
                log(f"ABORT: {MAX_VACIAS_SEGUIDAS} vacias seguidas — Nexus degradado. Reintentar mas tarde (reanuda solo).")
                break
            time.sleep(DELAY_S)
            continue
        vacias_seguidas = 0

        rest(
            "nexus_consultas?on_conflict=letra,cedula",
            {
                "letra": letra,
                "cedula": cedula,
                "data": slim,
                "actualizado_ts": int(time.time() * 1000),
                "actualizado_por": "backfill-fotos",
            },
            method="POST",
            prefer="resolution=merge-duplicates,return=minimal",
        )
        refrescadas += 1

        foto = slim.get("foto_nombre")
        detalle = "sin foto"
        if foto:
            detalle = f"foto {precalentar_foto(foto)}"
            fotos += 1
        log(f"({i}/{total}) {letra}-{cedula} refrescada — {detalle}")
        time.sleep(DELAY_S)

    log(
        f"FIN: {refrescadas} refrescadas, {fotos} con foto precalentada, "
        f"{vacias} vacias (intactas), {errores} errores, de {total} pendientes"
    )


if __name__ == "__main__":
    main()
