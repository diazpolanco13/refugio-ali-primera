// Serie temporal de población a partir de las fotos del censo (CensoSnapshot).
// Reconstruye el nivel de población del refugio por día haciendo "carry-forward"
// del último censo conocido de cada sector, y deriva las variaciones netas
// (entradas/salidas) como la diferencia entre días consecutivos.

import type { CensoSnapshot, Vulnerables } from "./tipos";
import { normalizarVulnerables } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Inicio del día (hora local) de un timestamp en ms. */
function inicioDia(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Clave de día YYYY-MM-DD (hora local). */
function claveDia(ts: number): string {
  const d = new Date(ts);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Etiqueta corta en español para el eje del gráfico (ej. "24 jun"). */
function etiquetaDia(ts: number): string {
  return new Date(ts).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export interface PuntoSerie {
  /** Inicio del día en ms (para orden y eje temporal). */
  ts: number;
  /** Clave de día YYYY-MM-DD. */
  fecha: string;
  /** Etiqueta legible para el eje. */
  etiqueta: string;
  poblacion: number;
  familias: number;
  /** Variación de población respecto al día anterior (+ entradas, - salidas). */
  variacion: number;
}

/**
 * Construye la serie diaria de población y familias desde el primer censo
 * registrado hasta hoy. Para cada día se suma, por sector, el último censo con
 * fecha <= ese día (arrastra el último valor conocido aunque ese día no se haya
 * recensado). Así el gráfico refleja el total real del refugio en el tiempo.
 */
export function serieDiariaPoblacion(snaps: CensoSnapshot[]): PuntoSerie[] {
  if (!snaps.length) return [];

  const porSector = new Map<string, CensoSnapshot[]>();
  for (const s of snaps) {
    const arr = porSector.get(s.sector_id) ?? [];
    arr.push(s);
    porSector.set(s.sector_id, arr);
  }
  for (const arr of porSector.values()) arr.sort((a, b) => a.ts - b.ts);

  const minTs = Math.min(...snaps.map((s) => s.ts));
  const inicio = inicioDia(minTs);
  const fin = inicioDia(Date.now());

  // Punteros por sector para avanzar en un solo recorrido (días ascendentes).
  const idx = new Map<string, number>();
  for (const k of porSector.keys()) idx.set(k, 0);

  const serie: PuntoSerie[] = [];
  let anteriorPoblacion: number | null = null;

  for (let t = inicio; t <= fin; t += DIA_MS) {
    const finDia = t + DIA_MS - 1;
    let poblacion = 0;
    let familias = 0;

    for (const [sid, arr] of porSector) {
      let i = idx.get(sid) ?? 0;
      while (i + 1 < arr.length && arr[i + 1].ts <= finDia) i++;
      idx.set(sid, i);
      const cur = arr[i];
      if (cur && cur.ts <= finDia) {
        poblacion += cur.poblacion || 0;
        familias += cur.familias || 0;
      }
    }

    serie.push({
      ts: t,
      fecha: claveDia(t),
      etiqueta: etiquetaDia(t),
      poblacion,
      familias,
      variacion: anteriorPoblacion == null ? 0 : poblacion - anteriorPoblacion,
    });
    anteriorPoblacion = poblacion;
  }

  return serie;
}

export interface VariacionPoblacion {
  /** Población en el último día de la serie. */
  actual: number;
  /** Población en el día anterior. */
  anterior: number;
  /** Diferencia (+ entradas netas, - salidas netas). */
  delta: number;
}

/** Variación de población del último día respecto al anterior. */
export function variacionUltimoDia(serie: PuntoSerie[]): VariacionPoblacion {
  if (!serie.length) return { actual: 0, anterior: 0, delta: 0 };
  const actual = serie[serie.length - 1].poblacion;
  const anterior = serie.length > 1 ? serie[serie.length - 2].poblacion : actual;
  return { actual, anterior, delta: actual - anterior };
}

/** Suma de vulnerables a partir de los censos más recientes por sector. */
export function vulnerablesActuales(snaps: CensoSnapshot[]): Vulnerables {
  const ultimoPorSector = new Map<string, CensoSnapshot>();
  for (const s of snaps) {
    const prev = ultimoPorSector.get(s.sector_id);
    if (!prev || s.ts > prev.ts) ultimoPorSector.set(s.sector_id, s);
  }
  const total = normalizarVulnerables(null);
  for (const s of ultimoPorSector.values()) {
    const v = normalizarVulnerables(s.vulnerables);
    (Object.keys(total) as (keyof Vulnerables)[]).forEach((k) => {
      total[k] += v[k] || 0;
    });
  }
  return total;
}
