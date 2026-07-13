// KPIs y agregados de la red de Centros Transitorios (lógica pura).

import {
  centrosDeProduccion,
  normalizarCentro,
  poblacionCentro,
  totalPersonalOperativo,
  type CentroTransitorio,
} from "./centrosTransitorios";
import { normalizarUbicacionCentro } from "./catalogosHumanitarios";
import { contarUnidadesCon, totalUnidadesConteo } from "./complejosCentros";
import { analisisCentro } from "./capacidadCentros";
import {
  ETIQUETA_NIVEL,
  ordenarPorPrioridad,
  prioridadCentro,
  type NivelPrioridad,
  type PrioridadCentro,
} from "./prioridadCentros";
import { sumarVulnerables, totalVulnerables, type Vulnerables } from "./tipos";

/** Zonas fijas de la sala situacional (ultrawide). */
export type ZonaSala = "caracas_miranda" | "vargas";

export const ETIQUETA_ZONA_SALA: Record<ZonaSala, string> = {
  caracas_miranda: "Caracas / Miranda",
  vargas: "Vargas",
};

export const ZONAS_SALA: ZonaSala[] = ["caracas_miranda", "vargas"];

export interface KpisZonaSala {
  refugiosTotal: number;
  ocupados: number;
  vacios: number;
  familias: number;
  damnificados: number;
  mascotas: number;
}

function kpisZonaVacia(): KpisZonaSala {
  return {
    refugiosTotal: 0,
    ocupados: 0,
    vacios: 0,
    familias: 0,
    damnificados: 0,
    mascotas: 0,
  };
}

/**
 * Asigna un centro a la zona de sala por `estado_federativo` normalizado.
 * DC + Miranda → Caracas/Miranda; La Guaira → Vargas.
 */
export function zonaSalaDeCentro(c: CentroTransitorio): ZonaSala | null {
  const estado = normalizarUbicacionCentro({
    estado_federativo: c.estado_federativo,
    municipio: c.municipio,
    parroquia: c.parroquia,
  }).estado_federativo;
  if (estado === "Distrito Capital" || estado === "Miranda") return "caracas_miranda";
  if (estado === "La Guaira") return "vargas";
  return null;
}

/** Centros de producción que caen en una zona de sala (o todos si zona es null). */
export function centrosDeZonaSala(
  centros: CentroTransitorio[],
  zona: ZonaSala | null,
): CentroTransitorio[] {
  const op = centrosDeProduccion(centros);
  if (!zona) return op;
  return op.filter((c) => zonaSalaDeCentro(c) === zona);
}

/** KPIs por zona de la sala (Caracas/Miranda y Vargas). */
export function kpisPorZonaSala(
  centros: CentroTransitorio[],
): Record<ZonaSala, KpisZonaSala> {
  const out: Record<ZonaSala, KpisZonaSala> = {
    caracas_miranda: kpisZonaVacia(),
    vargas: kpisZonaVacia(),
  };

  for (const centro of centrosDeProduccion(centros)) {
    const zona = zonaSalaDeCentro(centro);
    if (!zona) continue;
    const c = normalizarCentro(centro);
    const ref = poblacionCentro(centro);
    const fila = out[zona];
    fila.refugiosTotal += 1;
    if (ref > 0) fila.ocupados += 1;
    else fila.vacios += 1;
    fila.familias += c.familias_ocupadas;
    fila.damnificados += ref;
    fila.mascotas += c.ocupacion.mascotas;
  }

  return out;
}

export interface KpisRedCentros {
  refugiadosTotal: number;
  familiasTotal: number;
  personalTotal: number;
  centrosConDatos: number;
  centrosTotal: number;
  cupoDisponible: number;
  centrosCriticos: number;
  centrosSaturados: number;
}

export interface FilaParroquia {
  parroquia: string;
  refugiados: number;
  familias: number;
  centros: number;
}

export interface FilaPrioridadDashboard {
  centro: CentroTransitorio;
  prioridad: PrioridadCentro;
}

/** Demografía agregada de toda la red (ocupación por edad/sexo). */
export function demografiaRed(centros: CentroTransitorio[]): Vulnerables {
  const op = centrosDeProduccion(centros);
  return sumarVulnerables(op.map((c) => ({ vulnerables: c.ocupacion })));
}

/** KPIs globales de la red de centros. */
export function kpisRedCentros(centros: CentroTransitorio[]): KpisRedCentros {
  const op = centrosDeProduccion(centros);
  let refugiadosTotal = 0;
  let familiasTotal = 0;
  let personalTotal = 0;
  let cupoDisponible = 0;
  let centrosCriticos = 0;
  let centrosSaturados = 0;

  for (const centro of op) {
    const c = normalizarCentro(centro);
    const ref = poblacionCentro(centro);
    const analisis = analisisCentro(centro);
    const prio = prioridadCentro(centro);

    refugiadosTotal += ref;
    familiasTotal += c.familias_ocupadas;
    personalTotal += totalPersonalOperativo(c.personal);

    if (analisis.cupoDisponible != null) cupoDisponible += analisis.cupoDisponible;
    if (prio.nivel === "critico" || prio.nivel === "alto") centrosCriticos += 1;
    if (analisis.semaforo === "rojo") centrosSaturados += 1;
  }

  const centrosConDatos = contarUnidadesCon(op, (centro) => {
    const c = normalizarCentro(centro);
    return poblacionCentro(centro) > 0 || c.familias_ocupadas > 0;
  });

  return {
    refugiadosTotal,
    familiasTotal,
    personalTotal,
    centrosConDatos,
    centrosTotal: totalUnidadesConteo(op),
    cupoDisponible,
    centrosCriticos,
    centrosSaturados,
  };
}

/** Población agrupada por parroquia (para mapa de calor / barras). */
export function poblacionPorParroquia(centros: CentroTransitorio[]): FilaParroquia[] {
  const map = new Map<string, FilaParroquia>();
  for (const centro of centrosDeProduccion(centros)) {
    const parroquia = centro.parroquia?.trim() || "Sin parroquia";
    const fila = map.get(parroquia) ?? {
      parroquia,
      refugiados: 0,
      familias: 0,
      centros: 0,
    };
    fila.refugiados += poblacionCentro(centro);
    fila.familias += normalizarCentro(centro).familias_ocupadas;
    fila.centros += 1;
    map.set(parroquia, fila);
  }
  return [...map.values()].sort((a, b) => b.refugiados - a.refugiados);
}

/** Centros ordenados por urgencia (top N para el dashboard). */
export function topPrioridadCentros(
  centros: CentroTransitorio[],
  limite = 12,
): FilaPrioridadDashboard[] {
  const filas = centrosDeProduccion(centros).map((centro) => ({
    centro,
    prioridad: prioridadCentro(centro),
  }));
  return ordenarPorPrioridad(filas).slice(0, limite);
}

/** Conteo de centros por nivel de prioridad. */
export function conteoPorNivel(
  centros: CentroTransitorio[],
): Record<NivelPrioridad, number> {
  const conteo: Record<NivelPrioridad, number> = {
    critico: 0,
    alto: 0,
    medio: 0,
    estable: 0,
    sin_datos: 0,
  };
  for (const centro of centrosDeProduccion(centros)) {
    conteo[prioridadCentro(centro).nivel] += 1;
  }
  return conteo;
}

export { ETIQUETA_NIVEL, totalVulnerables };

export type BoundsRedCentros = [[number, number], [number, number]];

/** Extensión geográfica de los centros con coordenadas (lng/lat). */
export function boundsRedCentros(centros: CentroTransitorio[]): BoundsRedCentros | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let n = 0;

  for (const centro of centros) {
    if (!centro.geom) continue;
    const [lng, lat] = centro.geom.coordinates;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
    n += 1;
  }

  if (n === 0) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
