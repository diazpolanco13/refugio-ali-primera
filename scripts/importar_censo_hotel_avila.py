#!/usr/bin/env python3
"""Importa planilla censo/hotel avila.txt al censo de centro-61 (Estacionamiento Hotel Ávila)."""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

CENTRO_ID = "centro-61"
ARCHIVO = Path("/opt/refugio-ali-primera/censo/hotel avila.txt")
FUNCIONARIO = {
    "jerarquia": "Sistema",
    "nombre": "Importación planilla",
    "institucion": "Refugios Transitorios",
    "telefono": "",
    "en_refugio": False,
}


def split_nombre_completo(texto: str) -> tuple[str, str, str, str]:
    partes = texto.strip().split()
    if not partes:
        return "", "", "", ""
    if len(partes) == 1:
        return partes[0], "", "S/A", ""
    if len(partes) == 2:
        return partes[0], "", partes[1], ""
    if len(partes) == 3:
        return partes[0], "", partes[1], partes[2]
    # >=4: últimos 2 = apellidos; primero = primer nombre; resto = segundo nombre
    return partes[0], " ".join(partes[1:-2]), partes[-2], partes[-1]


def parse_edad(raw: str) -> int | None:
    raw = (raw or "").strip().upper()
    if not raw:
        return None
    meses = re.match(r"^(\d+)\s*MESES?$", raw)
    if meses:
        return 0
    m = re.match(r"^(\d+)", raw)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def parse_cedula(raw: str) -> tuple[str, str]:
    raw = (raw or "").strip().upper().replace("\n", "").replace("\r", "")
    if raw in ("", "S/C", "SC", "SIN CEDULA", "SIN CÉDULA", "MENOR", "N/A", "N/P"):
        return "", ""
    numeros = re.sub(r"[^\d]", "", raw)
    if not numeros:
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
    # Si parece nota clínica/embarazo sin dígitos de teléfono útiles
    digitos = re.sub(r"[^\d]", "", raw.split("/")[0])
    if len(digitos) < 7:
        return ""
    if digitos.startswith("0") and len(digitos) >= 11:
        digitos = digitos[1:]
    return digitos[:15]


def es_jefe(vinculo: str) -> bool:
    return "JEFE" in (vinculo or "").upper() or "JEFA" in (vinculo or "").upper()


def mapear_parentesco(vinculo: str) -> str:
    p = (vinculo or "").upper().strip()
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


def detectar_embarazo(tipo: str, tlf: str) -> tuple[bool, str]:
    blob = f"{tipo} {tlf}".upper()
    if "EMBARAZ" not in blob and "GESTACI" not in blob:
        return False, ""
    # semanas explícitas
    sem = re.search(r"(\d+)\s*SEMANAS?", blob)
    if sem:
        return True, sem.group(1)
    meses = re.search(r"(\d+)\s*MESES?", blob)
    if meses:
        # ~4 semanas por mes
        return True, str(int(meses.group(1)) * 4)
    return True, ""


def detectar_discapacidad(tipo: str, tlf: str) -> tuple[bool, str]:
    blob = f"{tipo} {tlf}".strip()
    upper = blob.upper()
    keys = (
        "DISCAPAC",
        "AMPUTAC",
        "EQUINOVARO",
        "MOTORA",
        "VISUAL Y MOTORA",
        "FIESTULA",
        "FISTULA",
    )
    if any(k in upper for k in keys):
        # conservar detalle limpio
        detalle = re.sub(r"\s+", " ", blob).strip()
        # quitar teléfonos si vinieran mezclados
        detalle = re.sub(r"\b0?\d{10,}\b", "", detalle).strip(" /|-")
        return True, detalle[:300]
    return False, ""


def detectar_enfermedad(tipo: str, tlf: str) -> tuple[bool, str]:
    blob = f"{tipo} {tlf}".strip()
    upper = blob.upper()
    keys = (
        "DIABET",
        "HIPERTENS",
        "QUIMIO",
        "INMUNOTERAP",
        "ASMA",
        "EPILEPS",
        "CANCER",
        "CÁNCER",
    )
    if any(k in upper for k in keys):
        detalle = re.sub(r"\s+", " ", blob).strip()
        detalle = re.sub(r"\b0?\d{10,}\b", "", detalle).strip(" /|-")
        return True, detalle[:300]
    return False, ""


def notas_calle(tlf: str, telefono: str) -> str:
    """Guarda en calle observaciones que no son teléfono ni ya capturadas como salud."""
    raw = re.sub(r"\s+", " ", (tlf or "").strip())
    if not raw:
        return ""
    upper = raw.upper()
    if upper in ("N/A", "N/P", "NA", "NP"):
        return ""
    if telefono and re.sub(r"[^\d]", "", raw) == telefono:
        return ""
    # Si es solo teléfono(s)
    solo_tels = re.sub(r"[/\s()0-9]", "", raw)
    if not solo_tels:
        return ""
    # Notas útiles (referidos, no pernocta, etc.)
    if any(
        k in upper
        for k in (
            "REFERID",
            "PERNOTA",
            "FAMILIA",
            "ALTOS",
            "PASTORA",
            "CASA",
            "EMBARAZ",
            "DISCAPAC",
            "DIABET",
            "HIPERTENS",
            "QUIMIO",
            "FISTULA",
            "AMPUTAC",
        )
    ):
        return raw[:300]
    return ""


def parse_lineas(texto: str) -> list[dict]:
    """Parsea filas TSV; une continuaciones de celdas multilínea (cédula partida)."""
    lineas = texto.splitlines()
    registros: list[dict] = []
    i = 0
    while i < len(lineas):
        linea = lineas[i]
        if not linea.strip() or linea.strip().upper().startswith("#\t") or linea.strip().upper().startswith("TIPO\t"):
            i += 1
            continue
        # Unir líneas rotas dentro de celdas entre comillas o cédula partida
        while True:
            cols = linea.split("\t")
            # Header check
            if cols and cols[0].strip().upper() in ("#", "N", "N°", "NO"):
                if len(cols) > 1 and cols[1].strip().upper() == "TIPO":
                    i += 1
                    break
            # Fila válida inicia con número
            if not cols or not re.match(r"^\d+$", cols[0].strip()):
                i += 1
                break
            # Continuar si hay comilla abierta o pocas columnas
            abierta = linea.count('"') % 2 == 1
            if abierta or (len(cols) < 6 and i + 1 < len(lineas)):
                i += 1
                if i >= len(lineas):
                    break
                linea = linea + " " + lineas[i].lstrip()
                continue
            # Algunas cédulas vienen en 2 líneas: "31994898\n"
            if len(cols) >= 5 and cols[4].strip().startswith('"') and not cols[4].strip().endswith('"'):
                i += 1
                if i >= len(lineas):
                    break
                linea = linea + " " + lineas[i].lstrip()
                continue
            break
        else:
            continue

        cols = linea.split("\t")
        if len(cols) < 6:
            i += 1
            continue
        while len(cols) < 8:
            cols.append("")

        nro = int(cols[0].strip())
        tipo = cols[1].strip()
        nombre = cols[2].strip().strip('"')
        edad_raw = cols[3].strip()
        cedula = cols[4].strip().strip('"')
        genero = cols[5].strip().upper()
        vinculo = cols[6].strip()
        tlf = cols[7].strip().strip('"') if len(cols) > 7 else ""

        # Limpiar comillas residuales y saltos
        cedula = cedula.replace('"', "").replace("\n", "").strip()
        tlf = tlf.replace('"', "").replace("\n", " ").strip()

        pn, sn, pa, sa = split_nombre_completo(nombre)
        if not pn or not pa:
            i += 1
            continue

        tipo_doc, documento = parse_cedula(cedula)
        if genero not in ("M", "F"):
            genero = ""
        edad = parse_edad(edad_raw)
        telefono = parse_telefono(tlf)
        embarazada, semanas = detectar_embarazo(tipo, tlf)
        if genero != "F":
            embarazada, semanas = False, ""
        discapacidad, discap_det = detectar_discapacidad(tipo, tlf)
        enfermedad, enf_det = detectar_enfermedad(tipo, tlf)
        calle = notas_calle(tlf, telefono)

        registros.append(
            {
                "fila": nro,
                "tipo": tipo,
                "primer_nombre": pn,
                "segundo_nombre": sn,
                "primer_apellido": pa,
                "segundo_apellido": sa,
                "edad": edad,
                "tipo_doc": tipo_doc,
                "documento": documento,
                "documento_norm": norm_doc(documento),
                "sexo": genero,
                "parentesco": vinculo,
                "es_jefe": es_jefe(vinculo),
                "telefono": telefono,
                "embarazada": embarazada,
                "embarazo_semanas": semanas,
                "discapacidad": discapacidad,
                "discapacidad_detalle": discap_det if discapacidad else "",
                "enfermedad": enfermedad,
                "enfermedad_detalle": enf_det if enfermedad else "",
                "jefe_tipo_doc": "",
                "jefe_documento": "",
                "parentesco_jefe": "",
                "pais": "Venezuela",
                "estado_federativo": "Distrito Capital",
                "municipio": "Libertador",
                "parroquia": "San José",
                "condicion_vivienda": "",
                "calle": calle,
                "casa_edificio": "",
            }
        )
        i += 1
    return registros


def asignar_familias(registros: list[dict]) -> None:
    fam = 0
    for reg in registros:
        if reg["es_jefe"]:
            fam += 1
        reg["cod_fam"] = str(fam if fam > 0 else 0)


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
        if reg["cod_fam"] in ("0", ""):
            continue
        jefe = jefes_por_familia.get(reg["cod_fam"])
        if not jefe:
            continue
        # Vincular a todos los no-jefe del grupo familiar
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
        if k not in ("fila", "documento_norm", "cod_fam", "parentesco", "es_jefe", "tipo")
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
                        "embarazada": r["embarazada"],
                        "semanas": r["embarazo_semanas"],
                        "discapacidad": r["discapacidad"],
                        "enfermedad": r["enfermedad"],
                        "tel": r["telefono"],
                    }
                    for r in ok[:15]
                ],
                "stats": {
                    "jefes": sum(1 for r in ok if r["es_jefe"]),
                    "con_cedula": sum(1 for r in ok if r["documento"]),
                    "embarazadas": sum(1 for r in ok if r["embarazada"]),
                    "discapacidad": sum(1 for r in ok if r["discapacidad"]),
                    "enfermedad": sum(1 for r in ok if r["enfermedad"]),
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
        batch_size = 40
        for i in range(0, len(ok), batch_size):
            batch = ok[i : i + batch_size]
            print(f"-- BATCH {i // batch_size + 1}")
            print(generar_sql_import(batch))
            print()
    elif modo == "json":
        print(json.dumps([registro_payload(r) | {"fila": r["fila"]} for r in ok], ensure_ascii=False))


if __name__ == "__main__":
    main()
