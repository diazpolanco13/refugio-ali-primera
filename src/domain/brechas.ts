import type { EstadoSector, PuntoServicio, Sector, TipoPunto } from "./tipos";
import { ESTANDARES } from "./estandares";

/** Point-in-polygon por ray casting. Punto y anillo en [lng, lat]. */
export function puntoEnPoligono(
  punto: [number, number],
  poligono: GeoJSON.Polygon,
): boolean {
  const [x, y] = punto;
  const anillo = poligono.coordinates[0] ?? [];
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const xi = anillo[i][0];
    const yi = anillo[i][1];
    const xj = anillo[j][0];
    const yj = anillo[j][1];
    const interseca =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (interseca) dentro = !dentro;
  }
  return dentro;
}

/**
 * ¿El punto cuenta para cumplir el estándar? No cuenta si está fuera de
 * servicio, ni si es un baño/ducha improvisado (no cumple el estándar).
 */
export function cuentaParaEstandar(p: PuntoServicio): boolean {
  if (p.estado === "fuera_servicio") return false;
  if (
    (p.tipo === "sanitarios" || p.tipo === "duchas") &&
    p.condicion === "improvisada"
  ) {
    return false;
  }
  return true;
}

/** Puntos de servicio que caen dentro del polígono de un sector. */
export function puntosEnSector(
  sector: Sector,
  puntos: PuntoServicio[],
): PuntoServicio[] {
  if (!sector.geom?.coordinates) return [];
  return puntos.filter((p) => {
    if (!p.geom?.coordinates) return false;
    return puntoEnPoligono(p.geom.coordinates as [number, number], sector.geom);
  });
}

export interface Cobertura {
  tipo: TipoPunto;
  disponible: number; // unidades operativas dentro del sector
  requerido: number; // unidades necesarias según estándar
  porcentaje: number; // 0-100+
  esencial: boolean;
  descripcion: string;
}

/** Cobertura de cada servicio con estándar, para un sector. */
export function calcularCobertura(
  sector: Sector,
  puntos: PuntoServicio[],
): Cobertura[] {
  const dentro = puntosEnSector(sector, puntos);
  const resultado: Cobertura[] = [];

  for (const est of Object.values(ESTANDARES)) {
    if (!est) continue;
    const base =
      (est.base === "familias" ? sector.familias : sector.poblacion_estimada) || 0;
    const requerido = base > 0 ? Math.ceil(base / est.personasPorUnidad) : 0;
    const disponible = dentro.filter(
      (p) => p.tipo === est.tipo && cuentaParaEstandar(p),
    ).length;
    const porcentaje =
      requerido === 0 ? 100 : Math.round((disponible / requerido) * 100);
    resultado.push({
      tipo: est.tipo,
      disponible,
      requerido,
      porcentaje,
      esencial: est.esencial,
      descripcion: est.descripcion,
    });
  }
  return resultado;
}

/**
 * Semáforo del sector según servicios esenciales:
 * rojo si algún esencial < 50%, amarillo si algún esencial < 100%, verde si todo cumple.
 */
export function estadoSector(
  sector: Sector,
  puntos: PuntoServicio[],
): EstadoSector {
  const esenciales = calcularCobertura(sector, puntos).filter((c) => c.esencial);
  if (esenciales.length === 0) return "verde";
  if (esenciales.some((c) => c.porcentaje < 50)) return "rojo";
  if (esenciales.some((c) => c.porcentaje < 100)) return "amarillo";
  return "verde";
}

export interface Alerta {
  nivel: "critico" | "advertencia";
  titulo: string;
  detalle: string;
  sector?: string;
}

/** Genera alertas de sectores en rojo/amarillo y puntos fuera de servicio. */
export function generarAlertas(
  sectores: Sector[],
  puntos: PuntoServicio[],
): Alerta[] {
  const alertas: Alerta[] = [];

  for (const s of sectores) {
    const cob = calcularCobertura(s, puntos);
    for (const c of cob.filter((c) => c.esencial && c.porcentaje < 100)) {
      alertas.push({
        nivel: c.porcentaje < 50 ? "critico" : "advertencia",
        titulo: `Sector ${s.nombre}: ${c.tipo} insuficiente (${c.porcentaje}%)`,
        detalle: `${c.disponible} de ${c.requerido} unidades requeridas. ${c.descripcion}`,
        sector: s.nombre,
      });
    }
  }

  const fuera = puntos.filter((p) => p.estado === "fuera_servicio");
  for (const p of fuera) {
    alertas.push({
      nivel: "advertencia",
      titulo: `${p.nombre || p.tipo} fuera de servicio`,
      detalle: "Punto marcado como fuera de servicio.",
    });
  }

  // Críticas primero.
  return alertas.sort((a, b) =>
    a.nivel === b.nivel ? 0 : a.nivel === "critico" ? -1 : 1,
  );
}

export interface KpisGlobales {
  poblacionTotal: number;
  familiasTotal: number;
  vulnerablesTotal: number;
  sectores: number;
  puntosOperativos: number;
  puntosTotal: number;
  sectoresRojo: number;
  sectoresAmarillo: number;
  sectoresVerde: number;
}

export function kpisGlobales(
  sectores: Sector[],
  puntos: PuntoServicio[],
): KpisGlobales {
  const poblacionTotal = sectores.reduce((a, s) => a + (s.poblacion_estimada || 0), 0);
  const familiasTotal = sectores.reduce((a, s) => a + (s.familias || 0), 0);
  const vulnerablesTotal = sectores.reduce((a, s) => {
    const v = s.vulnerables;
    if (!v) return a;
    return (
      a +
      (v.ninos || 0) +
      (v.embarazadas || 0) +
      (v.adultos_mayores || 0) +
      (v.discapacidad || 0)
    );
  }, 0);
  const estados = sectores.map((s) => estadoSector(s, puntos));
  return {
    poblacionTotal,
    familiasTotal,
    vulnerablesTotal,
    sectores: sectores.length,
    puntosOperativos: puntos.filter((p) => p.estado === "operativo").length,
    puntosTotal: puntos.length,
    sectoresRojo: estados.filter((e) => e === "rojo").length,
    sectoresAmarillo: estados.filter((e) => e === "amarillo").length,
    sectoresVerde: estados.filter((e) => e === "verde").length,
  };
}
