// Complejos: varios edificios operativos que cuentan como una sola unidad
// en totales de red (p. ej. UEN Gran Colombia = 4 edificios → 1 campamento).

import type { MarcadorOcupacionCentro } from "./centrosTransitorios";
import type { EstadoReporteDia } from "./reporteDiario";

/** Id canónico del complejo UEN Gran Colombia (4 edificios). */
export const COMPLEJO_GRAN_COLOMBIA = "gran-colombia";

/** Edificios del complejo Gran Colombia (ids internos; el nro oficial es 3). */
export const IDS_COMPLEJO_GRAN_COLOMBIA = [
  "centro-03",
  "centro-51",
  "centro-52",
  "centro-54",
] as const;

export type CentroConUnidad = {
  id: string;
  complejoId?: string | null;
};

/** Clave de conteo: complejo si existe, si no el id del centro. */
export function claveUnidadConteo(c: CentroConUnidad): string {
  const complejo = c.complejoId?.trim();
  return complejo || c.id;
}

/** Total oficial de campamentos (edificios del mismo complejo = 1). */
export function totalUnidadesConteo(centros: CentroConUnidad[]): number {
  return new Set(centros.map(claveUnidadConteo)).size;
}

/** Agrupa centros por unidad de conteo. */
export function agruparPorUnidadConteo<T extends CentroConUnidad>(
  centros: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const centro of centros) {
    const clave = claveUnidadConteo(centro);
    const grupo = map.get(clave);
    if (grupo) grupo.push(centro);
    else map.set(clave, [centro]);
  }
  return map;
}

/**
 * Estado de reporte de una unidad (complejo o centro suelto).
 * Completo solo si todos los edificios del grupo están completos.
 */
export function estadoReporteUnidad(estados: EstadoReporteDia[]): EstadoReporteDia {
  if (estados.length === 0) return "pendiente";
  if (estados.every((e) => e === "completo")) return "completo";
  if (estados.every((e) => e === "pendiente")) return "pendiente";
  if (estados.every((e) => e === "solo_parte")) return "solo_parte";
  return "parcial";
}

/** Activo si cualquier edificio del grupo tiene damnificados. */
export function marcadorOcupacionUnidad(
  marcadores: MarcadorOcupacionCentro[],
): MarcadorOcupacionCentro {
  return marcadores.some((m) => m === "activo") ? "activo" : "sin_refugiados";
}

/**
 * Cuenta unidades donde al menos un edificio cumple el predicado
 * (progreso operativo: “X de Y campamentos”).
 */
export function contarUnidadesCon<T extends CentroConUnidad>(
  centros: T[],
  pred: (c: T) => boolean,
): number {
  let n = 0;
  for (const miembros of agruparPorUnidadConteo(centros).values()) {
    if (miembros.some(pred)) n += 1;
  }
  return n;
}
