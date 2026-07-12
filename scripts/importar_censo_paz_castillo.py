#!/usr/bin/env python3
"""Importa planilla censo/paz castillo.txt al censo de centro-24 (UE Jose Ignacio Paz Castillo)."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-24"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/paz castillo.txt")
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


def split_nombre_completo(texto: str) -> tuple[str, str, str, str]:
    partes = [p for p in texto.strip().split() if p]
    if not partes:
        return "", "", "", ""
    if len(partes) == 1:
        return partes[0], "", "S/A", ""
    if len(partes) == 2:
        return partes[0], "", partes[1], ""
    if len(partes) == 3:
        return partes[0], "", partes[1], partes[2]
    return partes[0], " ".join(partes[1:-2]), partes[-2], partes[-1]


def tokens_apellido(pn: str, sn: str, pa: str, sa: str, nombre_completo: str = "") -> set[str]:
    blob = f"{pa} {sa}".strip() or " ".join(nombre_completo.split()[-2:])
    toks = {t.upper() for t in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", blob)}
    return {t for t in toks if t not in STOP_TOKENS and len(t) >= 3}


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


def parse_cedula(raw: str, nacionalidad: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper().replace("\n", "").replace("\r", "")
    if raw in ("", "S/C", "SC", "SIN CEDULA", "SIN CÉDULA", "MENOR", "N/A", "N/P"):
        return "", ""
    numeros = re.sub(r"[^\d]", "", raw)
    if not numeros:
        return "", ""
    tipo = (nacionalidad or "V").strip().upper()[:1]
    if tipo not in ("V", "E", "P"):
        tipo = "V"
    return tipo, numeros


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


def parse_sexo(raw: str) -> str:
    p = (raw or "").strip().upper()
    if p in ("M", "MASCULINO", "HOMBRE", "H"):
        return "M"
    if p in ("F", "FEMENINO", "MUJER", "FEMENINA"):
        return "F"
    return ""


def es_jefe(parentesco: str) -> bool:
    p = (parentesco or "").upper()
    return "JEFE" in p or "JEFA" in p


def mapear_parentesco(parentesco: str) -> str:
    p = (parentesco or "").upper().strip()
    if not p:
        return "Otro familiar"
    if "ESPOS" in p or "PAREJA" in p or "CONYUGE" in p or "CÓNYUGE" in p:
        return "Cónyuge"
    if "HIJO" in p or "HIJA" in p:
        return "Hijo/a"
    if "NIET" in p:
        return "Nieto/a"
    if "HERMAN" in p:
        return "Hermano/a"
    if "SOBRIN" in p:
        return "Sobrino/a"
    if "PADRE" in p or "MADRE" in p or "ABUEL" in p:
        return "Padre/Madre"
    return "Otro familiar"


def parse_lineas(texto: str) -> list[dict]:
    registros: list[dict] = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not linea.strip():
            continue
        cols = linea.split("\t")
        if not cols:
            continue
        # Encabezado
        if cols[0].strip().upper().startswith("NOMBRE"):
            continue
        while len(cols) < 8:
            cols.append("")

        nombre = cols[0].strip().strip('"')
        nacionalidad = cols[1].strip()
        cedula = cols[2].strip().strip('"')
        parentesco = cols[3].strip()
        _fecha = cols[4].strip()
        edad_raw = cols[5].strip()
        sexo_raw = cols[6].strip()
        telefono_raw = cols[7].strip().strip('"') if len(cols) > 7 else ""

        pn, sn, pa, sa = split_nombre_completo(nombre)
        if not pn or not pa:
            continue

        tipo_doc, documento = parse_cedula(cedula, nacionalidad)
        sexo = parse_sexo(sexo_raw)
        edad = parse_edad(edad_raw)

        registros.append(
            {
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
                "tokens": tokens_apellido(pn, sn, pa, sa, nombre),
            }
        )
    return registros


def asignar_familias(registros: list[dict]) -> None:
    """Asigna no-jefes al jefe más cercano con apellidos compartidos (hacia adelante, luego atrás)."""
    jefes = [r for r in registros if r["es_jefe"]]
    fam_map: dict[int, str] = {}
    for idx, jefe in enumerate(jefes, start=1):
        fam_map[id(jefe)] = str(idx)
        jefe["cod_fam"] = str(idx)

    for reg in registros:
        if reg["es_jefe"]:
            continue
        tokens = reg["tokens"]
        candidatos: list[tuple[int, dict]] = []
        for jefe in jefes:
            dist = abs(reg["fila"] - jefe["fila"])
            score = len(tokens & jefe["tokens"])
            # Preferir coincidencia de apellido; telefono compartido suma
            if reg["telefono"] and reg["telefono"] == jefe["telefono"]:
                score += 2
            if score <= 0:
                continue
            # Priorizar jefes posteriores (miembros suelen aparecer antes del jefe)
            posterior = 0 if jefe["fila"] > reg["fila"] else 1
            candidatos.append(((-score, posterior, dist), jefe))
        if candidatos:
            candidatos.sort(key=lambda x: x[0])
            jefe = candidatos[0][1]
            reg["cod_fam"] = fam_map[id(jefe)]
        else:
            # Sin match: vincular al jefe posterior más cercano, o anterior
            posteriores = [j for j in jefes if j["fila"] > reg["fila"]]
            anteriores = [j for j in jefes if j["fila"] < reg["fila"]]
            if posteriores:
                reg["cod_fam"] = fam_map[id(posteriores[0])]
            elif anteriores:
                reg["cod_fam"] = fam_map[id(anteriores[-1])]
            else:
                reg["cod_fam"] = "0"


def vincular_jefes_familia(registros: list[dict]) -> None:
    jefes_por_familia: dict[str, tuple[str, str]] = {}
    for reg in registros:
        if reg["es_jefe"] and reg["documento"]:
            jefes_por_familia[reg["cod_fam"]] = (reg["tipo_doc"] or "V", reg["documento"])

    for reg in registros:
        if reg["es_jefe"]:
            continue
        if reg["cod_fam"] in ("0", ""):
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
            "tokens",
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


def preparar(path: Path | None = None) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    texto = path.read_text(encoding="utf-8")
    registros = parse_lineas(texto)
    asignar_familias(registros)
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
                        "tel": r["telefono"],
                    }
                    for r in ok[:20]
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
        batch_size = 35
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
