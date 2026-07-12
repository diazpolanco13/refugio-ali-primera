#!/usr/bin/env python3
"""Importa planilla censo/GUAYANA ESEQUIBA.TXT al censo de centro-65."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-65"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/GUAYANA ESEQUIBA.TXT")
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
    texto = re.sub(r"\([^)]*\)", " ", texto or "")
    texto = re.sub(r"[,\s]+$", "", texto.strip())
    texto = re.sub(r"\s+", " ", texto)
    partes = texto.split()
    if not partes:
        return "", "", "", ""
    if len(partes) == 1:
        return partes[0], "", "S/A", ""
    if len(partes) == 2:
        return partes[0], "", partes[1], ""
    if len(partes) == 3:
        return partes[0], "", partes[1], partes[2]
    if "DE" in {p.upper() for p in partes[:-1]} or "DEL" in {p.upper() for p in partes[:-1]}:
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


def parse_edad(raw: str) -> int | None:
    raw = (raw or "").strip().upper().replace(",", "")
    if not raw:
        return None
    # Bebés en meses/días → 0 años
    if re.search(r"\d+\s*[-]?\s*[MD]\b", raw) or re.search(r"\d+\s*(MES|MESES|DIA|DÍAS|DIA)\b", raw):
        return 0
    m = re.match(r"^(\d+)", raw)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper()
    if raw in SIN_DOC:
        return "", ""
    numeros = re.sub(r"[^\d]", "", raw)
    if not numeros:
        return "", ""
    # Evitar cédulas claramente corruptas (muy cortas tras limpieza)
    if len(numeros) < 5:
        return "", ""
    return "V", numeros


def norm_doc(doc: str) -> str | None:
    n = re.sub(r"[^A-Za-z0-9]", "", doc or "").upper()
    return n or None


def es_jefe(parentesco: str) -> bool:
    p = (parentesco or "").upper()
    return "JEFE" in p or "JEFA" in p


def detectar_embarazo(nombre: str, parentesco: str) -> bool:
    blob = f"{nombre} {parentesco}".upper()
    return "EMBARAZ" in blob


def inferir_sexo(nombre: str, parentesco: str, es_jefe_familia: bool = False, jefe_sexo: str = "") -> str:
    p = (parentesco or "").upper().strip()
    # Tipografías frecuentes en la planilla
    p = (
        p.replace("CONYUGUE", "CONYUGE")
        .replace("COYUGUE", "CONYUGE")
        .replace("CÓNYUGE", "CONYUGE")
        .replace("CONOCIDA", "CONOCIDA")
    )
    if "JEFA" in p:
        return "F"
    if "JEFE" in p:
        return "M"
    if any(x in p for x in ("HIJA", "NIETA", "SOBRINA", "HERMANA", "PRIMA", "TIA", "TÍA", "SUEGRA", "CUÑADA", "NUERA", "ESPOSA", "MAMA", "MAMÁ", "CONOCIDA")):
        return "F"
    if any(x in p for x in ("HIJO", "NIETO", "SOBRINO", "HERMANO", "PRIMO", "TIO", "TÍO", "YERNO", "CUÑADO", "PAPA", "PAPÁ", "PAPÀ", "CONOCIDO", "NUERO")):
        return "M"
    if "CONYUGE" in p or "ESPOS" in p or "PAREJA" in p:
        # Pareja del jefe: sexo opuesto si se conoce
        if jefe_sexo == "F":
            return "M"
        if jefe_sexo == "M":
            return "F"
        return "F"
    # Heurística por primer nombre
    n = (nombre or "").strip().split()
    if not n:
        return ""
    first = n[0].upper()
    FEM_END = ("A", "IS", "YS", "LY", "EYS", "AIS")
    MASC_EXCEPT = {
        "ISAAC",
        "JONAS",
        "NICOLAS",
        "MATIAS",
        "ELIAS",
        "TOMAS",
        "JESUS",
        "JOSUE",
        "ANDRIANGEL",
        "GAEL",
        "JOSE",
        "JUAN",
        "LUIS",
        "WILLIAM",
        "MIRIAM",  # explícito femenino abajo
    }
    if first in {"MIRIAM", "LIAM", "ANDREIVER", "ANDERLI"}:
        return "F" if first in {"MIRIAM", "ANDERLI"} else "M"
    if first.endswith(FEM_END) and first not in MASC_EXCEPT:
        return "F"
    return "M"


def mapear_parentesco(parentesco: str) -> str:
    p = (parentesco or "").upper().strip()
    if not p:
        return "Otro familiar"
    p = (
        p.replace("CONYUGUE", "CONYUGE")
        .replace("COYUGUE", "CONYUGE")
        .replace("CÓNYUGE", "CONYUGE")
        .replace("NUERO", "NUERA")
        .replace("MAMA", "MADRE")
        .replace("MAMÁ", "MADRE")
        .replace("PAPA", "PADRE")
        .replace("PAPÁ", "PADRE")
        .replace("PAPÀ", "PADRE")
    )
    if "CONYUGE" in p or "ESPOS" in p or "PAREJA" in p:
        return "Cónyuge"
    if "HIJO" in p or "HIJA" in p:
        return "Hijo/a"
    if "NIET" in p or "BISNIET" in p:
        return "Nieto/a"
    if "HERMAN" in p:
        return "Hermano/a"
    if "SOBRIN" in p:
        return "Sobrino/a"
    if "PADRE" in p or "MADRE" in p or "ABUEL" in p or "TIA" in p or "TÍO" in p or "TIO" in p or "TÍA" in p:
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
        head = cols[0].strip().upper()
        if head.startswith("NOMBRE"):
            continue
        while len(cols) < 4:
            cols.append("")

        nombre = cols[0].strip()
        cedula = cols[1].strip()
        edad_raw = cols[2].strip()
        parentesco = cols[3].strip() if len(cols) > 3 else ""

        pn, sn, pa, sa = split_nombre_completo(nombre)
        if not pn or not pa:
            continue

        tipo_doc, documento = parse_cedula(cedula)
        edad = parse_edad(edad_raw)
        embarazada = detectar_embarazo(nombre, parentesco)
        es_j = es_jefe(parentesco)

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
                "sexo": "",  # se completa tras asignar familias
                "parentesco": parentesco,
                "es_jefe": es_j,
                "telefono": "",
                "embarazada": embarazada,
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
                "parroquia": "San Bernardino",
                "condicion_vivienda": "",
                "calle": "",
                "casa_edificio": "",
                "tokens": tokens_apellido(pa, sa, nombre),
            }
        )
    return registros


def asignar_familias(registros: list[dict]) -> None:
    """Agrupa por bloques consecutivos: cada JEFE/JEFA abre una familia hasta el siguiente."""
    fam = 0
    for reg in registros:
        if reg["es_jefe"]:
            fam += 1
            reg["cod_fam"] = str(fam)
        else:
            # Miembro sin jefe previo: crear familia propia
            if fam == 0:
                fam = 1
            reg["cod_fam"] = str(fam)

    # Si un bloque no tiene jefe explícito, el primer adulto con cédula (o el primero) es jefe
    by_fam: dict[str, list[dict]] = defaultdict(list)
    for reg in registros:
        by_fam[reg["cod_fam"]].append(reg)

    for _fam, rows in by_fam.items():
        if any(r["es_jefe"] for r in rows):
            continue
        adultos = [r for r in rows if r.get("edad") is not None and r["edad"] >= 18]
        candidatos = adultos or rows
        con_doc = [r for r in candidatos if r["documento"]]
        jefe = con_doc[0] if con_doc else candidatos[0]
        jefe["es_jefe"] = True
        jefe["parentesco"] = jefe["parentesco"] or "JEFE DE FAMILIA"

    # Inferir sexo con contexto del jefe de familia
    jefes_sexo: dict[str, str] = {}
    for reg in registros:
        if reg["es_jefe"]:
            reg["sexo"] = inferir_sexo(reg["nombre_completo"], reg["parentesco"], True, "")
            jefes_sexo[reg["cod_fam"]] = reg["sexo"]
    for reg in registros:
        if reg["es_jefe"]:
            continue
        reg["sexo"] = inferir_sexo(
            reg["nombre_completo"],
            reg["parentesco"],
            False,
            jefes_sexo.get(reg["cod_fam"], ""),
        )


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


def aplicar_conflictos_red(
    registros: list[dict], docs_en_red: set[str]
) -> list[dict]:
    """Si la cédula ya existe en la red, registra sin documento para no duplicar."""
    conflictos: list[dict] = []
    for reg in registros:
        nd = reg.get("documento_norm")
        if not nd or nd not in docs_en_red:
            continue
        conflictos.append(
            {
                "fila": reg["fila"],
                "nombre": f"{reg['primer_nombre']} {reg['primer_apellido']}",
                "cedula_original": reg["documento"],
                "motivo": "cédula ya registrada en la red; importado sin documento",
            }
        )
        # Si era jefe con doc, los miembros quedan sin vínculo por documento;
        # se re-vincula después si otro jefe de la familia conserva doc.
        era_jefe = reg["es_jefe"]
        doc_prev = reg["documento"]
        tipo_prev = reg["tipo_doc"]
        reg["tipo_doc"] = ""
        reg["documento"] = ""
        reg["documento_norm"] = None
        if era_jefe:
            # Conservar referencia textual en notas locales no; los miembros
            # que apuntaban a este doc dejarán de vincularse hasta re-vincular.
            _ = (doc_prev, tipo_prev)
    return conflictos


def preparar(
    path: Path | None = None, docs_en_red: set[str] | None = None
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    path = path or ARCHIVO
    texto = path.read_text(encoding="utf-8")
    registros = parse_lineas(texto)
    asignar_familias(registros)
    registros, reasignados = resolver_cedulas_duplicadas(registros)
    if docs_en_red:
        conflictos = aplicar_conflictos_red(registros, docs_en_red)
        reasignados = reasignados + conflictos
        # Re-vincular tras quitar docs conflictivos de posibles jefes
        for reg in registros:
            reg["jefe_tipo_doc"] = ""
            reg["jefe_documento"] = ""
            reg["parentesco_jefe"] = ""
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
                        "embarazada": r["embarazada"],
                    }
                    for r in ok[:25]
                ],
                "stats": {
                    "jefes": sum(1 for r in ok if r["es_jefe"]),
                    "con_cedula": sum(1 for r in ok if r["documento"]),
                    "sin_cedula": sum(1 for r in ok if not r["documento"]),
                    "vinculados": sum(1 for r in ok if r["jefe_documento"]),
                    "embarazadas": sum(1 for r in ok if r["embarazada"]),
                    "familias": len({r["cod_fam"] for r in ok}),
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
