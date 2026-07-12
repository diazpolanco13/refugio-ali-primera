#!/usr/bin/env python3
"""Importa planilla censo/cesar rengifo.txt al censo de centro-12 (UE Cesar Rengifo)."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-12"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/cesar rengifo.txt")
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
    "NO POSEE",
    "NO POSEE.",
    "NO POSE",
    "MENOR",
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


def parse_sexo(raw: str) -> str:
    p = (raw or "").strip().upper()
    if p in ("M", "MASCULINO", "HOMBRE", "H"):
        return "M"
    if p in ("F", "FEMENINO", "MUJER", "FEMENINA"):
        return "F"
    return ""


def parse_lineas(texto: str) -> list[dict]:
    registros: list[dict] = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not linea.strip():
            continue
        cols = linea.split("\t")
        if not cols:
            continue
        header = cols[0].strip().upper()
        if header in ("Nº", "N°", "NO", "N") and len(cols) > 1:
            h1 = cols[1].strip().upper()
            if "NOMBRE" in h1 or "APELLIDO" in h1:
                continue
        if not re.match(r"^\d+$", cols[0].strip()):
            continue
        while len(cols) < 9:
            cols.append("")

        fila = int(cols[0].strip())
        nombre = cols[1].strip().strip('"')
        cedula_raw = cols[2].strip()
        sexo_raw = cols[3].strip()
        edad_raw = cols[4].strip()

        pn, sn, pa, sa = split_nombre_completo(nombre)
        if not pn or not pa:
            continue

        tipo_doc, documento = parse_cedula(cedula_raw)
        sexo = parse_sexo(sexo_raw)
        edad = parse_edad(edad_raw)

        registros.append(
            {
                "fila": fila,
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
                "parroquia": "La Pastora",
                "condicion_vivienda": "",
                "calle": "",
                "casa_edificio": "",
            }
        )
    return registros


def resolver_cedulas_duplicadas(registros: list[dict]) -> tuple[list[dict], list[dict]]:
    by_doc: dict[str, list[dict]] = defaultdict(list)
    reasignados: list[dict] = []
    for reg in registros:
        if reg["documento_norm"]:
            by_doc[reg["documento_norm"]].append(reg)

    for _nd, rows in by_doc.items():
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
        edad = reg.get("edad")
        if edad is not None and edad >= 18:
            prio = 0
        else:
            prio = 1
        return (prio, -(edad if edad is not None else -1), reg["fila"])

    return sorted(registros, key=sort_key)


def registro_payload(reg: dict) -> dict:
    payload = {
        k: v
        for k, v in reg.items()
        if k not in ("fila", "documento_norm", "nombre_completo")
    }
    payload["edad"] = "" if payload["edad"] is None else str(payload["edad"])
    return payload


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def generar_sql_import(registros: list[dict], docs_existentes: set[str] | None = None) -> str:
    docs_existentes = docs_existentes or set()
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
        doc_norm = reg.get("documento_norm")
        if doc_norm and doc_norm in docs_existentes:
            lines.append(
                f"  INSERT INTO _import_result VALUES ({reg['fila']}, '{sql_escape(nombre)}', 'skip', 'cédula ya en BD');"
            )
            continue
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


def preparar(path: Path | None = None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    registros = parse_lineas(path.read_text(encoding="utf-8"))
    registros, reasignados = resolver_cedulas_duplicadas(registros)
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
                "preview": [
                    {
                        "fila": r["fila"],
                        "nombre": f"{r['primer_nombre']} {r['segundo_nombre']} {r['primer_apellido']} {r['segundo_apellido']}".strip(),
                        "cedula": r["documento"] or "S/C",
                        "edad": r["edad"],
                        "sexo": r["sexo"],
                    }
                    for r in ok
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )

    modo = sys.argv[2] if len(sys.argv) > 2 else "preview"
    if modo == "sql":
        batch_size = 38
        for i in range(0, len(ok), batch_size):
            batch = ok[i : i + batch_size]
            print(f"-- BATCH {i // batch_size + 1}")
            print(generar_sql_import(batch))
            print()
    elif modo == "json":
        print(json.dumps([registro_payload(r) | {"fila": r["fila"]} for r in ok], ensure_ascii=False))
    elif modo == "docs":
        docs = sorted({r["documento_norm"] for r in ok if r["documento_norm"]})
        print(json.dumps(docs, ensure_ascii=False))


if __name__ == "__main__":
    main()
