import type {
  PuntoServicio,
  RegistroDistribucion,
  Sector,
  TipoPunto,
} from "./tipos";
import { normalizarVulnerables, totalHombres, totalMujeres, totalVulnerables } from "./tipos";
import { ESTANDARES } from "./estandares";
import { VENTANAS_COMIDA, type Comida } from "./estandares";
import { infoLimpieza } from "./limpieza";
import { claveDiaLocal } from "./distribucion";

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

export interface Cobertura {
  tipo: TipoPunto;
  disponible: number; // unidades operativas en todo el parque
  requerido: number; // unidades necesarias según estándar
  porcentaje: number; // 0-100+
  esencial: boolean;
  descripcion: string;
}

/**
 * Cobertura de cada servicio con estándar a nivel de TODO EL PARQUE: cruza la
 * población (o familias) total del refugio contra los puntos operativos de ese
 * tipo, sin importar en qué sector caen (los puntos están en ubicaciones fijas
 * del parque, no por sector).
 */
export function coberturaGlobal(
  sectores: Sector[],
  puntos: PuntoServicio[],
): Cobertura[] {
  const poblacion = sectores.reduce((a, s) => a + (s.poblacion_estimada || 0), 0);
  const familias = sectores.reduce((a, s) => a + (s.familias || 0), 0);
  const resultado: Cobertura[] = [];

  for (const est of Object.values(ESTANDARES)) {
    if (!est) continue;
    const base = (est.base === "familias" ? familias : poblacion) || 0;
    const requerido = base > 0 ? Math.ceil(base / est.personasPorUnidad) : 0;
    const disponible = puntos.filter(
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

export interface Alerta {
  nivel: "critico" | "advertencia";
  titulo: string;
  detalle: string;
  sector?: string;
}

/** Nombre legible del servicio para los títulos de alerta. */
const NOMBRE_SERVICIO: Partial<Record<TipoPunto, string>> = {
  hidratacion: "Agua",
  sanitarios: "Letrinas",
  duchas: "Duchas",
  salud: "Atención médica",
  comida: "Puntos de comida",
  residuos: "Contenedores de basura",
};

/** Hora local en decimal (13.5 = 13:30) de un timestamp. */
function horaDecimal(ts: number): number {
  const d = new Date(ts);
  return d.getHours() + d.getMinutes() / 60;
}

/**
 * Genera las alertas del parque a partir de tres fuentes:
 * 1. Cobertura global de servicios por debajo del estándar Esfera.
 * 2. Comidas del día que no llegaron dentro de su ventana horaria.
 * 3. Aseo vencido (letrinas, duchas o basura sin atender a tiempo).
 * Más los puntos marcados como fuera de servicio.
 */
export function generarAlertas(
  sectores: Sector[],
  puntos: PuntoServicio[],
  distribuciones: RegistroDistribucion[] = [],
  ahora: number = Date.now(),
): Alerta[] {
  const alertas: Alerta[] = [];

  // 1. Cobertura global insuficiente.
  for (const c of coberturaGlobal(sectores, puntos)) {
    if (c.requerido === 0 || c.porcentaje >= 100) continue;
    const nombre = NOMBRE_SERVICIO[c.tipo] ?? c.tipo;
    alertas.push({
      nivel: c.porcentaje < 50 ? "critico" : "advertencia",
      titulo: `${nombre} insuficientes (${c.porcentaje}%)`,
      detalle: `${c.disponible} de ${c.requerido} necesarios. ${c.descripcion}`,
    });
  }

  // 2. Comidas no llegadas en su ventana.
  const diaHoy = claveDiaLocal(ahora);
  const hora = horaDecimal(ahora);
  const llegadas = new Set(
    distribuciones
      .filter(
        (r) =>
          r.clase === "jornada" && r.dia === diaHoy && r.hora_llegada != null,
      )
      .map((r) => r.jornada),
  );
  for (const comida of Object.keys(VENTANAS_COMIDA) as Comida[]) {
    if (llegadas.has(comida)) continue;
    const v = VENTANAS_COMIDA[comida];
    if (hora >= v.inicio && hora < v.fin) {
      alertas.push({
        nivel: "advertencia",
        titulo: `${v.label} sin registrar`,
        detalle: `Aún no se ha marcado la llegada de la comida (ventana en curso).`,
      });
    } else if (hora >= v.fin) {
      alertas.push({
        nivel: "critico",
        titulo: `${v.label} no llegó`,
        detalle: `Terminó la ventana horaria y no se registró la llegada de la comida.`,
      });
    }
  }

  // 3. Aseo vencido (letrinas, duchas, basura).
  for (const p of puntos) {
    const info = infoLimpieza(p, ahora);
    if (info?.estado === "vencido") {
      const accion = p.tipo === "residuos" ? "recolección" : "limpieza";
      alertas.push({
        nivel: "advertencia",
        titulo: `${p.nombre || p.tipo}: ${accion} vencida`,
        detalle: `Pasó el tiempo programado sin registrar ${accion}.`,
      });
    }
  }

  // 4. Puntos fuera de servicio.
  for (const p of puntos.filter((p) => p.estado === "fuera_servicio")) {
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
  hombresTotal: number;
  mujeresTotal: number;
  sectores: number;
  puntosOperativos: number;
  puntosTotal: number;
}

export function kpisGlobales(
  sectores: Sector[],
  puntos: PuntoServicio[],
): KpisGlobales {
  const poblacionTotal = sectores.reduce((a, s) => a + (s.poblacion_estimada || 0), 0);
  const familiasTotal = sectores.reduce((a, s) => a + (s.familias || 0), 0);
  let vulnerablesTotal = 0;
  let hombresTotal = 0;
  let mujeresTotal = 0;
  for (const s of sectores) {
    const v = normalizarVulnerables(s.vulnerables);
    vulnerablesTotal += totalVulnerables(v);
    hombresTotal += totalHombres(v);
    mujeresTotal += totalMujeres(v);
  }
  return {
    poblacionTotal,
    familiasTotal,
    vulnerablesTotal,
    hombresTotal,
    mujeresTotal,
    sectores: sectores.length,
    puntosOperativos: puntos.filter((p) => p.estado === "operativo").length,
    puntosTotal: puntos.length,
  };
}
