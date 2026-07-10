#!/usr/bin/env python3
"""
Importa el censo oficial (campamentos_transitorios.json) hacia centros.data.censo_oficial.

Uso:
  # Solo reporte de matching (lee centros vía stdin JSON o archivo):
  python3 scripts/importar_censo_oficial.py --centros-json /tmp/centros.json

  # Genera SQL de actualización (no ejecuta):
  python3 scripts/importar_censo_oficial.py --centros-json /tmp/centros.json --sql > /tmp/censo_oficial.sql

Formato --centros-json: lista de {id, nombre, parroquia?, municipio?, total_afectados?, familias_ocupadas?}
  o {centros: [...]} / filas con data anidada.

Matching: nombre normalizado (sin acentos, puntuación, prefijos UEN/UE/CEI/Liceo…).
Si hay empate, desempata por parroquia/municipio.

No sobrescribe total_afectados/familias si el centro ya tiene población > 0.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON = ROOT / "censo" / "campamentos_transitorios.json"

PREFIJOS = re.compile(
    r"^(u\.?\s*e\.?\s*n\.?\s*b\.?|u\.?\s*e\.?\s*n\.?|u\.?\s*e\.?\s*d\.?|u\.?\s*e\.?\s*e\.?|"
    r"u\.?\s*e\.?\s*|e\.?\s*n\.?\s*b\.?|e\.?\s*b\.?\s*e\.?|e\.?\s*b\.?\s*n\.?|"
    r"e\.?\s*t\.?\s*i\.?|c\.?\s*e\.?\s*i\.?\s*n\.?|c\.?\s*e\.?\s*i\.?|c\.?\s*e\.?\s*n\.?|"
    r"c\.?\s*e\.?\s*|complejo\s+educativo|liceo|escuela(\s+integral\s+basica)?|"
    r"unidad\s+educativa|refugio(\s+para)?|universidad|polideportivo|estadio|"
    r"fundacion|campamento|centro\s+de\s+educacion\s+inicial)\s+",
    re.I,
)

# Emparejamientos manuales oficial_id → centro_id (typos / nombres divergentes).
ALIASES_OFICIAL_A_CENTRO: dict[int, str] = {
    28: "centro-33",  # Delgado Chalbaud / Chalboud
    32: "centro-34",  # Perez Bonalde / Bonal
    51: "centro-11",  # Lossada / Losada
    64: "centro-59",  # GBM Pinto Salinas
    65: "centro-57",  # Gimnasio Vertical Santa Teresa / Quinta Crespo
    69: "centro-36",  # Mamá Rosa
    70: "centro-38",  # Lino Clemente
    73: "centro-39",  # Jesús María Alfaro
    76: "centro-44",  # Negro Primero
    77: "centro-46",  # Ana María Campos
    86: "centro-43",  # Baute / Baite
}

# IDs oficiales que no deben auto-matchearse (homónimos / ambiguos).
BLOQUEADOS_AUTO: set[int] = {
    81,  # C.E.N. Mariscal Sucre ≠ Escuela Internacional de Liderazgo
}


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def normalizar_nombre(s: str) -> str:
    s = strip_accents((s or "").lower())
    s = s.replace("ü", "u")
    s = PREFIJOS.sub("", s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> set[str]:
    return {t for t in normalizar_nombre(s).split() if len(t) > 1}


def score_nombres(a: str, b: str) -> float:
    na, nb = normalizar_nombre(a), normalizar_nombre(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.92
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    jaccard = inter / union
    # Bonus si el núcleo (última palabra significativa) coincide
    nucleo_a = na.split()[-1] if na.split() else ""
    nucleo_b = nb.split()[-1] if nb.split() else ""
    if nucleo_a and nucleo_a == nucleo_b and inter >= 1:
        jaccard = max(jaccard, 0.75)
    return jaccard


def map_estatus(raw: str | None) -> str | None:
    if not raw:
        return None
    u = raw.strip().upper()
    if u == "INSTALADO":
        return "instalado"
    if u in ("PROCESO_DE_INSTALACION", "PROCESO DE INSTALACION", "EN_PROCESO"):
        return "proceso_de_instalacion"
    return None


@dataclass
class CentroApp:
    id: str
    nombre: str
    parroquia: str = ""
    municipio: str = ""
    total_afectados: int = 0
    familias_ocupadas: int = 0


@dataclass
class Oficial:
    id: int
    campamento: str
    estado: str
    municipio_parroquia: str
    ministerio_ente: str | None
    estatus: str | None
    capacidad_maxima: int | None
    capacidad_instalada: int | None
    total_ocupado: int
    familias: int | None


def cargar_oficiales(path: Path) -> tuple[list[Oficial], str | None]:
    data = json.loads(path.read_text(encoding="utf-8"))
    fecha = (data.get("metadata") or {}).get("fecha_corte")
    out: list[Oficial] = []
    for c in data["campamentos"]:
        out.append(
            Oficial(
                id=int(c["id"]),
                campamento=c["campamento"],
                estado=c.get("estado") or "",
                municipio_parroquia=c.get("municipio_parroquia") or "",
                ministerio_ente=c.get("ministerio_ente"),
                estatus=c.get("estatus"),
                capacidad_maxima=c.get("capacidad_maxima"),
                capacidad_instalada=c.get("capacidad_instalada"),
                total_ocupado=int(c.get("total_ocupado") or 0),
                familias=c.get("familias"),
            )
        )
    return out, fecha


def cargar_centros(path: Path) -> list[CentroApp]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict):
        if "centros" in raw:
            rows = raw["centros"]
        elif "data" in raw and isinstance(raw["data"], list):
            rows = raw["data"]
        else:
            rows = [raw]
    else:
        rows = raw

    out: list[CentroApp] = []
    for r in rows:
        if "data" in r and isinstance(r["data"], dict):
            d = r["data"]
            out.append(
                CentroApp(
                    id=r.get("id") or d.get("id"),
                    nombre=d.get("nombre") or "",
                    parroquia=d.get("parroquia") or "",
                    municipio=d.get("municipio") or "",
                    total_afectados=int(d.get("total_afectados") or 0),
                    familias_ocupadas=int(d.get("familias_ocupadas") or 0),
                )
            )
        else:
            out.append(
                CentroApp(
                    id=str(r["id"]),
                    nombre=r.get("nombre") or "",
                    parroquia=r.get("parroquia") or "",
                    municipio=r.get("municipio") or "",
                    total_afectados=int(r.get("total_afectados") or 0),
                    familias_ocupadas=int(r.get("familias_ocupadas") or 0),
                )
            )
    return out


def lugar_score(oficial: Oficial, centro: CentroApp) -> float:
    lugar_o = normalizar_nombre(oficial.municipio_parroquia)
    lugar_c = normalizar_nombre(f"{centro.municipio} {centro.parroquia}")
    if not lugar_o or not lugar_c:
        return 0.0
    if lugar_o in lugar_c or lugar_c in lugar_o:
        return 0.08
    to, tc = tokens(oficial.municipio_parroquia), tokens(
        f"{centro.municipio} {centro.parroquia}"
    )
    if to & tc:
        return 0.05
    return 0.0


def emparejar(
    oficiales: list[Oficial], centros: list[CentroApp], umbral: float = 0.72
) -> tuple[list[tuple[Oficial, CentroApp, float]], list[Oficial], list[CentroApp]]:
    por_id = {c.id: c for c in centros}
    usados: set[str] = set()
    matches: list[tuple[Oficial, CentroApp, float]] = []
    sin_match: list[Oficial] = []

    # 1) Aliases manuales primero
    restantes: list[Oficial] = []
    for o in oficiales:
        cid = ALIASES_OFICIAL_A_CENTRO.get(o.id)
        if cid and cid in por_id and cid not in usados:
            matches.append((o, por_id[cid], 1.0))
            usados.add(cid)
        else:
            restantes.append(o)

    # 2) Auto-match por nombre
    restantes.sort(key=lambda o: -len(normalizar_nombre(o.campamento)))

    for o in restantes:
        if o.id in BLOQUEADOS_AUTO:
            sin_match.append(o)
            continue
        best: tuple[CentroApp, float] | None = None
        for c in centros:
            if c.id in usados:
                continue
            s = score_nombres(o.campamento, c.nombre) + lugar_score(o, c)
            if best is None or s > best[1]:
                best = (c, s)
        if best and best[1] >= umbral:
            matches.append((o, best[0], best[1]))
            usados.add(best[0].id)
        else:
            sin_match.append(o)

    sin_centro = [c for c in centros if c.id not in usados]
    return matches, sin_match, sin_centro


def sql_literal(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"


def generar_sql(
    matches: list[tuple[Oficial, CentroApp, float]],
    fecha_corte: str | None,
    sembrar_poblacion: bool,
) -> str:
    lines = [
        "-- Generado por scripts/importar_censo_oficial.py",
        "-- Fusiona censo_oficial en centros.data. No pisa población si ya hay damnificados.",
        "begin;",
        "",
    ]
    for o, c, score in matches:
        estatus = map_estatus(o.estatus)
        censo = {
            "id_oficial": o.id,
            "fecha_corte": fecha_corte,
            "ministerio_ente": o.ministerio_ente or "",
            "estatus_instalacion": estatus,
            "capacidad_maxima": o.capacidad_maxima,
            "capacidad_instalada": o.capacidad_instalada,
        }
        patch = {"censo_oficial": censo}
        # Sembrar población solo si el centro está vacío
        if sembrar_poblacion and c.total_afectados == 0 and o.total_ocupado > 0:
            patch["total_afectados"] = o.total_ocupado
        if (
            sembrar_poblacion
            and c.familias_ocupadas == 0
            and o.familias is not None
            and o.familias > 0
        ):
            patch["familias_ocupadas"] = o.familias

        patch_json = json.dumps(patch, ensure_ascii=False).replace("'", "''")
        lines.append(
            f"-- {o.campamento} → {c.nombre} ({c.id}) score={score:.2f}"
        )
        lines.append(
            "update public.centros\n"
            f"set data = data || '{patch_json}'::jsonb,\n"
            "    updated_at = (extract(epoch from now()) * 1000)::bigint,\n"
            "    updated_by = 'import_censo_oficial'\n"
            f"where id = {sql_literal(c.id)}\n"
            "  and coalesce(deleted, false) = false;"
        )
        lines.append("")
    lines.append("commit;")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--json",
        type=Path,
        default=DEFAULT_JSON,
        help="Ruta al JSON oficial",
    )
    ap.add_argument(
        "--centros-json",
        type=Path,
        required=True,
        help="Export de centros de la app (id, nombre, …)",
    )
    ap.add_argument("--umbral", type=float, default=0.72)
    ap.add_argument(
        "--sql",
        action="store_true",
        help="Imprime SQL de UPDATE en stdout",
    )
    ap.add_argument(
        "--sin-sembrar-poblacion",
        action="store_true",
        help="No rellena total_afectados/familias aunque estén en 0",
    )
    args = ap.parse_args()

    oficiales, fecha = cargar_oficiales(args.json)
    centros = cargar_centros(args.centros_json)
    matches, sin_match, sin_centro = emparejar(oficiales, centros, args.umbral)

    if args.sql:
        print(
            generar_sql(
                matches,
                fecha,
                sembrar_poblacion=not args.sin_sembrar_poblacion,
            )
        )
        return 0

    print(f"Oficiales: {len(oficiales)} | Centros app: {len(centros)}")
    print(f"Fecha corte: {fecha}")
    print(f"Matches (≥{args.umbral}): {len(matches)}")
    print()
    print("=== EMPAREJADOS ===")
    for o, c, s in sorted(matches, key=lambda x: -x[2]):
        print(f"  [{s:.2f}] #{o.id} {o.campamento!r}")
        print(f"         → {c.id} {c.nombre!r}")
    print()
    print(f"=== SIN MATCH OFICIAL ({len(sin_match)}) ===")
    for o in sin_match:
        print(f"  #{o.id} {o.campamento!r} ({o.municipio_parroquia})")
    print()
    print(f"=== CENTROS APP SIN OFICIAL ({len(sin_centro)}) ===")
    for c in sin_centro:
        print(f"  {c.id} {c.nombre!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
