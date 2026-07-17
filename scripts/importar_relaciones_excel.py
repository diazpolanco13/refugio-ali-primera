#!/usr/bin/env python3
"""Importa relaciones externas (Excel/CSV/TSV) a censo_registros vía RPC.

Uso típico (agente MCP / operador):

  # 1) Solo matching + preview (no escribe BD)
  python3 scripts/importar_relaciones_excel.py \\
      --archivo /tmp/liceo.xlsx --dry-run

  # 2) Con centro forzado (si el Excel es de un solo campamento)
  python3 scripts/importar_relaciones_excel.py \\
      --archivo /tmp/liceo.xlsx --centro-id centro-6 --aplicar

  # 3) Columna de nombre de escuela en el archivo + matching fuzzy
  python3 scripts/importar_relaciones_excel.py \\
      --archivo /tmp/red.csv --col-centro Campamento --aplicar

Requiere sesión admin/analista:
  NEXUS_SCRIPT_EMAIL=... NEXUS_SCRIPT_PASSWORD=...

Tras importar cédulas, opcional:
  python3 scripts/precargar_nexus_censo.py --limit 500
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"
DEFAULT_URL = "https://xzwifkckkakldnzkdeby.supabase.co"

# Reutiliza aliases del censo oficial (typos frecuentes).
ALIASES_NOMBRE: dict[str, str] = {
    "delgado chalbaud": "centro-33",
    "delgado chalboud": "centro-33",
    "perez bonalde": "centro-34",
    "pérez bonalde": "centro-34",
    "bonalde": "centro-34",
    "lossada": "centro-11",
    "losada": "centro-11",
    "mama rosa": "centro-36",
    "mamá rosa": "centro-36",
}

PREFIJOS = re.compile(
    r"^(u\.?\s*e\.?\s*n\.?\s*b\.?|u\.?\s*e\.?\s*n\.?|u\.?\s*e\.?\s*d\.?|u\.?\s*e\.?\s*e\.?|"
    r"u\.?\s*e\.?\s*|e\.?\s*n\.?\s*b\.?|e\.?\s*b\.?\s*e\.?|e\.?\s*b\.?\s*n\.?|"
    r"e\.?\s*t\.?\s*i\.?|c\.?\s*e\.?\s*i\.?\s*n\.?|c\.?\s*e\.?\s*i\.?|c\.?\s*e\.?\s*n\.?|"
    r"c\.?\s*e\.?\s*|complejo\s+educativo|liceo|escuela(\s+integral\s+basica)?|"
    r"unidad\s+educativa|refugio(\s+para)?|universidad|polideportivo|estadio|"
    r"fundacion|campamento|centro\s+de\s+educacion\s+inicial)\s+",
    re.I,
)

SIN_CEDULA = {"", "S/C", "SC", "SIN CEDULA", "SIN CÉDULA", "N/A", "NA", "-"}


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def normalizar_nombre(s: str) -> str:
    s = strip_accents((s or "").lower())
    s = s.replace("ü", "u")
    s = PREFIJOS.sub("", s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> set[str]:
    return {t for t in normalizar_nombre(s).split() if len(t) > 1}


def score_nombres(a: str, b: str) -> float:
    na, nb = normalizar_nombre(a), normalizar_nombre(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.92
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    jaccard = inter / union
    nucleo_a = na.split()[-1] if na.split() else ""
    nucleo_b = nb.split()[-1] if nb.split() else ""
    if nucleo_a and nucleo_a == nucleo_b and inter >= 1:
        jaccard = max(jaccard, 0.75)
    return jaccard


@dataclass
class CentroApp:
    id: str
    nombre: str


def cargar_env() -> tuple[str, str]:
    valores: dict[str, str] = {}
    if ENV.exists():
        for linea in ENV.read_text(encoding="utf-8").readlines():
            linea = linea.strip()
            for clave in ("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"):
                if linea.startswith(f"{clave}="):
                    valores[clave] = linea.split("=", 1)[1].strip().strip('"').strip("'")
    url = os.environ.get("VITE_SUPABASE_URL", valores.get("VITE_SUPABASE_URL", DEFAULT_URL))
    key = os.environ.get("VITE_SUPABASE_ANON_KEY", valores.get("VITE_SUPABASE_ANON_KEY", ""))
    if not key:
        raise SystemExit("Falta VITE_SUPABASE_ANON_KEY")
    return url.rstrip("/"), key


def autenticar(url: str, anon_key: str) -> str:
    email = os.environ.get("NEXUS_SCRIPT_EMAIL")
    password = os.environ.get("NEXUS_SCRIPT_PASSWORD")
    if not email or not password:
        raise SystemExit("Faltan NEXUS_SCRIPT_EMAIL / NEXUS_SCRIPT_PASSWORD")
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        data=body,
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    token = data.get("access_token")
    if not token:
        raise SystemExit("Login falló: sin access_token")
    return token


def rpc(url: str, anon_key: str, jwt: str, fn: str, payload: dict) -> object:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/{fn}",
        data=body,
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {jwt}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        raise SystemExit(f"RPC {fn} falló HTTP {e.code}: {detail}") from e


def listar_centros(url: str, anon_key: str, jwt: str) -> list[CentroApp]:
    # PostgREST select
    req = urllib.request.Request(
        f"{url}/rest/v1/centros?select=id,data&deleted=eq.false&limit=500",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {jwt}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        rows = json.loads(resp.read().decode())
    out: list[CentroApp] = []
    for r in rows:
        d = r.get("data") or {}
        out.append(CentroApp(id=r["id"], nombre=(d.get("nombre") or r["id"]).strip()))
    return out


def resolver_centro(
    nombre_raw: str,
    centros: list[CentroApp],
    forzado: str | None,
) -> tuple[str | None, str, str]:
    if forzado:
        return forzado, nombre_raw, "forzado"
    raw = (nombre_raw or "").strip()
    if not raw:
        return None, "", ""
    key = normalizar_nombre(raw)
    if key in ALIASES_NOMBRE:
        return ALIASES_NOMBRE[key], raw, "alias"
    best: CentroApp | None = None
    best_score = 0.0
    for c in centros:
        sc = score_nombres(raw, c.nombre)
        if sc > best_score:
            best_score = sc
            best = c
    if best and best_score >= 0.99:
        return best.id, raw, "exacto"
    if best and best_score >= 0.75:
        return best.id, raw, "fuzzy"
    return None, raw, ""


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper()
    if raw in SIN_CEDULA:
        return "", ""
    m = re.match(r"^([VEP])[-\s.]?(\d+)$", raw)
    if m:
        return m.group(1), m.group(2)
    digits = re.sub(r"\D", "", raw)
    if digits:
        return "V", digits
    return "", ""


def split_nombre(texto: str) -> tuple[str, str]:
    partes = (texto or "").strip().split(None, 1)
    if not partes:
        return "", ""
    if len(partes) == 1:
        return partes[0], ""
    return partes[0], partes[1]


def leer_filas(path: Path) -> list[dict[str, str]]:
    suf = path.suffix.lower()
    if suf in {".xlsx", ".xlsm"}:
        try:
            import openpyxl  # type: ignore
        except ImportError as e:
            raise SystemExit(
                "Para .xlsx instale openpyxl: pip install openpyxl"
            ) from e
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h or "").strip() for h in rows[0]]
        out = []
        for row in rows[1:]:
            d = {}
            for i, h in enumerate(headers):
                if not h:
                    continue
                val = row[i] if i < len(row) else None
                d[h] = "" if val is None else str(val).strip()
            if any(d.values()):
                out.append(d)
        return out

    # CSV / TSV / TXT
    text = path.read_text(encoding="utf-8-sig")
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    reader = csv.DictReader(text.splitlines(), dialect=dialect)
    return [{k.strip(): (v or "").strip() for k, v in row.items() if k} for row in reader]


def pick(row: dict[str, str], *candidatos: str) -> str:
    lower_map = {k.lower(): v for k, v in row.items()}
    for c in candidatos:
        if c.lower() in lower_map and lower_map[c.lower()]:
            return lower_map[c.lower()]
    return ""


def fila_a_payload(
    row: dict[str, str],
    centros: list[CentroApp],
    centro_forzado: str | None,
    col_centro: str | None,
) -> dict | None:
    ced_raw = pick(row, "cedula", "cédula", "documento", "ci", "doc")
    tipo_doc, documento = parse_cedula(ced_raw)

    nombre = pick(row, "nombres", "nombre", "primer_nombre")
    apellido = pick(row, "apellidos", "apellido", "primer_apellido")
    if not nombre and not apellido:
        completo = pick(row, "nombre_completo", "beneficiario", "persona")
        if completo:
            partes = completo.split()
            if len(partes) >= 2:
                nombre, apellido = partes[0], " ".join(partes[1:])
            else:
                nombre = completo

    primer_nombre, segundo_nombre = split_nombre(nombre)
    primer_apellido, segundo_apellido = split_nombre(apellido)
    if not primer_nombre or not primer_apellido:
        return None

    sexo = pick(row, "sexo", "genero", "género").upper()[:1]
    if sexo not in ("M", "F"):
        sexo = ""

    edad_raw = pick(row, "edad", "age")
    edad = None
    if edad_raw:
        m = re.search(r"\d+", edad_raw)
        if m:
            edad = int(m.group(0))

    nombre_centro = ""
    if col_centro:
        nombre_centro = row.get(col_centro) or pick(row, col_centro)
    if not nombre_centro:
        nombre_centro = pick(
            row, "campamento", "centro", "escuela", "refugio", "institucion", "institución"
        )

    centro_id, raw, match = resolver_centro(nombre_centro, centros, centro_forzado)
    if not centro_id:
        return {
            "_error": "sin_centro",
            "nombre_centro_raw": raw or nombre_centro,
            "documento": documento,
            "nombre": f"{primer_nombre} {primer_apellido}",
        }

    return {
        "centro_id": centro_id,
        "nombre_centro_raw": raw or nombre_centro,
        "centro_match": match,
        "primer_nombre": primer_nombre,
        "segundo_nombre": segundo_nombre,
        "primer_apellido": primer_apellido,
        "segundo_apellido": segundo_apellido,
        "edad": str(edad) if edad is not None else "",
        "tipo_doc": tipo_doc,
        "documento": documento,
        "sexo": sexo,
        "telefono": pick(row, "telefono", "teléfono", "celular", "phone"),
        "pais": pick(row, "pais", "país") or "Venezuela",
        "estado_federativo": pick(row, "estado", "estado_federativo"),
        "municipio": pick(row, "municipio"),
        "parroquia": pick(row, "parroquia"),
        "calle": pick(row, "direccion", "dirección", "calle", "sector"),
        "casa_edificio": pick(row, "casa", "edificio", "casa_edificio"),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Importa Excel/CSV a Importaciones Excel")
    ap.add_argument("--archivo", required=True, type=Path)
    ap.add_argument("--centro-id", default=None, help="Fuerza centro_id (skip matching)")
    ap.add_argument("--col-centro", default=None, help="Columna con nombre de escuela")
    ap.add_argument("--aplicar", action="store_true", help="Llama censo_importar_lote")
    ap.add_argument("--dry-run", action="store_true", help="Solo reporte (default si no --aplicar)")
    ap.add_argument("--lote", type=int, default=200, help="Tamaño de lote RPC")
    ap.add_argument("--solo-con-cedula", action="store_true", help="Omite filas sin documento")
    ap.add_argument("--json-out", type=Path, default=None)
    args = ap.parse_args()

    if not args.archivo.exists():
        raise SystemExit(f"No existe {args.archivo}")

    dry = args.dry_run or not args.aplicar
    url, anon = cargar_env()
    jwt = autenticar(url, anon)
    centros = listar_centros(url, anon, jwt)
    rows = leer_filas(args.archivo)

    ok: list[dict] = []
    errores: list[dict] = []
    sin_cedula = 0
    con_cedula = 0

    for row in rows:
        payload = fila_a_payload(row, centros, args.centro_id, args.col_centro)
        if payload is None:
            errores.append({"error": "fila_incompleta", "row": row})
            continue
        if payload.get("_error"):
            errores.append(payload)
            continue
        if payload.get("documento"):
            con_cedula += 1
        else:
            sin_cedula += 1
            if args.solo_con_cedula:
                continue
        ok.append(payload)

    # Prioriza cédulas al frente del lote
    ok.sort(key=lambda f: (0 if f.get("documento") else 1))

    reporte = {
        "archivo": args.archivo.name,
        "filas_leidas": len(rows),
        "listas": len(ok),
        "con_cedula": con_cedula,
        "sin_cedula": sin_cedula,
        "errores_match": len(errores),
        "errores": errores[:50],
        "muestra": ok[:5],
    }
    print(json.dumps(reporte, ensure_ascii=False, indent=2))

    if args.json_out:
        args.json_out.write_text(
            json.dumps({"filas": ok, "errores": errores}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"JSON escrito: {args.json_out}", file=sys.stderr)

    if dry:
        print("Dry-run: no se escribió en BD. Use --aplicar para importar.", file=sys.stderr)
        return

    insertados = actualizados = omitidos = 0
    errores_rpc: list = []
    for i in range(0, len(ok), args.lote):
        chunk = ok[i : i + args.lote]
        result = rpc(
            url,
            anon,
            jwt,
            "censo_importar_lote",
            {
                "p_filas": chunk,
                "p_meta": {"fuente_archivo": args.archivo.name},
            },
        )
        if isinstance(result, dict):
            insertados += int(result.get("insertados") or 0)
            actualizados += int(result.get("actualizados") or 0)
            omitidos += int(result.get("omitidos") or 0)
            err = result.get("errores") or []
            if isinstance(err, list):
                errores_rpc.extend(err)
        print(f"Lote {i // args.lote + 1}: {result}", file=sys.stderr)

    print(
        json.dumps(
            {
                "insertados": insertados,
                "actualizados": actualizados,
                "omitidos": omitidos,
                "errores_rpc": errores_rpc[:30],
                "siguiente": "python3 scripts/precargar_nexus_censo.py --limit 500",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
