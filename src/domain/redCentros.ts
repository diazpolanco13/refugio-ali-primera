// KPIs y agregados de la red de Centros Transitorios (lógica pura).

import {
  normalizarCentro,
  poblacionCentro,
  totalPersonalOperativo,
  type CentroTransitorio,
} from "./centrosTransitorios";
import { analisisCentro } from "./capacidadCentros";
import {
  ETIQUETA_NIVEL,
  ordenarPorPrioridad,
  prioridadCentro,
  type NivelPrioridad,
  type PrioridadCentro,
} from "./prioridadCentros";
import { sumarVulnerables, totalVulnerables, type Vulnerables } from "./tipos";

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
  return sumarVulnerables(centros.map((c) => ({ vulnerables: c.ocupacion })));
}

/** KPIs globales de la red de centros. */
export function kpisRedCentros(centros: CentroTransitorio[]): KpisRedCentros {
  let refugiadosTotal = 0;
  let familiasTotal = 0;
  let personalTotal = 0;
  let centrosConDatos = 0;
  let cupoDisponible = 0;
  let centrosCriticos = 0;
  let centrosSaturados = 0;

  for (const centro of centros) {
    const c = normalizarCentro(centro);
    const ref = poblacionCentro(centro);
    const analisis = analisisCentro(centro);
    const prio = prioridadCentro(centro);

    refugiadosTotal += ref;
    familiasTotal += c.familias_ocupadas;
    personalTotal += totalPersonalOperativo(c.personal);

    if (ref > 0 || c.familias_ocupadas > 0) centrosConDatos += 1;
    if (analisis.cupoReal != null) cupoDisponible += analisis.cupoReal;
    if (prio.nivel === "critico" || prio.nivel === "alto") centrosCriticos += 1;
    if (analisis.semaforo === "rojo") centrosSaturados += 1;
  }

  return {
    refugiadosTotal,
    familiasTotal,
    personalTotal,
    centrosConDatos,
    centrosTotal: centros.length,
    cupoDisponible,
    centrosCriticos,
    centrosSaturados,
  };
}

/** Población agrupada por parroquia (para mapa de calor / barras). */
export function poblacionPorParroquia(centros: CentroTransitorio[]): FilaParroquia[] {
  const map = new Map<string, FilaParroquia>();
  for (const centro of centros) {
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
  const filas = centros.map((centro) => ({
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
  for (const centro of centros) {
    conteo[prioridadCentro(centro).nivel] += 1;
  }
  return conteo;
}

export { ETIQUETA_NIVEL, totalVulnerables };
