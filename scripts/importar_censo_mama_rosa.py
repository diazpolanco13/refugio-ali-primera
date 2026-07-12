#!/usr/bin/env python3
"""Importa planilla censo/MAMA.txt al censo de centro-36 (CEIN Mamá Rosa)."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-36"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/MAMA.txt")
FUNCIONARIO = {
    "jerarquia": "Sistema",
    "nombre": "Importación planilla",
    "institucion": "Refugios Transitorios",
    "telefono": "",
    "en_refugio": False,
}

SIN_DOC = {
    "",
    "S/D",
    "SD",
    "S/C",
    "SC",
    "N/A",
    "NA",
    "N/P",
    "NP",
    "SIN CEDULA",
    "SIN CÉDULA",
    "MENOR",
}


def split_nombre_completo(texto: str) -> tuple[str, str, str, str]:
    texto = re.sub(r"[,\s]+$", "", (texto or "").strip())
    texto = re.sub(r"\s+", " ", texto)
    # Partículas frecuentes: DE / DEL entre nombres y apellidos
    partes = texto.split()
    if not partes:
        return "", "", "", ""
    if len(partes) == 1:
        return partes[0], "", "S/A", ""
    if len(partes) == 2:
        return partes[0], "", partes[1], ""
    if len(partes) == 3:
        return partes[0], "", partes[1], partes[2]
    # ARELYS JOSEFINA SALAZAR DE ULLOA → pn=ARELYS sn=JOSEFINA pa=SALAZAR sa=DE ULLOA
    if "DE" in partes[:-1] or "DEL" in partes[:-1]:
        idx = next(i for i, p in enumerate(partes) if p.upper() in ("DE", "DEL"))
        if idx >= 1:
            nombres = partes[:idx]
            apellidos = partes[idx:]
            if len(nombres) == 1:
                return nombres[0], "", " ".join(apellidos), ""
            return nombres[0], " ".join(nombres[1:]), " ".join(apellidos), ""
    return partes[0], " ".join(partes[1:-2]), partes[-2], partes[-1]


def parse_edad(raw: str) -> int | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    m = re.match(r"^(\d+)", raw)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper().replace(".", "").replace(",", "")
    if raw in SIN_DOC:
        return "", ""
    numeros = re.sub(r"[^\d]", "", raw)
    if not numeros:
        return "", ""
    return "V", numeros


def norm_doc(doc: str) -> str | None:
    n = re.sub(r"[^A-Za-z0-9]", "", doc or "").upper()
    return n or None


def es_sano(patologia: str) -> bool:
    p = re.sub(r"\s+", " ", (patologia or "").strip().upper())
    return (not p) or p in ("SANO", "SANA", "NINGUNA", "NINGUNO", "N/A", "NA")


def detectar_discapacidad(patologia: str) -> tuple[bool, str]:
    p = re.sub(r"\s+", " ", (patologia or "").strip())
    upper = p.upper()
    keys = (
        "DISCAPAC",
        "MOTORA",
        "AMPUTAC",
        "LIMITACION",
        "LIMITACIÓN",
        "CIEGEZ",
        "CEGUERA",
        "SORD",
    )
    if any(k in upper for k in keys):
        return True, p[:300]
    return False, ""


def detectar_enfermedad(patologia: str) -> tuple[bool, str]:
    if es_sano(patologia):
        return False, ""
    p = re.sub(r"\s+", " ", (patologia or "").strip())
    return True, p[:300]


def mapear_condicion_vivienda(condicion: str) -> str:
    # En esta planilla "PÁNICO" es condición emocional, no estado de vivienda.
    _ = condicion
    return ""


def notas_ubicacion_talla(
    torre: str, piso: str, apto: str, zapato: str, pantalon: str, camisa: str, condicion: str
) -> tuple[str, str]:
    ubica = " · ".join(
        x
        for x in [
            f"Torre {torre}" if torre else "",
            f"Piso {piso}" if piso else "",
            f"Apto {apto}" if apto else "",
        ]
        if x
    )
    tallas = " / ".join(
        x
        for x in [
            f"zapato {zapato}" if zapato else "",
            f"pantalón {pantalon}" if pantalon else "",
            f"camisa {camisa}" if camisa else "",
        ]
        if x
    )
    partes_calle = [x for x in [ubica, f"Tallas: {tallas}" if tallas else ""] if x]
    if condicion and condicion.upper() not in ("", "N/A", "NA"):
        partes_calle.append(f"Condición: {condicion}")
    calle = " | ".join(partes_calle)[:300]
    casa = ubica[:300]
    return calle, casa


def parse_lineas(texto: str) -> list[dict]:
    registros: list[dict] = []
    nro = 0
    for linea in texto.splitlines():
        if not linea.strip():
            continue
        cols = linea.split("\t")
        if not cols:
            continue
        head = cols[0].strip().upper()
        if head.startswith("NOMBRE") or head.startswith("NOMBRE Y APELLIDO"):
            continue
        while len(cols) < 15:
            cols.append("")

        (
            nombre,
            cedula,
            genero,
            edad_raw,
            _categoria,
            patologia,
            _si,
            _no,
            zapato,
            pantalon,
            camisa,
            torre,
            piso,
            apto,
            condicion,
        ) = [c.strip() for c in cols[:15]]

        pn, sn, pa, sa = split_nombre_completo(nombre)
        if not pn or not pa:
            continue

        nro += 1
        tipo_doc, documento = parse_cedula(cedula)
        sexo = genero.strip().upper()
        if sexo not in ("M", "F"):
            sexo = ""
        edad = parse_edad(edad_raw)
        discapacidad, discap_det = detectar_discapacidad(patologia)
        enfermedad, enf_det = detectar_enfermedad(patologia)
        # Si hay discapacidad y además patologías médicas, conservar enfermedad
        if discapacidad and not es_sano(patologia):
            # quitar solo la parte de discapacidad deja el resto como enfermedad
            if "DISCAPAC" in patologia.upper() or "MOTORA" in patologia.upper():
                enfermedad, enf_det = True, patologia.strip()[:300]

        calle, casa = notas_ubicacion_talla(
            torre, piso, apto, zapato, pantalon, camisa, condicion
        )
        cod_fam = f"{torre}|{piso}|{apto}".upper()

        registros.append(
            {
                "fila": nro,
                "cod_fam": cod_fam,
                "primer_nombre": pn,
                "segundo_nombre": sn,
                "primer_apellido": pa,
                "segundo_apellido": sa,
                "edad": edad,
                "tipo_doc": tipo_doc,
                "documento": documento,
                "documento_norm": norm_doc(documento),
                "sexo": sexo,
                "parentesco": "",
                "es_jefe": False,
                "telefono": "",
                "embarazada": False,
                "embarazo_semanas": "",
                "discapacidad": discapacidad,
                "discapacidad_detalle": discap_det if discapacidad else "",
                "enfermedad": enfermedad,
                "enfermedad_detalle": enf_det if enfermedad else "",
                "jefe_tipo_doc": "",
                "jefe_documento": "",
                "parentesco_jefe": "",
                "pais": "Venezuela",
                "estado_federativo": "Miranda",
                "municipio": "Baruta",
                "parroquia": "Baruta",
                "condicion_vivienda": mapear_condicion_vivienda(condicion),
                "calle": calle,
                "casa_edificio": casa,
            }
        )
    return registros


def asignar_jefes(registros: list[dict]) -> None:
    """Primer adulto (edad>=18) de cada apto = jefe; si no hay, el primero con cédula."""
    por_fam: dict[str, list[dict]] = defaultdict(list)
    for reg in registros:
        por_fam[reg["cod_fam"]].append(reg)

    for _fam, members in por_fam.items():
        jefe = next((r for r in members if r.get("edad") is not None and r["edad"] >= 18), None)
        if jefe is None:
            jefe = next((r for r in members if r["documento"]), None)
        if jefe is None:
            jefe = members[0]
        for reg in members:
            reg["es_jefe"] = reg is jefe
            reg["parentesco"] = "JEFE DE FAMILIA" if reg is jefe else "FAMILIAR"


def resolver_cedulas_duplicadas(registros: list[dict]) -> tuple[list[dict], list[dict]]:
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

    for reg in registros:
        if reg["es_jefe"]:
            continue
        jefe = jefes_por_familia.get(reg["cod_fam"])
        if not jefe:
            continue
        reg["jefe_tipo_doc"] = jefe[0]
        reg["jefe_documento"] = jefe[1]
        reg["parentesco_jefe"] = "Otro familiar"


def deduplicar(registros: list[dict]) -> tuple[list[dict], list[dict]]:
    vistos_doc: set[str] = set()
    vistos_sc: set[tuple] = set()
    ok: list[dict] = []
    omitidos: list[dict] = []
    for reg in registros:
        if reg["documento_norm"]:
            if reg["documento_norm"] in vistos_doc:
                omitidos.append({**reg, "motivo": "cédula duplicada tras resolución"})
                continue
            vistos_doc.add(reg["documento_norm"])
            ok.append(reg)
        else:
            key = (
                reg["primer_nombre"].upper(),
                reg["primer_apellido"].upper(),
                reg.get("edad"),
                reg["sexo"],
                reg.get("cod_fam"),
            )
            if key in vistos_sc:
                omitidos.append({**reg, "motivo": "sin cédula duplicada en planilla"})
                continue
            vistos_sc.add(key)
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
        return (reg.get("cod_fam") or "", prio, -(edad if edad is not None else -1), reg["fila"])

    return sorted(registros, key=sort_key)


def registro_payload(reg: dict) -> dict:
    payload = {
        k: v
        for k, v in reg.items()
        if k not in ("fila", "documento_norm", "cod_fam", "parentesco", "es_jefe")
    }
    payload["edad"] = "" if payload["edad"] is None else str(payload["edad"])
    return payload


def preparar(path: Path | None = None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    texto = path.read_text(encoding="utf-8")
    registros = parse_lineas(texto)
    asignar_jefes(registros)
    registros, reasignados = resolver_cedulas_duplicadas(registros)
    vincular_jefes_familia(registros)
    ok, omitidos = deduplicar(registros)
    ok = ordenar_para_importacion(ok)
    return registros, ok, omitidos, reasignados


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ARCHIVO)
    _, ok, omitidos, reasignados = preparar(path)
    print(
        json.dumps(
            {
                "centro_id": CENTRO_ID,
                "archivo": str(path),
                "a_importar": len(ok),
                "omitidos_archivo": len(omitidos),
                "cedulas_reasignadas": len(reasignados),
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
                "docs": [r["documento_norm"] for r in ok if r["documento_norm"]],
                "preview": [
                    {
                        "fila": r["fila"],
                        "fam": r["cod_fam"],
                        "nombre": f"{r['primer_nombre']} {r['segundo_nombre']} {r['primer_apellido']} {r['segundo_apellido']}".strip(),
                        "cedula": r["documento"] or "S/C",
                        "edad": r["edad"],
                        "sexo": r["sexo"],
                        "jefe": r["es_jefe"],
                        "parentesco_jefe": r["parentesco_jefe"],
                        "jefe_doc": r["jefe_documento"],
                        "discapacidad": r["discapacidad"],
                        "enfermedad": r["enfermedad"],
                        "enf": r["enfermedad_detalle"],
                        "calle": r["calle"],
                    }
                    for r in ok[:12]
                ],
                "stats": {
                    "jefes": sum(1 for r in ok if r["es_jefe"]),
                    "con_cedula": sum(1 for r in ok if r["documento"]),
                    "sin_cedula": sum(1 for r in ok if not r["documento"]),
                    "discapacidad": sum(1 for r in ok if r["discapacidad"]),
                    "enfermedad": sum(1 for r in ok if r["enfermedad"]),
                    "familias": len({r["cod_fam"] for r in ok}),
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
