#!/usr/bin/env python3
"""Precarga `nexus_consultas` con las cédulas de `censo_registros` (censo viejo).

No mezcla datos: solo consulta el gateway Nexus por cada cédula del censo
manual y guarda la respuesta en la MISMA caché que ya usa el flujo "Por
cédula" del frontend (`nexus_consultas`, ver src/data/reposNexus.ts). Así,
cuando el censador re-verifique a esas personas en la app nueva, la búsqueda
sale instantánea en vez de esperar al gateway.

Autenticación: inicia sesión como un usuario real (grant_type=password) y usa
ese mismo JWT para leer censo_registros, escribir nexus_consultas y llamar al
gateway Nexus (acepta `Authorization: Bearer <JWT de Supabase>`, igual que el
navegador) — no requiere el secreto PROXY_SECRET del gateway, que ni siquiera
vive en este repo.

Uso:
    NEXUS_SCRIPT_EMAIL=admin@refugio.app NEXUS_SCRIPT_PASSWORD=... \\
        python3 scripts/precargar_nexus_censo.py --dry-run --limit 20

    NEXUS_SCRIPT_EMAIL=admin@refugio.app NEXUS_SCRIPT_PASSWORD=... \\
        python3 scripts/precargar_nexus_censo.py --limit 500 --rate 2.5 \\
        --reporte /tmp/nexus_no_encontrados.jsonl

Nunca corre en paralelo ni sin pausa: el gateway (nexusEndPoint/runtime/proxy.py)
es un solo túnel OpenVPN hacia un API institucional ajeno, sin rate limiting
propio. La disciplina de ritmo es responsabilidad de este script.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"

DEFAULT_URL = "https://xzwifkckkakldnzkdeby.supabase.co"
DEFAULT_GATEWAY = "https://nexus.m0n1t0r-d3-3v3nt0s.net"
DEFAULT_RATE = 2.5
DEFAULT_CIRCUIT_BREAKER = 5
LETRAS_VALIDAS = {"V", "E"}


def cargar_env() -> tuple[str, str, str]:
    """Lee VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_NEXUS_GATEWAY_URL
    del .env del repo, sobreescribibles por variables de entorno reales."""
    valores: dict[str, str] = {}
    if ENV.exists():
        for linea in ENV.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            for clave in ("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_NEXUS_GATEWAY_URL"):
                if linea.startswith(f"{clave}="):
                    valores[clave] = linea.split("=", 1)[1].strip().strip('"').strip("'")
    url = os.environ.get("VITE_SUPABASE_URL", valores.get("VITE_SUPABASE_URL", DEFAULT_URL))
    key = os.environ.get("VITE_SUPABASE_ANON_KEY", valores.get("VITE_SUPABASE_ANON_KEY", ""))
    gateway = os.environ.get(
        "VITE_NEXUS_GATEWAY_URL", valores.get("VITE_NEXUS_GATEWAY_URL", DEFAULT_GATEWAY)
    )
    if not key:
        raise SystemExit("Falta VITE_SUPABASE_ANON_KEY (.env o variable de entorno)")
    return url.rstrip("/"), key, gateway.rstrip("/")


def autenticar(url: str, anon_key: str) -> str:
    """Login por password → access_token (JWT de sesión)."""
    email = os.environ.get("NEXUS_SCRIPT_EMAIL")
    password = os.environ.get("NEXUS_SCRIPT_PASSWORD")
    if not email or not password:
        raise SystemExit(
            "Faltan NEXUS_SCRIPT_EMAIL / NEXUS_SCRIPT_PASSWORD en el entorno "
            "(credenciales de una cuenta autenticada, ej. admin@refugio.app)."
        )
    req = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode("utf-8"),
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detalle = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"No se pudo autenticar ({exc.code}): {detalle}") from exc
    token = body.get("access_token")
    if not token:
        raise SystemExit(f"Respuesta de login sin access_token: {body}")
    return token


PAGE_SIZE = 1000


def rest_get(url: str, anon_key: str, token: str, path: str) -> list:
    """GET paginado: PostgREST limita cada respuesta a PAGE_SIZE filas
    (visto en producción: 998/2 de 1000 en la primera prueba), así que hay
    que pedir por bloques con `Range` hasta que una página vuelva vacía."""
    acumulado: list = []
    desde = 0
    while True:
        hasta = desde + PAGE_SIZE - 1
        req = urllib.request.Request(
            f"{url}/rest/v1/{path}",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {token}",
                "Range-Unit": "items",
                "Range": f"{desde}-{hasta}",
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            pagina = json.loads(resp.read().decode("utf-8"))
        acumulado.extend(pagina)
        if len(pagina) < PAGE_SIZE:
            break
        desde += PAGE_SIZE
    return acumulado


def upsert_nexus_consulta(url: str, anon_key: str, token: str, fila: dict) -> None:
    req = urllib.request.Request(
        f"{url}/rest/v1/nexus_consultas?on_conflict=letra,cedula",
        data=json.dumps(fila).encode("utf-8"),
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30):
        pass


def consultar_nexus(gateway: str, token: str, letra: str, cedula: str) -> dict:
    req = urllib.request.Request(
        f"{gateway}/v1/person/search/external/full/{letra}/{cedula}/censo",
        data=b"{}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return {"status": resp.status, "body": json.loads(resp.read().decode("utf-8"))}
    except urllib.error.HTTPError as exc:
        cuerpo = exc.read().decode("utf-8", errors="replace")
        try:
            cuerpo_json = json.loads(cuerpo)
        except json.JSONDecodeError:
            cuerpo_json = {"error": cuerpo}
        return {"status": exc.code, "body": cuerpo_json}
    except urllib.error.URLError as exc:
        return {"status": None, "body": {"error": str(exc.reason)}}


def cedula_valida(cedula: str) -> bool:
    return cedula.isdigit() and 5 <= len(cedula) <= 12


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rate", type=float, default=DEFAULT_RATE, help=f"Segundos entre consultas al gateway (default {DEFAULT_RATE})")
    parser.add_argument("--limit", type=int, default=None, help="Tope de cédulas a procesar en esta corrida")
    parser.add_argument("--dry-run", action="store_true", help="Solo reporta qué haría, sin llamar al gateway ni escribir")
    parser.add_argument("--reporte", type=str, default=None, help="Ruta de archivo JSONL donde anotar los 'no encontrado'/errores")
    parser.add_argument(
        "--circuit-breaker",
        type=int,
        default=DEFAULT_CIRCUIT_BREAKER,
        help=f"Abortar tras N fallos de gateway consecutivos (default {DEFAULT_CIRCUIT_BREAKER})",
    )
    args = parser.parse_args()

    url, anon_key, gateway = cargar_env()
    token = autenticar(url, anon_key)
    print(f"Autenticado. Supabase={url} Gateway={gateway}", file=sys.stderr)

    candidatos_raw = rest_get(
        url,
        anon_key,
        token,
        "censo_registros?select=documento_norm,tipo_doc"
        "&documento_norm=not.is.null&tipo_doc=in.(V,E)&order=id",
    )
    vistos: set[tuple[str, str]] = set()
    candidatos: list[tuple[str, str]] = []
    descartados_formato = 0
    for fila in candidatos_raw:
        cedula = (fila.get("documento_norm") or "").strip()
        letra = (fila.get("tipo_doc") or "").strip().upper()
        if letra not in LETRAS_VALIDAS or not cedula_valida(cedula):
            descartados_formato += 1
            continue
        clave = (letra, cedula)
        if clave in vistos:
            continue
        vistos.add(clave)
        candidatos.append(clave)

    ya_cacheadas_raw = rest_get(
        url, anon_key, token, "nexus_consultas?select=letra,cedula&order=letra,cedula"
    )
    ya_cacheadas = {(f["letra"], f["cedula"]) for f in ya_cacheadas_raw}

    pendientes = [c for c in candidatos if c not in ya_cacheadas]
    print(
        f"Candidatos válidos: {len(candidatos)} · descartados por formato: {descartados_formato} "
        f"· ya en caché: {len(candidatos) - len(pendientes)} · pendientes: {len(pendientes)}",
        file=sys.stderr,
    )

    if args.limit is not None:
        pendientes = pendientes[: args.limit]
        print(f"Limitado a {len(pendientes)} por --limit", file=sys.stderr)

    if args.dry_run:
        print(json.dumps({"pendientes": len(pendientes), "muestra": pendientes[:10]}, ensure_ascii=False, indent=2))
        return 0

    reporte_fh = open(args.reporte, "a", encoding="utf-8") if args.reporte else None

    resumen = {"ok": 0, "no_encontrado": 0, "error": 0}
    fallos_consecutivos = 0
    try:
        for i, (letra, cedula) in enumerate(pendientes, start=1):
            if i > 1:
                time.sleep(args.rate)

            resultado = consultar_nexus(gateway, token, letra, cedula)
            status = resultado["status"]
            body = resultado["body"]

            if status == 200 and body.get("ok") is not False:
                upsert_nexus_consulta(
                    url,
                    anon_key,
                    token,
                    {
                        "letra": letra,
                        "cedula": cedula,
                        "data": body,
                        "actualizado_ts": int(time.time() * 1000),
                        "actualizado_por": "script:precarga_nexus",
                    },
                )
                resumen["ok"] += 1
                fallos_consecutivos = 0
                print(f"OK {i}/{len(pendientes)}: {letra}-{cedula}", file=sys.stderr)
            elif status == 404 or (status == 200 and body.get("ok") is False):
                resumen["no_encontrado"] += 1
                fallos_consecutivos = 0
                print(f"NO_ENCONTRADO {i}/{len(pendientes)}: {letra}-{cedula}", file=sys.stderr)
                if reporte_fh:
                    reporte_fh.write(json.dumps({"letra": letra, "cedula": cedula, "motivo": "no_encontrado"}, ensure_ascii=False) + "\n")
            else:
                resumen["error"] += 1
                fallos_consecutivos += 1
                print(f"ERROR {i}/{len(pendientes)}: {letra}-{cedula} -> status={status} {body}", file=sys.stderr)
                if reporte_fh:
                    reporte_fh.write(
                        json.dumps({"letra": letra, "cedula": cedula, "motivo": "error", "status": status, "detalle": body}, ensure_ascii=False)
                        + "\n"
                    )
                if fallos_consecutivos >= args.circuit_breaker:
                    print(
                        f"ABORTADO: {fallos_consecutivos} fallos consecutivos del gateway. "
                        "Reintente más tarde (posible caída del túnel/VPN).",
                        file=sys.stderr,
                    )
                    break
    finally:
        if reporte_fh:
            reporte_fh.close()

    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    return 1 if resumen["error"] > 0 and resumen["ok"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
