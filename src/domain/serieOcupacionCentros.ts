// Funciones puras para construir series temporales de ocupación de la red
// de Centros Transitorios a partir de los snapshots de `ocupaciones_centros`.
//
// Modelo: cada fila de `ocupaciones_centros` es una foto diaria de un centro
// (`centro_id`, `dia`, `total_afectados`, `familias`, `personal_total`,
// `ocupacion`). Hay una fila por centro por día (la última edición del día
// gana). Las series se construyen con **carry-forward**: para cada día del
// rango, cada centro aporta su último snapshot conocido con `dia <= día
// actual`. Si un centro no tiene snapshots, aporta 0.
//
// Análogo al `poblacion.ts` que existía para los sectores del parque (ver
// referencias en CLAUDE.md), aplicado ahora a la red de centros.

import { normalizarVulnerables, totalPoblacion, type Vulnerables } from "./tipos";

export interface SnapshotOcupacion {
  centro_id: string;
  /** YYYY-MM-DD */
  dia: string;
  ts: number;
  total_afectados: number;
  familias: number;
  personal_total: number;
  /** Contador manual de incidencias de salud del día (parte Telegram). */
  incidencias_salud: number;
  ocupacion: Vulnerables;
  /** Meta de la última escritura del snapshot (parte / salud en ocupaciones). */
  updated_at?: number;
  updated_by?: string;
}

/**
 * Damnificados en un snapshot diario: personas alojadas, sin personal operativo
 * ni mascotas. Las embarazadas ya están en `adultos_m` del desglose etario;
 * no se suman aparte.
 */
export function refugiadosEnSnapshot(snap: SnapshotOcupacion): number {
  const desdeDesglose = totalPoblacion(normalizarVulnerables(snap.ocupacion));
  const totalParte = Math.max(0, snap.total_afectados ?? 0);
  if (totalParte > 0) return totalParte;
  return desdeDesglose;
}

export interface PuntoSerie {
  /** YYYY-MM-DD */
  dia: string;
  total: number;
  familias: number;
  personal: number;
}

export interface PuntoSeriePorGrupo {
  /** YYYY-MM-DD */
  dia: string;
  areaMetropolitana: number;
  granCaracas: number;
}

/** Punto diario de población desglosada (gráfico de la pestaña Población). */
export interface PuntoSeriePoblacion {
  dia: string;
  refugiados: number;
  familias: number;
  mascotas: number;
}

export type VentanaSeriePoblacion = 7 | 15 | 30;

/** Catálogo mínimo de centro para las series agregadas (solo id + grupo). */
export interface CentroParaAgregado {
  id: string;
  grupo: string;
}

const GRUPO_AREA_METROPOLITANA = "Área Metropolitana";
const GRUPO_GRAN_CARACAS = "Gran Caracas";

/** Suma los totales de un array de snapshots. */
function sumarSnapshots(snaps: SnapshotOcupacion[]): {
  total: number;
  familias: number;
  personal: number;
} {
  return snaps.reduce(
    (acc, s) => ({
      total: acc.total + (s.total_afectados ?? 0),
      familias: acc.familias + (s.familias ?? 0),
      personal: acc.personal + (s.personal_total ?? 0),
    }),
    { total: 0, familias: 0, personal: 0 },
  );
}

/**
 * Devuelve la lista ordenada de días (YYYY-MM-DD) desde `min(dia)` hasta
 * `max(dia)` inclusive, iterando día a día. Si no hay snapshots, devuelve [].
 */
function rangoDias(dias: string[]): string[] {
  if (dias.length === 0) return [];
  const unicos = Array.from(new Set(dias)).sort();
  const [primero, ultimo] = [unicos[0], unicos[unicos.length - 1]];
  const out: string[] = [];
  const cursor = new Date(`${primero}T00:00:00Z`);
  const fin = new Date(`${ultimo}T00:00:00Z`);
  while (cursor.getTime() <= fin.getTime()) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Índice `centro_id → snapshots ordenados por dia asc`. Precomputarlo evita
 * recorrer todo el array por cada día del rango.
 */
function indexarPorCentro(snaps: SnapshotOcupacion[]): Map<string, SnapshotOcupacion[]> {
  const map = new Map<string, SnapshotOcupacion[]>();
  for (const s of snaps) {
    const arr = map.get(s.centro_id) ?? [];
    arr.push(s);
    map.set(s.centro_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.ts - b.ts));
  }
  return map;
}

/** Último snapshot de un centro con `dia <= diaActual` (carry-forward). */
function ultimoHasta(snaps: SnapshotOcupacion[], diaActual: string): SnapshotOcupacion | undefined {
  // `snaps` ya está ordenado por dia asc. Buscamos el último con dia <= diaActual.
  let res: SnapshotOcupacion | undefined;
  for (const s of snaps) {
    if (s.dia <= diaActual) res = s;
    else break;
  }
  return res;
}

/**
 * Serie diaria agregada de la red (todos los centros) con carry-forward.
 * Para cada día del rango, suma el último snapshot conocido de cada centro.
 * Devuelve array de `{ dia, total, familias, personal }` ordenado por dia.
 */
export function serieDiariaOcupacionRed(
  snapshots: SnapshotOcupacion[],
  centros: CentroParaAgregado[],
): PuntoSerie[] {
  if (snapshots.length === 0) return [];
  const dias = rangoDias(snapshots.map((s) => s.dia));
  const porCentro = indexarPorCentro(snapshots);
  return dias.map((dia) => {
    const snapsDelDia: SnapshotOcupacion[] = [];
    for (const c of centros) {
      const arr = porCentro.get(c.id);
      if (!arr) continue;
      const ult = ultimoHasta(arr, dia);
      if (ult) snapsDelDia.push(ult);
    }
    const tot = sumarSnapshots(snapsDelDia);
    return { dia, ...tot };
  });
}

/**
 * Serie diaria de UN centro con carry-forward (último snapshot conocido).
 * Devuelve array de `{ dia, total, familias, personal }` ordenado por dia.
 */
export function serieDiariaOcupacionCentro(
  centroId: string,
  snapshots: SnapshotOcupacion[],
): PuntoSerie[] {
  const delCentro = snapshots
    .filter((s) => s.centro_id === centroId)
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.ts - b.ts));
  if (delCentro.length === 0) return [];
  const dias = rangoDias(delCentro.map((s) => s.dia));
  return dias.map((dia) => {
    const ult = ultimoHasta(delCentro, dia);
    return {
      dia,
      total: ult?.total_afectados ?? 0,
      familias: ult?.familias ?? 0,
      personal: ult?.personal_total ?? 0,
    };
  });
}

/** Últimos N días calendario terminando en `hoyClave` (YYYY-MM-DD). */
export function ultimosDiasSerie(
  cantidad: VentanaSeriePoblacion | number,
  hoyClave: string,
): string[] {
  const [hy, hm, hd] = hoyClave.split("-").map(Number);
  const fin = new Date(hy, hm - 1, hd);
  const out: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(fin);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

/**
 * Serie agregada de la red para una ventana fija de N días terminando en
 * `diaCorte`, con carry-forward por campamento.
 */
export function serieOcupacionRedVentana(
  snapshots: SnapshotOcupacion[],
  centros: CentroParaAgregado[],
  ventana: number,
  diaCorte: string,
): PuntoSerie[] {
  const dias = ultimosDiasSerie(ventana, diaCorte);
  const porCentro = indexarPorCentro(snapshots);
  return dias.map((dia) => {
    const snapsDelDia: SnapshotOcupacion[] = [];
    for (const c of centros) {
      const arr = porCentro.get(c.id);
      if (!arr) continue;
      const ult = ultimoHasta(arr, dia);
      if (ult) snapsDelDia.push(ult);
    }
    const tot = sumarSnapshots(snapsDelDia);
    return { dia, ...tot };
  });
}

/**
 * Serie diaria de población (damnificados, familias y mascotas) con carry-forward,
 * para la ventana de N días. El personal operativo vive en Coordinación.
 */
export function seriePoblacionCentroVentana(
  centroId: string,
  snapshots: SnapshotOcupacion[],
  ventana: VentanaSeriePoblacion,
  hoyClave: string,
): PuntoSeriePoblacion[] {
  const delCentro = snapshots
    .filter((s) => s.centro_id === centroId)
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.ts - b.ts));
  const dias = ultimosDiasSerie(ventana, hoyClave);
  return dias.map((dia) => {
    const ult = ultimoHasta(delCentro, dia);
    const vuln = normalizarVulnerables(ult?.ocupacion);
    return {
      dia,
      refugiados: ult?.total_afectados ?? 0,
      familias: ult?.familias ?? 0,
      mascotas: vuln.mascotas,
    };
  });
}

/**
 * Serie diaria agregada por grupo (Área Metropolitana vs Gran Caracas).
 * Devuelve `{ dia, areaMetropolitana, granCaracas }` ordenado por dia.
 */
export function serieDiariaPorGrupo(
  snapshots: SnapshotOcupacion[],
  centros: CentroParaAgregado[],
): PuntoSeriePorGrupo[] {
  if (snapshots.length === 0) return [];
  const dias = rangoDias(snapshots.map((s) => s.dia));
  const porCentro = indexarPorCentro(snapshots);
  const grupoDe = new Map(centros.map((c) => [c.id, c.grupo]));
  return dias.map((dia) => {
    let areaMetropolitana = 0;
    let granCaracas = 0;
    for (const [centroId, arr] of porCentro) {
      const ult = ultimoHasta(arr, dia);
      if (!ult) continue;
      const g = grupoDe.get(centroId);
      const val = ult.total_afectados ?? 0;
      if (g === GRUPO_GRAN_CARACAS) granCaracas += val;
      else if (g === GRUPO_AREA_METROPOLITANA) areaMetropolitana += val;
      // Si un centro tiene grupo desconocido, se agrupa en Área Metropolitana
      // (default razonable para no perder el dato).
      else areaMetropolitana += val;
    }
    return { dia, areaMetropolitana, granCaracas };
  });
}

/**
 * Variación (entradas/salidas netas) del último día respecto al anterior.
 * Recibe la serie ya construida (de un centro o de la red). Devuelve null si
 * la serie tiene menos de 2 puntos.
 */
export function variacionUltimoDia(
  serie: PuntoSerie[],
): { total: number; familias: number } | null {
  if (serie.length < 2) return null;
  const penultimo = serie[serie.length - 2];
  const ultimo = serie[serie.length - 1];
  return {
    total: ultimo.total - penultimo.total,
    familias: ultimo.familias - penultimo.familias,
  };
}
