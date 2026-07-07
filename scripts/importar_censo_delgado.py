#!/usr/bin/env python3
"""Importa planilla delgado chalbout.txt al censo de centro-33 vía SQL."""

import json
import re
import sys
from pathlib import Path

CENTRO_ID = "centro-33"
ARCHIVO = Path("/opt/refugio-ali-primera/delgado chalbout.txt")
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


def parse_linea(linea: str) -> dict | None:
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
    return {
        "primer_nombre": primer_nombre,
        "segundo_nombre": segundo_nombre,
        "primer_apellido": primer_apellido,
        "segundo_apellido": segundo_apellido,
        "edad": parse_edad(edad_raw),
        "tipo_doc": tipo_doc,
        "documento": documento,
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


def registro_a_payload(reg: dict) -> dict:
    out = dict(reg)
    out["edad"] = "" if out["edad"] is None else str(out["edad"])
    return out


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def generar_sql(registros: list[dict]) -> str:
    func_json = json.dumps(FUNCIONARIO, ensure_ascii=False)
    lines = ["DO $$", "DECLARE", "  v_id uuid;", "BEGIN"]
    for i, reg in enumerate(registros):
        payload = registro_a_payload(reg)
        reg_json = json.dumps(payload, ensure_ascii=False)
        lines.append(
            f"  SELECT public.censo_registrar("
            f"'{CENTRO_ID}', "
            f"'{sql_escape(func_json)}'::jsonb, "
            f"'{sql_escape(reg_json)}'::jsonb"
            f") INTO v_id;"
        )
    lines.append("END $$;")
    return "\n".join(lines)


def main():
    texto = ARCHIVO.read_text(encoding="utf-8")
    registros = []
    for linea in texto.splitlines():
        reg = parse_linea(linea)
        if reg:
            registros.append(reg)
    print(f"TOTAL_PARSED={len(registros)}", file=sys.stderr)
    # Salida: SQL por lotes de 50
    batch_size = 50
    for i in range(0, len(registros), batch_size):
        batch = registros[i : i + batch_size]
        print(f"-- BATCH {i // batch_size + 1} ({len(batch)} registros)")
        print(generar_sql(batch))
        print()


if __name__ == "__main__":
    main()
