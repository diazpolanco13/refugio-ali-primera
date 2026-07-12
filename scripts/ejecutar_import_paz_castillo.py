#!/usr/bin/env python3
"""Ejecuta la importación de paz castillo.txt vía Supabase REST (censo_registrar)."""

import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/opt/refugio-ali-primera")
ENV = ROOT / ".env"

DEFAULT_URL = "https://xzwifkckkakldnzkdeby.supabase.co"
DEFAULT_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d2lma2Nra2FrbGRuemtkZWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTgyNTcsImV4cCI6MjA5ODQ5NDI1N30."
    "dahZYfusdxZLdmEmUH5AKTRc6KhNBxZccqreA9NpzOQ"
)


def load_env() -> tuple[str, str]:
    url = key = ""
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("VITE_SUPABASE_URL="):
                url = line.split("=", 1)[1].strip()
            elif line.startswith("VITE_SUPABASE_ANON_KEY="):
                key = line.split("=", 1)[1].strip()
    url = os.environ.get("VITE_SUPABASE_URL", url or DEFAULT_URL)
    key = os.environ.get("VITE_SUPABASE_ANON_KEY", key or DEFAULT_KEY)
    if not url or not key:
        raise SystemExit("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY")
    return url.rstrip("/"), key


def load_importer():
    spec = importlib.util.spec_from_file_location(
        "importar_censo_paz_castillo",
        ROOT / "scripts" / "importar_censo_paz_castillo.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def rpc_registrar(url: str, key: str, centro_id: str, funcionario: dict, registro: dict) -> str:
    payload = {
        "p_centro_id": centro_id,
        "p_funcionario": funcionario,
        "p_registro": registro,
    }
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/censo_registrar",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def main():
    imp = load_importer()
    url, key = load_env()
    _, ok, omitidos, reasignados = imp.preparar()

    resultados = {"ok": [], "error": []}
    for reg in ok:
        payload = imp.registro_payload(reg)
        nombre = f"{reg['primer_nombre']} {reg['primer_apellido']}"
        try:
            reg_id = rpc_registrar(url, key, imp.CENTRO_ID, imp.FUNCIONARIO, payload)
            resultados["ok"].append({"fila": reg["fila"], "nombre": nombre, "id": reg_id})
            print(f"OK fila {reg['fila']}: {nombre}", file=sys.stderr)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            resultados["error"].append({"fila": reg["fila"], "nombre": nombre, "error": detail})
            print(f"ERROR fila {reg['fila']}: {nombre} -> {detail}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            resultados["error"].append({"fila": reg["fila"], "nombre": nombre, "error": str(exc)})
            print(f"ERROR fila {reg['fila']}: {nombre} -> {exc}", file=sys.stderr)

    resumen = {
        "centro_id": imp.CENTRO_ID,
        "centro_nombre": "UE Jose Ignacio Paz Castillo",
        "registrados_ok": len(resultados["ok"]),
        "errores": len(resultados["error"]),
        "omitidos_archivo": len(omitidos),
        "cedulas_reasignadas": len(reasignados),
        "omitidos": [
            {
                "fila": o["fila"],
                "nombre": f"{o['primer_nombre']} {o['primer_apellido']}",
                "motivo": o.get("motivo", ""),
            }
            for o in omitidos
        ],
        "detalle_errores": resultados["error"],
    }
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    return 1 if resultados["error"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
