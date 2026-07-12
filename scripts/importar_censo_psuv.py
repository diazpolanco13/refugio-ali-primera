#!/usr/bin/env python3
"""Importa planilla censo/PSUV.txt al censo de centro-62 (PSUV Caracas)."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-62"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/PSUV.txt")
FUNCIONARIO = {
    "jerarquia": "Sistema",
    "nombre": "Importación planilla",
    "institucion": "Refugios Transitorios",
    "telefono": "",
    "en_refugio": False,
}

STOP_TOKENS = {
    "DE",
    "DEL",
    "LA",
    "LAS",
    "LOS",
    "Y",
    "DA",
    "DO",
    "SAN",
    "SANTA",
}


def limpiar_nombre_y_edad(nombre_raw: str) -> tuple[str, int | None]:
    nombre = re.sub(r"\s+", " ", (nombre_raw or "").strip())
    edad: int | None = None

    m = re.search(r"\b(\d+)\s*mes(es)?\b", nombre, re.I)
    if m:
        edad = 0
        nombre = re.sub(r"\s*\d+\s*mes(es)?\b", "", nombre, flags=re.I).strip()

    m = re.search(r"\b(\d+)\s*a[ñn]os?\b", nombre, re.I)
    if m:
        edad = int(m.group(1))
        nombre = re.sub(r"\s*\d+\s*a[ñn]os?\b", "", nombre, flags=re.I).strip()

    m = re.search(r"\b(\d+)\s*a[ñn]o\b", nombre, re.I)
    if m and edad is None:
        edad = int(m.group(1))
        nombre = re.sub(r"\s*\d+\s*a[ñn]o\b", "", nombre, flags=re.I).strip()

    return nombre.strip(), edad


def split_nombre_completo(texto: str) -> tuple[str, str, str, str]:
    texto = re.sub(r"[,\s]+$", "", (texto or "").strip())
    texto = re.sub(r"\s+", " ", texto)
    partes = texto.split()
    if not partes:
        return "", "", "", ""
    if len(partes) == 1:
        return partes[0], "", "S/A", ""
    if len(partes) == 2:
        return partes[0], "", partes[1], ""
    if len(partes) == 3:
        if partes[1].upper() in ("DE", "DEL"):
            return partes[0], "", f"{partes[1]} {partes[2]}", ""
        return partes[0], partes[1], partes[2], ""
    if any(p.upper() in ("DE", "DEL") for p in partes[:-1]):
        idx = next(i for i, p in enumerate(partes) if p.upper() in ("DE", "DEL"))
        if idx >= 1:
            nombres = partes[:idx]
            apellidos = partes[idx:]
            if len(nombres) == 1:
                return nombres[0], "", " ".join(apellidos), ""
            return nombres[0], " ".join(nombres[1:]), " ".join(apellidos), ""
    return partes[0], " ".join(partes[1:-2]), partes[-2], partes[-1]


def tokens_apellido(pa: str, sa: str, nombre_completo: str = "") -> set[str]:
    blob = f"{pa} {sa}".strip() or " ".join(nombre_completo.split()[-2:])
    toks = {t.upper() for t in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", blob)}
    return {t for t in toks if t not in STOP_TOKENS and len(t) >= 3}


def inferir_edad(tipo: str, edad_nombre: int | None) -> int | None:
    if edad_nombre is not None:
        return edad_nombre
    t = (tipo or "").upper().strip()
    if "NIÑ" in t or "NINO" in t or "NIÑA" in t:
        return None
    if "ADULTO MAYOR" in t:
        return 65
    if "ADULTO" in t:
        return 30
    return None


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper().replace("\n", "").replace("\r", "")
    if raw in ("", "S/C", "SC", "SIN CEDULA", "SIN CÉDULA", "MENOR", "N/A", "N/P"):
        return "", ""
    numeros = re.sub(r"[^\d]", "", raw)
    if not numeros or len(numeros) < 5:
        return "", ""
    return "V", numeros


def norm_doc(doc: str) -> str | None:
    n = re.sub(r"[^A-Za-z0-9]", "", doc or "").upper()
    return n or None


def parse_telefono(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    upper = raw.upper()
    if upper in ("N/A", "N/P", "NA", "NP", "S/T", "SIN TELEFONO", "SIN TELÉFONO"):
        return ""
    digitos = re.sub(r"[^\d]", "", raw)
    if len(digitos) < 7:
        return ""
    if digitos.startswith("0") and len(digitos) >= 11:
        digitos = digitos[1:]
    return digitos[:15]


def mapear_parentesco(tipo: str) -> str:
    t = (tipo or "").upper()
    if "NIÑ" in t or "NINO" in t or "NIÑA" in t:
        return "Hijo/a"
    if "ADULTO MAYOR" in t:
        return "Padre/Madre"
    return "Otro familiar"


def parse_lineas(texto: str) -> list[dict]:
    registros: list[dict] = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not linea.strip():
            continue
        cols = linea.split("\t")
        while len(cols) < 4:
            cols.append("")
        if cols[0].strip().upper().startswith("TIPO"):
            continue

        tipo = cols[0].strip()
        nombre_raw = cols[1].strip()
        cedula_raw = cols[2].strip()
        telefono_raw = cols[3].strip()

        nombre_limpio, edad_nombre = limpiar_nombre_y_edad(nombre_raw)
        pn, sn, pa, sa = split_nombre_completo(nombre_limpio)
        if not pn or not pa:
            continue

        tipo_doc, documento = parse_cedula(cedula_raw)
        telefono = parse_telefono(telefono_raw)
        edad = inferir_edad(tipo, edad_nombre)
        es_mayor = "ADULTO MAYOR" in (tipo or "").upper()
        es_nino = "NIÑ" in (tipo or "").upper() or "NINO" in (tipo or "").upper()

        registros.append(
            {
                "fila": i,
                "tipo_afectado": tipo,
                "nombre_completo": nombre_raw,
                "primer_nombre": pn,
                "segundo_nombre": sn,
                "primer_apellido": pa,
                "segundo_apellido": sa,
                "edad": edad,
                "tipo_doc": tipo_doc,
                "documento": documento,
                "documento_norm": norm_doc(documento),
                "sexo": "",
                "telefono": telefono,
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
                "es_nino": es_nino,
                "es_mayor": es_mayor,
                "pais": "Venezuela",
                "estado_federativo": "Distrito Capital",
                "municipio": "Libertador",
                "parroquia": "El Silencio",
                "condicion_vivienda": "",
                "calle": "",
                "casa_edificio": "",
                "tokens": tokens_apellido(pa, sa, nombre_limpio),
            }
        )
    return registros


def asignar_familias(registros: list[dict]) -> None:
    """Agrupa por teléfono compartido; sin teléfono, por apellido cercano."""
    fam_counter = 0
    tel_a_fam: dict[str, str] = {}
    fam_jefe: dict[str, dict | None] = {}

    for reg in registros:
        tel = reg["telefono"]
        if tel and tel in tel_a_fam:
            reg["cod_fam"] = tel_a_fam[tel]
            continue

        # Buscar familia por apellido + proximidad con grupo teléfono cercano
        assigned = False
        if tel:
            for otro in registros:
                if otro is reg:
                    continue
                if otro.get("cod_fam") and otro["telefono"] == tel:
                    reg["cod_fam"] = otro["cod_fam"]
                    tel_a_fam[tel] = otro["cod_fam"]
                    assigned = True
                    break

        if not assigned:
            # Vincular por apellido a registro anterior cercano con misma familia implícita
            candidatos = []
            for otro in registros:
                if otro is reg or not otro.get("cod_fam"):
                    continue
                score = len(reg["tokens"] & otro["tokens"])
                if score > 0:
                    candidatos.append((abs(reg["fila"] - otro["fila"]), -score, otro["cod_fam"]))
            if candidatos:
                candidatos.sort()
                reg["cod_fam"] = candidatos[0][2]
                if tel:
                    tel_a_fam[tel] = reg["cod_fam"]
                assigned = True

        if not assigned:
            fam_counter += 1
            cod = str(fam_counter)
            reg["cod_fam"] = cod
            if tel:
                tel_a_fam[tel] = cod
            fam_jefe[cod] = None

    # Segunda pasada: unir familias con mismo apellido principal y filas contiguas sin teléfono
    for reg in registros:
        if reg.get("cod_fam"):
            continue
        for otro in registros:
            if otro is reg or not otro.get("cod_fam"):
                continue
            if reg["tokens"] & otro["tokens"] and abs(reg["fila"] - otro["fila"]) <= 6:
                reg["cod_fam"] = otro["cod_fam"]
                break
        if not reg.get("cod_fam"):
            fam_counter += 1
            reg["cod_fam"] = str(fam_counter)


def inferir_jefes(registros: list[dict]) -> None:
    grupos: dict[str, list[dict]] = defaultdict(list)
    for reg in registros:
        grupos[reg["cod_fam"]].append(reg)

    for _fam, miembros in grupos.items():
        candidatos = [m for m in miembros if m["documento"] and not m["es_nino"]]
        if not candidatos:
            candidatos = [m for m in miembros if m["documento"]]
        if not candidatos:
            continue
        mayores = [m for m in candidatos if m["es_mayor"]]
        jefe = mayores[0] if mayores else max(candidatos, key=lambda m: (m.get("edad") or 0, -m["fila"]))
        jefe["es_jefe"] = True
        jefe_doc = (jefe["tipo_doc"] or "V", jefe["documento"])
        for m in miembros:
            if m is jefe:
                continue
            if jefe_doc[1]:
                m["jefe_tipo_doc"] = jefe_doc[0]
                m["jefe_documento"] = jefe_doc[1]
                m["parentesco_jefe"] = mapear_parentesco(m["tipo_afectado"])


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
        keeper = jefes[0] if jefes else max(rows, key=lambda r: (r.get("edad") or 0, -r["fila"]))
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


def quitar_docs_en_red(registros: list[dict], docs_en_red: set[str]) -> list[dict]:
    reasignados: list[dict] = []
    for reg in registros:
        nd = reg.get("documento_norm")
        if nd and nd in docs_en_red:
            reasignados.append(
                {
                    "fila": reg["fila"],
                    "nombre": f"{reg['primer_nombre']} {reg['primer_apellido']}",
                    "cedula_original": reg["documento"],
                    "motivo": "cédula ya registrada en la red",
                }
            )
            reg["tipo_doc"] = ""
            reg["documento"] = ""
            reg["documento_norm"] = None
    return reasignados


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
            "es_jefe",
            "es_nino",
            "es_mayor",
            "tokens",
            "nombre_completo",
            "tipo_afectado",
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


def preparar(path: Path | None = None, docs_en_red: set[str] | None = None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    texto = path.read_text(encoding="utf-8")
    registros = parse_lineas(texto)
    asignar_familias(registros)
    inferir_jefes(registros)
    registros, reasignados = resolver_cedulas_duplicadas(registros)
    if docs_en_red:
        reasignados.extend(quitar_docs_en_red(registros, docs_en_red))
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
                "centro_nombre": "N.° 62 · PSUV Caracas",
                "archivo": str(path),
                "a_importar": len(ok),
                "omitidos_archivo": len(omitidos),
                "cedulas_reasignadas": len(reasignados),
                "omitidos": [
                    {
                        "fila": o["fila"],
                        "nombre": f"{o['primer_nombre']} {o['primer_apellido']}",
                        "cedula": o.get("documento") or "S/C",
                        "motivo": o.get("motivo", ""),
                    }
                    for o in omitidos
                ],
                "cedulas_reasignadas_detalle": reasignados,
                "preview": [
                    {
                        "fila": r["fila"],
                        "fam": r.get("cod_fam"),
                        "nombre": f"{r['primer_nombre']} {r['segundo_nombre']} {r['primer_apellido']} {r['segundo_apellido']}".strip(),
                        "cedula": r["documento"] or "S/C",
                        "edad": r["edad"],
                        "jefe": r["es_jefe"],
                        "jefe_doc": r["jefe_documento"],
                        "tel": r["telefono"],
                    }
                    for r in ok
                ],
                "stats": {
                    "jefes": sum(1 for r in ok if r["es_jefe"]),
                    "con_cedula": sum(1 for r in ok if r["documento"]),
                    "vinculados": sum(1 for r in ok if r["jefe_documento"]),
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )

    modo = sys.argv[2] if len(sys.argv) > 2 else "preview"
    if modo == "sql":
        batch_size = 20
        for i in range(0, len(ok), batch_size):
            batch = ok[i : i + batch_size]
            print(f"-- BATCH {i // batch_size + 1}")
            print(generar_sql_import(batch))
            print()
    elif modo == "json":
        print(json.dumps([registro_payload(r) | {"fila": r["fila"]} for r in ok], ensure_ascii=False))


if __name__ == "__main__":
    main()
