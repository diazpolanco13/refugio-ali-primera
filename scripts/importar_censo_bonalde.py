#!/usr/bin/env python3
"""Importa planilla censo/bonalde.txt al censo de centro-34 (UED Juan Antonio Perez Bonal)."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-34"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/bonalde.txt")
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
    "N/A",
    "NA",
    "N/P",
    "NP",
    "NO APLICA",
    "NO APLICA.",
    "MENOR",
    "R/N",
    "RN",
}


def split_nombre_completo(texto: str) -> tuple[str, str, str, str]:
    partes = [p for p in (texto or "").strip().split() if p]
    if not partes:
        return "", "", "", ""
    if len(partes) == 1:
        return partes[0], "", "S/A", ""
    if len(partes) == 2:
        return partes[0], "", partes[1], ""
    if len(partes) == 3:
        return partes[0], "", partes[1], partes[2]
    return partes[0], " ".join(partes[1:-2]), partes[-2], partes[-1]


def parse_edad(raw: str) -> int | None:
    raw = (raw or "").strip().upper().replace("´", "").replace("'", "").replace(",", ".")
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
    if not numeros or len(numeros) < 5:
        return "", ""
    return "V", numeros


def norm_doc(doc: str) -> str | None:
    n = re.sub(r"[^A-Za-z0-9]", "", doc or "").upper()
    return n or None


def parse_sexo_col(m_raw: str, f_raw: str) -> str:
    m = (m_raw or "").strip().upper()
    f = (f_raw or "").strip().upper()
    if m in ("X", "M", "SI", "SÍ", "1"):
        return "M"
    if f in ("X", "F", "SI", "SÍ", "1"):
        return "F"
    return ""


def parse_telefono(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    upper = raw.upper()
    if upper in ("N/A", "N/P", "NA", "NP", "S/T", "S/N", "SIN TELEFONO", "SIN TELÉFONO", "OBSERVACION"):
        return ""
    digitos = re.sub(r"[^\d]", "", raw)
    if len(digitos) < 7:
        return ""
    if digitos.startswith("0") and len(digitos) >= 11:
        digitos = digitos[1:]
    return digitos[:15]


def es_jefe(parentesco: str) -> bool:
    p = (parentesco or "").upper()
    return "JEFE" in p or "JEFA" in p


def mapear_parentesco(parentesco: str) -> str:
    p = (parentesco or "").upper().strip()
    if not p:
        return "Otro familiar"
    if "ESPOS" in p or "PAREJA" in p or "CONYUGE" in p or "CÓNYUGE" in p:
        return "Cónyuge"
    if "HIJO" in p or "HIJA" in p or "HJJA" in p:
        return "Hijo/a"
    if "NIET" in p:
        return "Nieto/a"
    if "HERMAN" in p:
        return "Hermano/a"
    if "SOBRIN" in p:
        return "Sobrino/a"
    if "PADRE" in p or "MAMA" in p or "MADRE" in p or "PAPA" in p or "ABUEL" in p:
        return "Padre/Madre"
    if "YERN" in p:
        return "Otro familiar"
    return "Otro familiar"


def inferir_sexo(reg: dict) -> str:
    if reg.get("sexo"):
        return reg["sexo"]
    p = (reg.get("parentesco") or "").upper()
    if "JEFA" in p or "ESPOSA" in p or "MADRE" in p or "MAMA" in p or "NIETA" in p or "HIJA" in p:
        return "F"
    if "JEFE" in p or "ESPOSO" in p or "PAPA" in p or "PADRE" in p or "NIETO" in p or "HIJO" in p:
        return "M"
    return ""


def parse_lineas(texto: str) -> list[dict]:
    registros: list[dict] = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not linea.strip():
            continue
        cols = linea.split("\t")
        if not cols:
            continue
        if cols[0].strip().upper().startswith("NOMBRE"):
            continue
        while len(cols) < 8:
            cols.append("")

        nombre = cols[0].strip().strip('"')
        edad_raw = cols[1].strip()
        cedula_raw = cols[2].strip()
        m_raw = cols[3].strip()
        f_raw = cols[4].strip()
        parentesco = cols[5].strip()
        _fecha = cols[6].strip()
        telefono_raw = cols[7].strip()

        if not nombre:
            continue

        pn, sn, pa, sa = split_nombre_completo(nombre)
        if not pn or not pa:
            continue

        tipo_doc, documento = parse_cedula(cedula_raw)
        sexo = parse_sexo_col(m_raw, f_raw)
        edad = parse_edad(edad_raw)

        registro = {
                "fila": i,
                "nombre_completo": nombre,
                "primer_nombre": pn,
                "segundo_nombre": sn,
                "primer_apellido": pa,
                "segundo_apellido": sa,
                "edad": edad,
                "tipo_doc": tipo_doc,
                "documento": documento,
                "documento_norm": norm_doc(documento),
                "sexo": sexo,
                "parentesco": parentesco,
                "es_jefe": es_jefe(parentesco),
                "telefono": parse_telefono(telefono_raw),
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
                "parroquia": "La Pastora",
                "condicion_vivienda": "",
                "calle": "",
                "casa_edificio": "",
            }
        registro["sexo"] = inferir_sexo(registro)
        registros.append(registro)
    return registros


def asignar_familias(registros: list[dict]) -> None:
    """Agrupa por bloques delimitados por filas JEFE/JEFA de familia."""
    jefe_indices = [i for i, r in enumerate(registros) if r["es_jefe"]]
    if not jefe_indices:
        for i, reg in enumerate(registros):
            reg["cod_fam"] = "1"
        return

    fam_id = 0
    cursor = 0
    for jefe_idx in jefe_indices:
        fam_id += 1
        cod = str(fam_id)
        fam_start = jefe_idx
        if jefe_idx > cursor:
            # Esposo/a u otros adultos listados justo antes del jefe.
            for back in range(jefe_idx - 1, cursor - 1, -1):
                prev = registros[back]
                if prev.get("cod_fam"):
                    break
                p = (prev.get("parentesco") or "").upper()
                if "ESPOS" in p or prev["telefono"] == registros[jefe_idx]["telefono"]:
                    fam_start = back
                else:
                    break
        for i in range(cursor, jefe_idx):
            if not registros[i].get("cod_fam"):
                registros[i]["cod_fam"] = cod
        for i in range(fam_start, len(registros)):
            if i > jefe_idx and registros[i]["es_jefe"]:
                break
            registros[i]["cod_fam"] = cod
        cursor = max(cursor, jefe_idx + 1)

    for i, reg in enumerate(registros):
        if not reg.get("cod_fam"):
            reg["cod_fam"] = str(fam_id or 1)


def vincular_jefes_familia(registros: list[dict]) -> None:
    jefes_por_familia: dict[str, tuple[str, str]] = {}
    for reg in registros:
        if reg["es_jefe"] and reg["documento"]:
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
        keeper = jefes[0] if jefes else max(rows, key=lambda r: ((r.get("edad") or 0), -r["fila"]))
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
        return (int(reg.get("cod_fam") or 0), prio, -(edad if edad is not None else -1), reg["fila"])

    return sorted(registros, key=sort_key)


def registro_payload(reg: dict) -> dict:
    payload = {
        k: v
        for k, v in reg.items()
        if k
        not in (
            "fila",
            "documento_norm",
            "cod_fam",
            "parentesco",
            "es_jefe",
            "nombre_completo",
        )
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
            "SELECT * FROM _import_result WHERE status <> 'ok' ORDER BY fila LIMIT 80;",
        ]
    )
    return "\n".join(lines)


def excluir_cedulas_en_bd(registros: list[dict], docs_en_bd: set[str]) -> list[dict]:
    reasignados: list[dict] = []
    for reg in registros:
        if reg.get("documento_norm") and reg["documento_norm"] in docs_en_bd:
            reasignados.append(
                {
                    "fila": reg["fila"],
                    "nombre": f"{reg['primer_nombre']} {reg['primer_apellido']}",
                    "cedula_original": reg["documento"],
                    "motivo": "cédula ya registrada en otro refugio; importado sin documento",
                }
            )
            reg["tipo_doc"] = ""
            reg["documento"] = ""
            reg["documento_norm"] = None
    return reasignados


def preparar(path: Path | None = None, docs_en_bd: set[str] | None = None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    registros = parse_lineas(path.read_text(encoding="utf-8"))
    asignar_familias(registros)
    registros, reasignados = resolver_cedulas_duplicadas(registros)
    if docs_en_bd:
        reasignados.extend(excluir_cedulas_en_bd(registros, docs_en_bd))
    vincular_jefes_familia(registros)
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
                "stats": {
                    "jefes": sum(1 for r in ok if r["es_jefe"]),
                    "con_cedula": sum(1 for r in ok if r["documento"]),
                    "vinculados": sum(1 for r in ok if r["jefe_documento"]),
                    "sin_edad": sum(1 for r in ok if r["edad"] is None),
                    "sin_sexo": sum(1 for r in ok if not r["sexo"]),
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )

    modo = sys.argv[2] if len(sys.argv) > 2 else "preview"
    if modo == "sql":
        batch_size = 30
        for i in range(0, len(ok), batch_size):
            batch = ok[i : i + batch_size]
            print(f"-- BATCH {i // batch_size + 1}")
            print(generar_sql_import(batch))
            print()
    elif modo == "json":
        print(json.dumps([registro_payload(r) | {"fila": r["fila"]} for r in ok], ensure_ascii=False))


if __name__ == "__main__":
    main()
