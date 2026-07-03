// Priorización de Centros Transitorios (lógica pura, sala situacional): responde
// "¿qué centro requiere MÁS atención ahora?". Combina en un solo puntaje las
// distintas presiones sobre un centro —saturación, agua, saneamiento, población
// vulnerable y requerimientos logísticos pendientes— y las expresa además como
// FACTORES legibles (chips) para que el operador entienda el porqué del orden.
//
// No mide cupo (eso ya lo hace `capacidadCentros.ts`); mide URGENCIA. Un centro
// con mucho cupo pero sin agua es prioritario; uno lleno pero estable puede no
// serlo. Reutiliza `analisisCentro()` y `totalVulnerables()` (no duplica lógica).

import {
  normalizarCentro,
  poblacionCentro,
  totalesRequerimientos,
  type CentroTransitorio,
} from "./centrosTransitorios";
import { analisisCentro, type AnalisisCentro } from "./capacidadCentros";
import { totalVulnerables } from "./tipos";

/** Nivel de atención de un centro (mayor urgencia arriba). */
export type NivelPrioridad = "critico" | "alto" | "medio" | "estable" | "sin_datos";

/** Gravedad de un factor individual (para color/orden del chip). */
export type SeveridadFactor = "critico" | "alto" | "medio" | "info";

/** Familia de la presión detectada. */
export type ClaveFactor =
  | "saturacion"
  | "agua"
  | "saneamiento"
  | "vulnerables"
  | "requerimientos";

/** Un motivo concreto por el que un centro requiere atención (chip legible). */
export interface FactorPrioridad {
  clave: ClaveFactor;
  /** Texto corto para el chip ("Saturado 120%", "Faltan 6 baños"). */
  label: string;
  severidad: SeveridadFactor;
  /** Puntos que aporta al puntaje total. */
  puntos: number;
}

export interface PrioridadCentro {
  /** Puntaje total de urgencia (mayor = más atención). */
  puntaje: number;
  nivel: NivelPrioridad;
  /** Motivos detectados, ordenados por gravedad (para pintar chips). */
  factores: FactorPrioridad[];
  /** Análisis de capacidad subyacente (reutilizado por la UI). */
  analisis: AnalisisCentro;
}

/** Peso base de cada severidad. */
const PUNTOS_SEVERIDAD: Record<SeveridadFactor, number> = {
  critico: 40,
  alto: 25,
  medio: 12,
  info: 4,
};

function factor(
  clave: ClaveFactor,
  label: string,
  severidad: SeveridadFactor,
  puntosExtra = 0,
): FactorPrioridad {
  return { clave, label, severidad, puntos: PUNTOS_SEVERIDAD[severidad] + puntosExtra };
}

/** Orden de gravedad para ordenar los chips dentro de una tarjeta. */
const RANGO_SEVERIDAD: Record<SeveridadFactor, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  info: 3,
};

/**
 * Analiza la urgencia de un centro y devuelve puntaje + nivel + factores.
 * Un centro sin capacidad medida y sin levantamiento se marca `sin_datos`
 * (pendiente de censar), no como urgencia física.
 */
export function prioridadCentro(centro: CentroTransitorio): PrioridadCentro {
  const c = normalizarCentro(centro);
  const analisis = analisisCentro(centro);
  const factores: FactorPrioridad[] = [];

  // 1. Saturación (% ocupación vs cupo real).
  const pct = analisis.porcentajeOcupacion;
  if (pct != null) {
    if (pct >= 100) {
      factores.push(factor("saturacion", `Saturado ${Math.min(999, pct)}%`, "critico"));
    } else if (pct >= 80) {
      factores.push(factor("saturacion", `Casi lleno ${pct}%`, "medio"));
    }
  }

  // 2. Agua.
  if (analisis.agua.medido || analisis.agua.tanque) {
    if (analisis.agua.estado === "critico") {
      const label = !analisis.agua.operativa
        ? "Sin suministro de agua"
        : "Agua < 1 día";
      factores.push(factor("agua", label, "critico"));
    } else if (analisis.agua.estado === "atencion") {
      factores.push(factor("agua", "Agua por vigilar", "medio"));
    }
  }

  // 3. Saneamiento: camas / pocetas / duchas que no cubren el estándar.
  for (const r of analisis.recursos) {
    if (!r.cuentaParaCupo || !r.medido || r.sinNecesidad) continue;
    if (r.cobertura >= 100) continue;
    const faltan = Math.max(0, r.requeridas - r.operativas);
    if (faltan <= 0) continue;
    const label = `Faltan ${faltan.toLocaleString("es")} ${r.unidad}`;
    if (r.cobertura < 60) factores.push(factor("saneamiento", label, "alto"));
    else factores.push(factor("saneamiento", label, "medio"));
  }

  // 4. Población vulnerable (proporción sobre refugiados alojados).
  const refugiados = poblacionCentro(centro);
  const vulnerables = totalVulnerables(c.ocupacion);
  if (refugiados > 0 && vulnerables > 0) {
    const proporcion = vulnerables / refugiados;
    const label = `${vulnerables.toLocaleString("es")} vulnerables`;
    if (proporcion >= 0.5) factores.push(factor("vulnerables", label, "alto"));
    else if (proporcion >= 0.3) factores.push(factor("vulnerables", label, "medio"));
  }

  // 5. Requerimientos logísticos pendientes.
  const req = totalesRequerimientos(c.requerimientos);
  if (req.lineas > 0) {
    const label = `${req.lineas.toLocaleString("es")} requerimiento${req.lineas === 1 ? "" : "s"}`;
    // Muchas unidades solicitadas suman un poco más.
    const extra = req.unidades >= 100 ? 6 : req.unidades >= 30 ? 3 : 0;
    factores.push(factor("requerimientos", label, "info", extra));
  }

  const puntaje = factores.reduce((s, f) => s + f.puntos, 0);
  factores.sort((a, b) => RANGO_SEVERIDAD[a.severidad] - RANGO_SEVERIDAD[b.severidad]);

  // Nivel: sin datos si no hay capacidad medida ni levantamiento con población.
  const sinCapacidad = analisis.capacidadEfectiva == null;
  const sinLevantamiento = refugiados === 0 && !c.fecha_levantamiento;
  let nivel: NivelPrioridad;
  if (sinCapacidad && sinLevantamiento) {
    nivel = "sin_datos";
  } else if (factores.some((f) => f.severidad === "critico") || puntaje >= 60) {
    nivel = "critico";
  } else if (factores.some((f) => f.severidad === "alto") || puntaje >= 30) {
    nivel = "alto";
  } else if (puntaje > 0) {
    nivel = "medio";
  } else {
    nivel = "estable";
  }

  return { puntaje, nivel, factores, analisis };
}

/** Color por nivel para rieles, badges y contadores de triage. */
export const COLOR_NIVEL: Record<NivelPrioridad, string> = {
  critico: "#ef4444",
  alto: "#f97316",
  medio: "#f59e0b",
  estable: "#22c55e",
  sin_datos: "#64748b",
};

/** Color por severidad de un chip de factor. */
export const COLOR_SEVERIDAD: Record<SeveridadFactor, string> = {
  critico: "#ef4444",
  alto: "#f97316",
  medio: "#f59e0b",
  info: "#64748b",
};

export const ETIQUETA_NIVEL: Record<NivelPrioridad, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Medio",
  estable: "Estable",
  sin_datos: "Sin levantamiento",
};

/** Orden de niveles para agrupar/listar de más a menos urgente. */
export const ORDEN_NIVELES: NivelPrioridad[] = [
  "critico",
  "alto",
  "medio",
  "estable",
  "sin_datos",
];

const RANGO_NIVEL: Record<NivelPrioridad, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  estable: 3,
  sin_datos: 4,
};

/**
 * Ordena centros de más a menos urgente: primero por nivel, luego por puntaje
 * (desc) y, como desempate, por nombre.
 */
export function ordenarPorPrioridad(
  filas: { centro: CentroTransitorio; prioridad: PrioridadCentro }[],
): { centro: CentroTransitorio; prioridad: PrioridadCentro }[] {
  return [...filas].sort((a, b) => {
    const nivel = RANGO_NIVEL[a.prioridad.nivel] - RANGO_NIVEL[b.prioridad.nivel];
    if (nivel !== 0) return nivel;
    const puntaje = b.prioridad.puntaje - a.prioridad.puntaje;
    if (puntaje !== 0) return puntaje;
    return a.centro.nombre.localeCompare(b.centro.nombre, "es");
  });
}
