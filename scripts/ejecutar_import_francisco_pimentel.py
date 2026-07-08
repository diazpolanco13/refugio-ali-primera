#!/usr/bin/env python3
"""Ejecuta la importación de francisco_pimentel.txt vía Supabase REST (censo_registrar)."""

import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/opt/refugio-ali-primera")
ENV = ROOT / ".env"
CENTRO_ID = "centro-02"


def load_env() -> tuple[str, str]:
    url = key = ""
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("VITE_SUPABASE_URL="):
                url = line.split("=", 1)[1].strip()
            elif line.startswith("VITE_SUPABASE_ANON_KEY="):
                key = line.split("=", 1)[1].strip()
    url = os.environ.get("VITE_SUPABASE_URL", url)
    key = os.environ.get("VITE_SUPABASE_ANON_KEY", key)
    if not url or not key:
        raise SystemExit("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY")
    return url.rstrip("/"), key


def load_importer():
    spec = importlib.util.spec_from_file_location(
        "importar_censo_francisco_pimentel",
        ROOT / "scripts" / "importar_censo_francisco_pimentel.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def rpc_call(url: str, key: str, fn: str, payload: dict):
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/{fn}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8")
    if not body:
        return None
    return json.loads(body)


def rpc_registrar(url: str, key: str, centro_id: str, funcionario: dict, registro: dict) -> str:
    return rpc_call(
        url,
        key,
        "censo_registrar",
        {
            "p_centro_id": centro_id,
            "p_funcionario": funcionario,
            "p_registro": registro,
        },
    )


def rpc_listado(url: str, key: str, centro_id: str) -> list[dict]:
    data = rpc_call(url, key, "censo_listado", {"p_centro_id": centro_id})
    return data or []


def rpc_eliminar(url: str, key: str, registro_id: str) -> None:
    rpc_call(url, key, "censo_eliminar", {"p_id": registro_id})


def borrar_registros_existentes(url: str, key: str, centro_id: str) -> int:
    existentes = rpc_listado(url, key, centro_id)
    borrados = 0
    errores = 0
    for reg in existentes:
        try:
            rpc_eliminar(url, key, reg["id"])
            borrados += 1
            if borrados % 50 == 0:
                print(f"Borrados {borrados}/{len(existentes)}...", file=sys.stderr)
        except urllib.error.HTTPError as exc:
            errores += 1
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"ERROR borrando {reg['id']}: {detail}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            errores += 1
            print(f"ERROR borrando {reg['id']}: {exc}", file=sys.stderr)
    if errores:
        raise SystemExit(f"No se pudieron borrar {errores} registros previos; abortando importación.")
    return borrados


def main():
    imp = load_importer()
    url, key = load_env()

    existentes_antes = rpc_listado(url, key, CENTRO_ID)
    print(f"Registros existentes en {CENTRO_ID}: {len(existentes_antes)}", file=sys.stderr)

    if existentes_antes:
        print("Borrando registros previos de centro-02...", file=sys.stderr)
        borrados = borrar_registros_existentes(url, key, CENTRO_ID)
        print(f"Borrados: {borrados}", file=sys.stderr)

    ok, omitidos, reasignados, meta = imp.preparar_registros()
    print(json.dumps(meta, ensure_ascii=False, indent=2), file=sys.stderr)

    resultados = {"ok": [], "error": []}
    for i, reg in enumerate(ok, start=1):
        payload = imp.registro_payload(reg)
        nombre = f"{reg['primer_nombre']} {reg['primer_apellido']}"
        try:
            reg_id = rpc_registrar(url, key, imp.CENTRO_ID, imp.FUNCIONARIO, payload)
            resultados["ok"].append({"fila": reg["fila"], "nombre": nombre, "id": reg_id})
            if i % 50 == 0 or i == len(ok):
                print(f"Importados {i}/{len(ok)}...", file=sys.stderr)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            resultados["error"].append({"fila": reg["fila"], "nombre": nombre, "error": detail})
            print(f"ERROR fila {reg['fila']}: {nombre} -> {detail}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            resultados["error"].append({"fila": reg["fila"], "nombre": nombre, "error": str(exc)})
            print(f"ERROR fila {reg['fila']}: {nombre} -> {exc}", file=sys.stderr)

    finales = rpc_listado(url, key, CENTRO_ID)

    resumen = {
        "centro_id": imp.CENTRO_ID,
        "centro_nombre": "UEN Francisco Pimentel",
        "registros_previos_borrados": len(existentes_antes),
        "registrados_ok": len(resultados["ok"]),
        "errores": len(resultados["error"]),
        "conteo_final_bd": len(finales),
        "esperado": 701,
        "omitidos_archivo": len(omitidos),
        "cedulas_reasignadas": len(reasignados),
        "meta_preparacion": meta,
        "omitidos": [
            {
                "fila": o["fila"],
                "nombre": f"{o['primer_nombre']} {o['primer_apellido']}",
                "cedula": o["documento"] or "S/C",
                "motivo": o.get("motivo", ""),
            }
            for o in omitidos
        ],
        "detalle_errores": resultados["error"],
    }
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    return 1 if resultados["error"] or len(finales) != 701 else 0


if __name__ == "__main__":
    raise SystemExit(main())
