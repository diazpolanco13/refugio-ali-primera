#!/usr/bin/env python3
"""Parsea planilla y genera SQL con manejo de errores por fila."""

import json
import re
import sys
from pathlib import Path

CENTRO_ID = "centro-33"
FUNCIONARIO = {
    "jerarquia": "Sistema",
    "nombre": "Importación planilla",
    "institucion": "Refugios Transitorios",
    "telefono": "",
    "en_refugio": False,
}


def split_nombre(texto: str) -> tuple[str, str]:
    partes = texto.strip().split(None, 1)
    if not partes:
        return "", ""
    if len(partes) == 1:
        return partes[0], ""
    return partes[0], partes[1]


def parse_edad(raw: str) -> int | None:
    raw = raw.strip()
    if not raw:
        return None
    if re.search(r"[a-zA-Z,]", raw):
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = raw.strip().upper()
    if raw in ("", "S/C", "SC", "SIN CEDULA", "SIN CÉDULA"):
        return "", ""
    return "V", raw


def norm_doc(doc: str) -> str | None:
    n = re.sub(r"[^A-Za-z0-9]", "", doc or "").upper()
    return n or None


def parse_linea(linea: str, nro: int) -> dict | None:
    linea = linea.strip()
    if not linea or linea.startswith("N°"):
        return None
    cols = linea.split("\t")
    if len(cols) < 5:
        return None
    while len(cols) < 8:
        cols.append("")
    _, cedula, nombre, apellido, sexo, _fecha, edad_raw, localidad = cols[:8]
    primer_nombre, segundo_nombre = split_nombre(nombre)
    primer_apellido, segundo_apellido = split_nombre(apellido)
    if not primer_nombre or not primer_apellido:
        return None
    tipo_doc, documento = parse_cedula(cedula)
    sexo = sexo.strip().upper()
    if sexo not in ("M", "F"):
        sexo = ""
    edad = parse_edad(edad_raw)
    return {
        "fila": nro,
        "primer_nombre": primer_nombre,
        "segundo_nombre": segundo_nombre,
        "primer_apellido": primer_apellido,
        "segundo_apellido": segundo_apellido,
        "edad": edad,
        "tipo_doc": tipo_doc,
        "documento": documento,
        "documento_norm": norm_doc(documento),
        "sexo": sexo,
        "telefono": "",
        "embarazada": False,
        "embarazo_semanas": "",
        "discapacidad": False,
        "discapacidad_detalle": "",
        "enfermedad": False,
        "enfermedad_detalle": "",
        "jefe_tipo_doc": "",
        "jefe_documento": "",
        "parentesco_jefe": "",
        "pais": "Venezuela",
        "estado_federativo": "Distrito Capital",
        "municipio": "Libertador",
        "parroquia": "",
        "condicion_vivienda": "",
        "calle": localidad.strip(),
        "casa_edificio": "",
    }


def registro_payload(reg: dict) -> dict:
    payload = {k: v for k, v in reg.items() if k not in ("fila", "documento_norm")}
    payload["edad"] = "" if payload["edad"] is None else str(payload["edad"])
    return payload


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def generar_sql_import(registros: list[dict]) -> str:
    func_json = json.dumps(FUNCIONARIO, ensure_ascii=False)
    lines = [
        "CREATE TEMP TABLE IF NOT EXISTS _import_result (",
        "  fila int,",
        "  nombre text,",
        "  status text,",
        "  detalle text",
        ") ON COMMIT DROP;",
        "TRUNCATE _import_result;",
        "DO $$",
        "DECLARE",
        "  v_id uuid;",
        "  v_err text;",
        "BEGIN",
    ]
    for reg in registros:
        payload = registro_payload(reg)
        reg_json = json.dumps(payload, ensure_ascii=False)
        nombre = f"{reg['primer_nombre']} {reg['primer_apellido']}"
        lines.extend([
            "  BEGIN",
            f"    SELECT public.censo_registrar(",
            f"      '{CENTRO_ID}',",
            f"      '{sql_escape(func_json)}'::jsonb,",
            f"      '{sql_escape(reg_json)}'::jsonb",
            f"    ) INTO v_id;",
            f"    INSERT INTO _import_result VALUES ({reg['fila']}, '{sql_escape(nombre)}', 'ok', v_id::text);",
            "  EXCEPTION WHEN OTHERS THEN",
            "    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;",
            f"    INSERT INTO _import_result VALUES ({reg['fila']}, '{sql_escape(nombre)}', 'error', v_err);",
            "  END;",
        ])
    lines.extend([
        "END $$;",
        "SELECT status, COUNT(*) FROM _import_result GROUP BY status ORDER BY status;",
        "SELECT * FROM _import_result WHERE status = 'error' ORDER BY fila LIMIT 50;",
    ])
    return "\n".join(lines)


def deduplicar(registros: list[dict]) -> tuple[list[dict], list[dict]]:
    vistos_doc: set[str] = set()
    vistos_sc: set[tuple] = set()
    ok: list[dict] = []
    omitidos: list[dict] = []
    for reg in registros:
        if reg["documento_norm"]:
            if reg["documento_norm"] in vistos_doc:
                reg = {**reg, "motivo": "cédula duplicada en planilla"}
                omitidos.append(reg)
                continue
            vistos_doc.add(reg["documento_norm"])
            ok.append(reg)
        else:
            key = (
                reg["primer_nombre"].upper(),
                reg["primer_apellido"].upper(),
                reg.get("edad"),
                reg["sexo"],
            )
            if key in vistos_sc:
                reg = {**reg, "motivo": "sin cédula duplicada en planilla"}
                omitidos.append(reg)
                continue
            vistos_sc.add(key)
            ok.append(reg)
    return ok, omitidos


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/refugio-ali-primera/delgado chalbout.txt")
    texto = path.read_text(encoding="utf-8")
    if not texto.strip():
        print("ERROR: archivo vacío", file=sys.stderr)
        sys.exit(1)
    registros = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        reg = parse_linea(linea, i)
        if reg:
            registros.append(reg)
    ok, omitidos = deduplicar(registros)
    print(json.dumps({
        "total_parseados": len(registros),
        "a_importar": len(ok),
        "omitidos_archivo": len(omitidos),
        "omitidos": [
            {
                "fila": o["fila"],
                "nombre": f"{o['primer_nombre']} {o['primer_apellido']}",
                "cedula": o["documento"] or "S/C",
                "motivo": o.get("motivo", ""),
            }
            for o in omitidos
        ],
    }, ensure_ascii=False, indent=2), file=sys.stderr)
    batch_size = 40
    for i in range(0, len(ok), batch_size):
        batch = ok[i : i + batch_size]
        print(f"-- BATCH {i // batch_size + 1}")
        print(generar_sql_import(batch))
        print()


if __name__ == "__main__":
    main()
