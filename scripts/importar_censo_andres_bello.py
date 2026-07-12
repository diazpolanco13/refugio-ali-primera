#!/usr/bin/env python3
"""Importa planilla censo/andres bello.txt al censo de centro-32 (CE Andres Bello)."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-32"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/andres bello.txt")
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
    "S/N",
    "SN",
    "S/B",
    "SB",
    "N/A",
    "NA",
    "N/P",
    "NP",
    "SIN CEDULA",
    "SIN CÉDULA",
    "MENOR",
}


def split_nombre(texto: str) -> tuple[str, str]:
    partes = (texto or "").strip().split()
    if not partes:
        return "", ""
    if len(partes) == 1:
        return partes[0], ""
    return partes[0], " ".join(partes[1:])


def parse_edad(raw: str) -> int | None:
    raw = (raw or "").strip().upper().replace(",", ".")
    if not raw:
        return None
    if re.search(r"\d+\s*(MES|MESES|M\b)", raw):
        return 0
    if re.search(r"\d+\s*(AÑO|AÑOS|ANO|ANOS|A\b)", raw):
        m = re.search(r"(\d+)", raw)
        return int(m.group(1)) if m else 0
    m = re.match(r"^(\d+)", raw)
    if not m:
        return None
    try:
        edad = int(m.group(1))
        return edad if 0 <= edad <= 120 else None
    except ValueError:
        return None


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper().replace("\n", "").replace("\r", "")
    if raw in SIN_DOC:
        return "", ""
    numeros = re.sub(r"[^\d]", "", raw)
    if not numeros:
        return "", ""
    if len(numeros) < 5:
        return "", ""
    return "V", numeros


def norm_doc(doc: str) -> str | None:
    n = re.sub(r"[^A-Za-z0-9]", "", doc or "").upper()
    return n or None


def parse_sexo(raw: str) -> str:
    p = (raw or "").strip().upper()
    if p in ("M", "MASCULINO", "HOMBRE", "H"):
        return "M"
    if p in ("F", "FEMENINO", "MUJER", "FEMENINA"):
        return "F"
    return ""


def parse_telefono(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    upper = raw.upper()
    if upper in ("N/A", "N/P", "NA", "NP", "S/T", "S/N", "SIN TELEFONO", "SIN TELÉFONO"):
        return ""
    digitos = re.sub(r"[^\d]", "", raw)
    if len(digitos) < 7:
        return ""
    if digitos.startswith("0") and len(digitos) >= 11:
        digitos = digitos[1:]
    return digitos[:15]


def inferir_jefe_por_grupo(registros: list[dict]) -> None:
    """Marca como jefe al adulto mayor de cada grupo teléfono+dirección."""
    grupos: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for reg in registros:
        tel = reg["telefono"]
        dir_ = reg["direccion"].strip().upper()
        if not tel or not dir_:
            continue
        grupos[(tel, dir_)].append(reg)

    for miembros in grupos.values():
        if len(miembros) < 2:
            continue
        adultos = [m for m in miembros if (m.get("edad") or 0) >= 18]
        if not adultos:
            continue
        jefe = max(adultos, key=lambda m: (m.get("edad") or 0, -m["fila"]))
        jefe["es_jefe"] = True
        jefe_doc = (jefe["tipo_doc"] or "V", jefe["documento"])
        for m in miembros:
            if m is jefe:
                continue
            if jefe_doc[1]:
                m["jefe_tipo_doc"] = jefe_doc[0]
                m["jefe_documento"] = jefe_doc[1]
                m["parentesco_jefe"] = "Otro familiar"


def parse_lineas(texto: str) -> list[dict]:
    registros: list[dict] = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not linea.strip():
            continue
        cols = linea.split("\t")
        if not cols:
            continue
        header = cols[0].strip().upper()
        if header in ("N°", "N", "NO") and len(cols) > 1 and cols[1].strip().upper() == "NOMBRES":
            continue
        if not re.match(r"^\d+$", cols[0].strip()):
            continue
        while len(cols) < 13:
            cols.append("")

        fila = int(cols[0].strip())
        nombres = cols[1].strip()
        apellidos = cols[2].strip()
        cedula_raw = cols[3].strip()
        sexo_raw = cols[4].strip()
        direccion = cols[5].strip()
        edad_raw = cols[6].strip()
        _fecha = cols[7].strip()
        _brazalete = cols[8].strip()
        telefono_raw = cols[9].strip()
        aula = cols[10].strip()

        primer_nombre, segundo_nombre = split_nombre(nombres)
        primer_apellido, segundo_apellido = split_nombre(apellidos)
        if not primer_nombre or not primer_apellido:
            continue

        tipo_doc, documento = parse_cedula(cedula_raw)
        sexo = parse_sexo(sexo_raw)
        edad = parse_edad(edad_raw)
        telefono = parse_telefono(telefono_raw)

        casa = aula.strip()
        if casa and direccion:
            direccion_full = f"{direccion} | Aula: {casa}"
        elif casa:
            direccion_full = f"Aula: {casa}"
        else:
            direccion_full = direccion

        registros.append(
            {
                "fila": fila,
                "primer_nombre": primer_nombre,
                "segundo_nombre": segundo_nombre,
                "primer_apellido": primer_apellido,
                "segundo_apellido": segundo_apellido,
                "edad": edad,
                "tipo_doc": tipo_doc,
                "documento": documento,
                "documento_norm": norm_doc(documento),
                "sexo": sexo,
                "telefono": telefono,
                "direccion": direccion,
                "embarazada": False,
                "embarazo_semanas": "",
                "discapacidad": False,
                "discapacidad_detalle": "",
                "enfermedad": False,
                "enfermedad_detalle": "",
                "jefe_tipo_doc": "",
                "jefe_documento": "",
                "parentesco_jefe": "",
                "es_jefe": False,
                "pais": "Venezuela",
                "estado_federativo": "Distrito Capital",
                "municipio": "Libertador",
                "parroquia": "",
                "condicion_vivienda": "",
                "calle": direccion_full[:300],
                "casa_edificio": casa[:300],
            }
        )
    return registros


def resolver_cedulas_duplicadas(registros: list[dict]) -> tuple[list[dict], list[dict]]:
    by_doc: dict[str, list[dict]] = defaultdict(list)
    reasignados: list[dict] = []
    for reg in registros:
        if reg["documento_norm"]:
            by_doc[reg["documento_norm"]].append(reg)

    for nd, rows in by_doc.items():
        if len(rows) == 1:
            continue
        keeper = max(rows, key=lambda r: ((r.get("edad") or 0), -r["fila"]))
        for reg in rows:
            if reg is keeper:
                continue
            reasignados.append(
                {
                    "fila": reg["fila"],
                    "nombre": f"{reg['primer_nombre']} {reg['primer_apellido']}",
                    "cedula_original": reg["documento"],
                    "motivo": "cédula repetida en planilla; registrado sin documento",
                }
            )
            reg["tipo_doc"] = ""
            reg["documento"] = ""
            reg["documento_norm"] = None
    return registros, reasignados


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
            )
            if key in vistos_sc:
                omitidos.append({**reg, "motivo": "sin cédula duplicada en planilla"})
                continue
            vistos_sc.add(key)
            ok.append(reg)
    return ok, omitidos


def ordenar_para_importacion(registros: list[dict]) -> list[dict]:
    def sort_key(reg: dict) -> tuple:
        if reg.get("es_jefe"):
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
        if k not in ("fila", "documento_norm", "direccion", "es_jefe")
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


def preparar(path: Path | None = None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    registros = parse_lineas(path.read_text(encoding="utf-8"))
    registros, reasignados = resolver_cedulas_duplicadas(registros)
    inferir_jefe_por_grupo(registros)
    ok, omitidos = deduplicar(registros)
    ok = ordenar_para_importacion(ok)
    return registros, ok, omitidos, reasignados


def main() -> None:
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
                "cedulas": sorted({r["documento_norm"] for r in ok if r["documento_norm"]}),
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )

    modo = sys.argv[2] if len(sys.argv) > 2 else "preview"
    if modo == "sql":
        batch_size = 25
        for i in range(0, len(ok), batch_size):
            batch = ok[i : i + batch_size]
            print(f"-- BATCH {i // batch_size + 1}")
            print(generar_sql_import(batch))
            print()
    elif modo == "json":
        print(json.dumps([registro_payload(r) | {"fila": r["fila"]} for r in ok], ensure_ascii=False))


if __name__ == "__main__":
    main()
