#!/usr/bin/env python3
"""Importa planilla censo/coliseo_la_urbina.txt al censo de centro-55 (Coliseo La Urbina)."""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-55"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/coliseo_la_urbina.txt")
FUNCIONARIO = {
    "jerarquia": "Sistema",
    "nombre": "Importación planilla",
    "institucion": "Refugios Transitorios",
    "telefono": "",
    "en_refugio": False,
}

ESTADO_MAP = {
    "LA GUAIRA": "La Guaira",
    "MIRANDA": "Miranda",
    "DTTO CAPITAL": "Distrito Capital",
    "DTTO. CAPITAL": "Distrito Capital",
    "NUEVA ESPARTA": "Nueva Esparta",
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


def norm_estado(raw: str) -> str:
    key = raw.strip().upper()
    return ESTADO_MAP.get(key, raw.strip())


def es_jefe(parentesco: str) -> bool:
    p = parentesco.upper()
    return any(
        x in p
        for x in ("JEFE", "REPRESENTANTE", "REPRESENSANTE", "JEFA DE FAMILIA")
    )


def mapear_parentesco(parentesco: str) -> str:
    p = parentesco.upper()
    if "HIJO" in p or "HIJA" in p:
        return "Hijo/a"
    if "NIET" in p:
        return "Nieto/a"
    if "ESPOS" in p or "CONYUG" in p or "PAREJA" in p:
        return "Cónyuge"
    if "MADRE" in p or "MAMA" in p or "MAMÁ" in p or "PADRE" in p:
        return "Otro familiar"
    if "HERMAN" in p:
        return "Hermano/a"
    return ""


def parse_linea(linea: str, nro: int) -> dict | None:
    linea = linea.strip()
    if not linea or linea.startswith("N°"):
        return None
    cols = linea.split("\t")
    if len(cols) < 5:
        return None
    while len(cols) < 11:
        cols.append("")
    _, cedula, nombre, apellido, sexo, edad_raw, _grupo, parentesco, cod_fam, procedencia, estado = cols[:11]

    primer_nombre, segundo_nombre = split_nombre(nombre)
    primer_apellido, segundo_apellido = split_nombre(apellido)
    if not primer_apellido and segundo_nombre:
        primer_apellido = segundo_nombre
        segundo_nombre = ""
    if not primer_apellido and " " in nombre.strip():
        partes = nombre.strip().split(None, 1)
        primer_nombre = partes[0]
        primer_apellido = partes[1] if len(partes) > 1 else ""
        segundo_nombre = ""

    if not primer_nombre or not primer_apellido:
        return None

    tipo_doc, documento = parse_cedula(cedula)
    sexo = sexo.strip().upper()
    if sexo not in ("M", "F"):
        sexo = ""
    edad = parse_edad(edad_raw)
    parentesco = parentesco.strip()

    return {
        "fila": nro,
        "cod_fam": cod_fam.strip(),
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
        "es_jefe": es_jefe(parentesco),
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
        "estado_federativo": norm_estado(estado),
        "municipio": "",
        "parroquia": "",
        "condicion_vivienda": "",
        "calle": procedencia.strip(),
        "casa_edificio": "",
    }


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
        elif reg["es_jefe"] and not reg["documento"]:
            pass
        elif not jefes_por_familia.get(reg["cod_fam"]):
            p = reg["parentesco"].upper()
            if any(x in p for x in ("MADRE", "MAMA", "MAMÁ", "PADRE")) and reg["documento"]:
                jefes_por_familia[reg["cod_fam"]] = (reg["tipo_doc"] or "V", reg["documento"])

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
    vistos_doc: set[str] = set()
    vistos_sc: set[tuple] = set()
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
        lines.extend(
            [
                "  BEGIN",
                "    SELECT public.censo_registrar(",
                f"      '{CENTRO_ID}',",
                f"      '{sql_escape(func_json)}'::jsonb,",
                f"      '{sql_escape(reg_json)}'::jsonb",
                "    ) INTO v_id;",
                f"    INSERT INTO _import_result VALUES ({reg['fila']}, '{sql_escape(nombre)}', 'ok', v_id::text);",
                "  EXCEPTION WHEN OTHERS THEN",
                "    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;",
                f"    INSERT INTO _import_result VALUES ({reg['fila']}, '{sql_escape(nombre)}', 'error', v_err);",
                "  END;",
            ]
        )
    lines.extend(
        [
            "END $$;",
            "SELECT status, COUNT(*) FROM _import_result GROUP BY status ORDER BY status;",
            "SELECT * FROM _import_result WHERE status = 'error' ORDER BY fila LIMIT 50;",
        ]
    )
    return "\n".join(lines)


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

    registros, reasignados = resolver_cedulas_duplicadas(registros)
    vincular_jefes_familia(registros)
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
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )

    batch_size = 40
    for i in range(0, len(ok), batch_size):
        batch = ok[i : i + batch_size]
        print(f"-- BATCH {i // batch_size + 1}")
        print(generar_sql_import(batch))
        print()


if __name__ == "__main__":
    main()
