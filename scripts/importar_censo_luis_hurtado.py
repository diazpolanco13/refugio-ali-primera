#!/usr/bin/env python3
"""Importa planilla censo/luis_hurtado_higuera.txt al censo de centro-26 (UE Luis Hurtado)."""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-26"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/luis_hurtado_higuera.txt")
CEDULA_JEFE_NO_SE = "NO SE"
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
    _, cedula, nombre, apellido, _original, sexo, _fecha, edad_raw = cols[:8]
    primer_nombre, segundo_nombre = split_nombre(nombre)
    primer_apellido, segundo_apellido = split_nombre(apellido)
    if not primer_nombre or not primer_apellido:
        return None
    tipo_doc, documento = parse_cedula(cedula)
    sexo = sexo.strip().upper()
    if sexo not in ("M", "F"):
        sexo = ""
    edad = parse_edad(edad_raw)
    es_menor = edad is not None and edad < 18
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
        "jefe_tipo_doc": "" if not es_menor else "V",
        "jefe_documento": "" if not es_menor else CEDULA_JEFE_NO_SE,
        "parentesco_jefe": "" if not es_menor else "Otro familiar",
        "pais": "Venezuela",
        "estado_federativo": "Distrito Capital",
        "municipio": "Libertador",
        "parroquia": "El Junquito",
        "condicion_vivienda": "",
        "calle": "",
        "casa_edificio": "",
    }


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


def ordenar_para_importacion(registros: list[dict]) -> list[dict]:
    def sort_key(reg: dict) -> tuple:
        edad = reg.get("edad")
        if edad is not None and edad >= 18:
            prio = 0
        else:
            prio = 1
        return (prio, -(edad if edad is not None else -1), reg["fila"])

    return sorted(registros, key=sort_key)


def registro_payload(reg: dict) -> dict:
    payload = {k: v for k, v in reg.items() if k not in ("fila", "documento_norm")}
    payload["edad"] = "" if payload["edad"] is None else str(payload["edad"])
    return payload


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ARCHIVO)
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
    ok = ordenar_para_importacion(ok)

    print(
        json.dumps(
            {
                "centro_id": CENTRO_ID,
                "archivo": str(path),
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
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
