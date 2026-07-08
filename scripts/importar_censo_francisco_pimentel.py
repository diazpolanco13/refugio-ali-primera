#!/usr/bin/env python3
"""Importa planilla censo/francisco_pimentel.txt al censo de centro-02 (UEN Francisco Pimentel)."""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-02"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/francisco_pimentel.txt")
# Duplicados confirmados por el usuario (mantener #15 ILYAN TOVAR y #569 YEKEIZA BARRIOS).
FILAS_EXCLUIDAS = {219, 581}
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
    meses = re.match(r"^(\d+)\s*MESES?$", raw, re.I)
    if meses:
        return 0
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


def es_jefe(parentesco: str, cedula: str, cedula_jefe: str) -> bool:
    if "JEFE" in parentesco.upper():
        return True
    if cedula and cedula_jefe and cedula.strip() == cedula_jefe.strip():
        return True
    return False


def mapear_parentesco(parentesco: str) -> str:
    p = parentesco.upper()
    if "HIJO" in p or "HIJA" in p:
        return "Hijo/a"
    if "NIET" in p:
        return "Nieto/a"
    if "ESPOS" in p or "CONYUG" in p or "PAREJA" in p or "CÓNYUGE" in p:
        return "Cónyuge"
    if "HERMAN" in p:
        return "Hermano/a"
    if "SOBRIN" in p:
        return "Sobrino/a"
    if "MADRE" in p or "MAMA" in p or "MAMÁ" in p or "PADRE" in p:
        return "Otro familiar"
    return ""


def mapear_sexo(raw: str) -> str:
    s = raw.strip().upper()
    if s in ("MASCULINO", "M"):
        return "M"
    if s in ("FEMENINO", "F"):
        return "F"
    return ""


def mapear_condicion_vivienda(raw: str) -> str:
    u = raw.upper()
    if "ROJO" in u or "COLAPSO" in u:
        return "destruida"
    if "AMARILLO" in u or "INHABITABLE" in u:
        return "inhabitable"
    return ""


def es_embarazada(vulnerabilidad: str, medicacion: str) -> bool:
    texto = f"{vulnerabilidad} {medicacion}".upper()
    if "LACTAN" in texto:
        return False
    return "EMBARAZ" in texto


def es_discapacidad(vulnerabilidad: str, condicion_medica: str) -> tuple[bool, str]:
    texto = f"{vulnerabilidad} {condicion_medica}".upper()
    claves = (
        "DISCAPACIDAD",
        "LIMITACIÓN MOTRIZ",
        "LIMITACION MOTRIZ",
        "INCAPACIDAD VISUAL",
        "DEPENDENCIA SEVERA",
        "DISCAPACIDAD MENTAL",
    )
    for clave in claves:
        if clave in texto:
            detalle = vulnerabilidad.strip() or condicion_medica.strip()
            return True, detalle
    return False, ""


def es_enfermedad(condicion_medica: str) -> tuple[bool, str]:
    c = condicion_medica.strip().upper()
    if not c or c in ("NINGUNA", "NINGUNO", "N/A", "NO APLICA"):
        return False, ""
    return True, condicion_medica.strip()


def parse_linea(linea: str, nro: int) -> dict | None:
    linea = linea.strip()
    if not linea or linea.startswith("N°"):
        return None

    cols = linea.split("\t")
    if len(cols) < 8:
        return None
    while len(cols) < 32:
        cols.append("")

    n_fila = cols[0].strip()
    try:
        n_planilla = int(n_fila)
    except ValueError:
        n_planilla = nro - 1

    retiro = cols[31].strip()
    if retiro or n_planilla in FILAS_EXCLUIDAS:
        return None

    (
        _n,
        _marca,
        _fecha_ingreso,
        _comuna,
        _nombre_jefe,
        cedula_jefe,
        nombre,
        apellido,
        cedula,
        parentesco,
        _fecha_nac,
        edad_raw,
        _categoria,
        sexo_raw,
        telefono,
        _sector,
        _institucion,
        _tipo_vivienda,
        direccion,
        estado_vivienda,
        condicion_medica,
        medicacion,
        vulnerabilidad,
        *_rest,
    ) = cols[:32]

    primer_nombre, segundo_nombre = split_nombre(nombre)
    primer_apellido, segundo_apellido = split_nombre(apellido)
    if not primer_nombre or not primer_apellido:
        return None

    tipo_doc, documento = parse_cedula(cedula)
    sexo = mapear_sexo(sexo_raw)
    edad = parse_edad(edad_raw)
    parentesco = parentesco.strip()
    discapacidad, discapacidad_detalle = es_discapacidad(vulnerabilidad, condicion_medica)
    enfermedad, enfermedad_detalle = es_enfermedad(condicion_medica)
    embarazada = sexo == "F" and es_embarazada(vulnerabilidad, medicacion)

    return {
        "fila": n_planilla,
        "cod_fam": cedula_jefe.strip(),
        "primer_nombre": primer_nombre,
        "segundo_nombre": segundo_nombre,
        "primer_apellido": primer_apellido,
        "segundo_apellido": segundo_apellido,
        "edad": edad,
        "tipo_doc": tipo_doc,
        "documento": documento,
        "documento_norm": norm_doc(documento),
        "sexo": sexo,
        "parentesco": parentesco,
        "es_jefe": es_jefe(parentesco, documento, cedula_jefe),
        "telefono": telefono.strip(),
        "embarazada": embarazada,
        "embarazo_semanas": "",
        "discapacidad": discapacidad,
        "discapacidad_detalle": discapacidad_detalle,
        "enfermedad": enfermedad,
        "enfermedad_detalle": enfermedad_detalle,
        "jefe_tipo_doc": "",
        "jefe_documento": "",
        "parentesco_jefe": "",
        "pais": "Venezuela",
        "estado_federativo": "Distrito Capital",
        "municipio": "Libertador",
        "parroquia": "Santa Teresa",
        "condicion_vivienda": mapear_condicion_vivienda(estado_vivienda),
        "calle": direccion.strip(),
        "casa_edificio": "",
    }


def resolver_cedulas_duplicadas(registros: list[dict]) -> tuple[list[dict], list[dict]]:
    """Si una cédula aparece en varias filas, conserva la del jefe de hogar."""
    by_doc: dict[str, list[dict]] = defaultdict(list)
    reasignados: list[dict] = []
    for reg in registros:
        if reg["documento_norm"]:
            by_doc[reg["documento_norm"]].append(reg)

    for _nd, rows in by_doc.items():
        if len(rows) == 1:
            continue
        jefes = [r for r in rows if r["es_jefe"]]
        keeper = jefes[0] if jefes else rows[0]
        for reg in rows:
            if reg is keeper:
                continue
            reasignados.append(
                {
                    "fila": reg["fila"],
                    "nombre": f"{reg['primer_nombre']} {reg['primer_apellido']}",
                    "cedula_original": reg["documento"],
                    "motivo": "cédula compartida en planilla; registrado sin documento",
                }
            )
            reg["tipo_doc"] = ""
            reg["documento"] = ""
            reg["documento_norm"] = None

    return registros, reasignados


def vincular_jefes_familia(registros: list[dict]) -> None:
    jefes_por_familia: dict[str, tuple[str, str]] = {}
    for reg in registros:
        if reg["es_jefe"] and reg["documento"]:
            jefes_por_familia[reg["cod_fam"]] = (reg["tipo_doc"] or "V", reg["documento"])
        elif reg["cod_fam"] and reg["cod_fam"] not in jefes_por_familia:
            tipo, doc = parse_cedula(reg["cod_fam"])
            if doc:
                jefes_por_familia[reg["cod_fam"]] = (tipo or "V", doc)

    for reg in registros:
        if reg["es_jefe"]:
            continue
        edad = reg.get("edad")
        if edad is not None and edad >= 18:
            continue
        jefe = jefes_por_familia.get(reg["cod_fam"])
        if not jefe:
            continue
        reg["jefe_tipo_doc"] = jefe[0]
        reg["jefe_documento"] = jefe[1]
        reg["parentesco_jefe"] = mapear_parentesco(reg["parentesco"])


def deduplicar(registros: list[dict]) -> tuple[list[dict], list[dict]]:
    """Solo deduplica por cédula. Sin cédula se conservan todos (p. ej. mellizos)."""
    vistos_doc: set[str] = set()
    ok: list[dict] = []
    omitidos: list[dict] = []
    for reg in registros:
        if reg["documento_norm"]:
            if reg["documento_norm"] in vistos_doc:
                reg = {**reg, "motivo": "cédula duplicada tras resolución"}
                omitidos.append(reg)
                continue
            vistos_doc.add(reg["documento_norm"])
        ok.append(reg)
    return ok, omitidos


def ordenar_para_importacion(registros: list[dict]) -> list[dict]:
    def sort_key(reg: dict) -> tuple:
        if reg["es_jefe"]:
            prio = 0
        elif reg.get("edad") is not None and reg["edad"] >= 18:
            prio = 1
        else:
            prio = 2
        edad = reg.get("edad")
        return (prio, -(edad if edad is not None else -1), reg["fila"])

    return sorted(registros, key=sort_key)


def registro_payload(reg: dict) -> dict:
    payload = {
        k: v
        for k, v in reg.items()
        if k not in ("fila", "documento_norm", "cod_fam", "parentesco", "es_jefe")
    }
    payload["edad"] = "" if payload["edad"] is None else str(payload["edad"])
    return payload


def preparar_registros(path: Path | None = None) -> tuple[list[dict], list[dict], list[dict], dict]:
    path = path or ARCHIVO
    texto = path.read_text(encoding="utf-8")
    if not texto.strip():
        raise ValueError("archivo vacío")

    registros = []
    excluidos_retiro = 0
    excluidos_fila = 0
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not linea.strip() or linea.startswith("N°"):
            continue
        cols = linea.split("\t")
        try:
            n_planilla = int(cols[0].strip())
        except (ValueError, IndexError):
            continue
        if len(cols) > 31 and cols[31].strip():
            excluidos_retiro += 1
            continue
        if n_planilla in FILAS_EXCLUIDAS:
            excluidos_fila += 1
            continue
        reg = parse_linea(linea, i)
        if reg:
            registros.append(reg)

    registros, reasignados = resolver_cedulas_duplicadas(registros)
    vincular_jefes_familia(registros)
    ok, omitidos = deduplicar(registros)
    ok = ordenar_para_importacion(ok)

    meta = {
        "centro_id": CENTRO_ID,
        "archivo": str(path),
        "excluidos_retiro": excluidos_retiro,
        "excluidos_fila_duplicada": excluidos_fila,
        "total_parseados": len(registros),
        "a_importar": len(ok),
        "omitidos_archivo": len(omitidos),
        "cedulas_reasignadas": len(reasignados),
    }
    return ok, omitidos, reasignados, meta


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ARCHIVO)
    ok, omitidos, reasignados, meta = preparar_registros(path)
    print(
        json.dumps(
            {
                **meta,
                "omitidos": [
                    {
                        "fila": o["fila"],
                        "nombre": f"{o['primer_nombre']} {o['primer_apellido']}",
                        "cedula": o["documento"] or "S/C",
                        "motivo": o.get("motivo", ""),
                    }
                    for o in omitidos
                ],
                "cedulas_reasignadas_detalle": reasignados,
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )
    return 0 if meta["a_importar"] == 701 else 1


if __name__ == "__main__":
    raise SystemExit(main())
