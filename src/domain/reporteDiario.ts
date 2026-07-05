// Dominio del reporte diario por centro (tabla `reportes_centros`).
//
// Cada centro reporta una vez al día (una fila por centro por día, la última
// edición gana, igual que `ocupaciones_centros`): las **comidas** recibidas en
// cada jornada (desayuno/almuerzo/cena, con raciones, hora de llegada y
// proveedor) y las **atenciones médicas** del día. El parte numérico
// (refugiados/familias/personal) NO vive aquí: lo escribe `guardarCentro()`
// como snapshot en `ocupaciones_centros`, así los gráficos existentes siguen
// valiendo.

import type { SnapshotOcupacion } from "./serieOcupacionCentros";
import { normalizarVulnerables } from "./tipos";

/** Jornadas fijas del reporte diario (subconjunto de `Jornada` de tipos.ts). */
export type JornadaReporte = "desayuno" | "almuerzo" | "cena";

export const CATALOGO_JORNADAS_REPORTE: {
  valor: JornadaReporte;
  label: string;
  icono: string;
}[] = [
  { valor: "desayuno", label: "Desayuno", icono: "🌅" },
  { valor: "almuerzo", label: "Almuerzo", icono: "🍽️" },
  { valor: "cena", label: "Cena", icono: "🌙" },
];

export const JORNADAS_REPORTE: JornadaReporte[] = CATALOGO_JORNADAS_REPORTE.map(
  (j) => j.valor,
);

/**
 * Registro de una comida recibida en una jornada. `hora_llegada` es timestamp
 * (ms) o null si aún no llega / no se registró la hora.
 */
export interface ComidaJornada {
  raciones: number;
  hora_llegada: number | null;
  proveedor: string;
  observacion: string;
}

/** Comidas del día indexadas por jornada. */
export type ComidasDia = Record<JornadaReporte, ComidaJornada>;

/**
 * Reporte diario de un centro (fila de `reportes_centros`). El `id` lo genera
 * Postgres (uuid); la clave lógica es `(centro_id, dia)`.
 */
export interface ReporteDiario {
  id?: string;
  centro_id: string;
  /** YYYY-MM-DD */
  dia: string;
  comidas: ComidasDia;
  /** Número de atenciones médicas del día. */
  atenciones_medicas: number;
  observaciones: string;
  updated_at: number;
  updated_by: string;
}

/** Comida sin reportar (valores vacíos), útil como estado inicial de formularios. */
export const COMIDA_VACIA: ComidaJornada = {
  raciones: 0,
  hora_llegada: null,
  proveedor: "",
  observacion: "",
};

/**
 * Normaliza el registro de una comida. Defensiva: tolera `undefined`/null y
 * campos faltantes (filas viejas o parciales) rellenando con valores vacíos.
 */
export function normalizarComidaJornada(
  raw: Partial<ComidaJornada> | undefined | null,
): ComidaJornada {
  return {
    raciones: raw?.raciones ?? 0,
    hora_llegada: raw?.hora_llegada ?? null,
    proveedor: raw?.proveedor ?? "",
    observacion: raw?.observacion ?? "",
  };
}

/** Normaliza el blob `comidas` completo (las tres jornadas siempre presentes). */
export function normalizarComidas(
  raw: Partial<Record<JornadaReporte, Partial<ComidaJornada>>> | undefined | null,
): ComidasDia {
  return {
    desayuno: normalizarComidaJornada(raw?.desayuno),
    almuerzo: normalizarComidaJornada(raw?.almuerzo),
    cena: normalizarComidaJornada(raw?.cena),
  };
}

/**
 * Normaliza una fila de `reportes_centros` al tipo de dominio. Tolera filas
 * incompletas (p. ej. `comidas` null o jornadas faltantes).
 */
export function normalizarReporte(
  raw: (Partial<ReporteDiario> & { centro_id: string; dia: string }) | ReporteDiario,
): ReporteDiario {
  return {
    id: raw.id,
    centro_id: raw.centro_id,
    dia: raw.dia,
    comidas: normalizarComidas(raw.comidas),
    atenciones_medicas: raw.atenciones_medicas ?? 0,
    observaciones: raw.observaciones ?? "",
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

/** ¿La jornada tiene algo reportado (raciones, hora o proveedor)? */
export function jornadaReportada(comida: ComidaJornada | undefined | null): boolean {
  const c = normalizarComidaJornada(comida);
  return c.raciones > 0 || c.hora_llegada !== null || c.proveedor.trim() !== "";
}

/** Jornadas del reporte que ya tienen datos (en orden desayuno→cena). */
export function jornadasReportadas(reporte: ReporteDiario | undefined | null): JornadaReporte[] {
  if (!reporte) return [];
  const comidas = normalizarComidas(reporte.comidas);
  return JORNADAS_REPORTE.filter((j) => jornadaReportada(comidas[j]));
}

/** ¿El reporte del día está completo (las tres comidas reportadas)? */
export function reporteCompleto(reporte: ReporteDiario | undefined | null): boolean {
  return jornadasReportadas(reporte).length === JORNADAS_REPORTE.length;
}

/** Total de raciones reportadas en el día (suma de las tres jornadas). */
export function racionesDelDia(reporte: ReporteDiario | undefined | null): number {
  if (!reporte) return 0;
  const comidas = normalizarComidas(reporte.comidas);
  return JORNADAS_REPORTE.reduce((acc, j) => acc + comidas[j].raciones, 0);
}

/** Busca el reporte de un centro para un día concreto (YYYY-MM-DD). */
export function reporteDelDia(
  reportes: ReporteDiario[],
  centroId: string,
  dia: string,
): ReporteDiario | undefined {
  return reportes.find((r) => r.centro_id === centroId && r.dia === dia);
}

/** Componentes de una clave YYYY-MM-DD. */
export function parsearDiaReporte(dia: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, diaNum] = dia.split("-").map(Number);
  return { anio, mes, dia: diaNum };
}

/** Estado agregado del reporte de un día (comidas + parte numérico). */
export type EstadoReporteDia = "completo" | "parcial" | "solo_parte" | "pendiente";

export const META_ESTADO_REPORTE: Record<
  EstadoReporteDia,
  { label: string; color: string }
> = {
  completo: { label: "Completo", color: "#22c55e" },
  parcial: { label: "Parcial", color: "#f59e0b" },
  solo_parte: { label: "Solo parte numérico", color: "#38bdf8" },
  pendiente: { label: "Sin reporte", color: "#64748b" },
};

/** Evalúa qué tan completo está el reporte de un día. */
export function estadoReporteDia(
  reporte: ReporteDiario | undefined | null,
  parteNumerico: boolean,
): EstadoReporteDia {
  const jornadas = jornadasReportadas(reporte).length;
  const comidasOk = reporteCompleto(reporte);
  if (comidasOk && parteNumerico) return "completo";
  if (comidasOk || (parteNumerico && jornadas > 0)) return "parcial";
  if (parteNumerico) return "solo_parte";
  if (jornadas > 0) return "parcial";
  return "pendiente";
}

/** Mapa día → estado (combina filas de reportes y días con parte numérico). */
export function estadosReportePorDia(
  reportes: ReporteDiario[],
  diasConParte: Set<string>,
): Map<string, EstadoReporteDia> {
  const map = new Map<string, EstadoReporteDia>();
  const dias = new Set<string>();
  for (const r of reportes) dias.add(r.dia);
  for (const d of diasConParte) dias.add(d);
  for (const dia of dias) {
    const reporte = reportes.find((r) => r.dia === dia);
    map.set(dia, estadoReporteDia(reporte, diasConParte.has(dia)));
  }
  return map;
}

/** Contadores por HOY, semana del mes y mes calendario. */
export function contadoresReportesPorPeriodo(
  reportes: ReporteDiario[],
  diasConParte: Set<string>,
  hoyClave: string,
): {
  hoyEstado: EstadoReporteDia;
  hoyRaciones: number;
  hoyAtenciones: number;
  semanaDelMes: number;
  semanaDiasActivos: number;
  mesDiasActivos: number;
  mesDiasCompletos: number;
  mesLabel: string;
  mesRaciones: number;
  mesAtenciones: number;
} {
  const { anio: hy, mes: hm, dia: hd } = parsearDiaReporte(hoyClave);
  const semanaDelMes = Math.ceil(hd / 7);
  const semInicio = (semanaDelMes - 1) * 7 + 1;
  const semFin = Math.min(semanaDelMes * 7, new Date(hy, hm, 0).getDate());
  const mesLabelRaw = new Date(hy, hm - 1, 1).toLocaleDateString("es-VE", { month: "long" });
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1);

  const reporteHoy = reportes.find((r) => r.dia === hoyClave);
  const hoyEstado = estadoReporteDia(reporteHoy, diasConParte.has(hoyClave));

  let semanaDiasActivos = 0;
  let mesDiasActivos = 0;
  let mesDiasCompletos = 0;
  let mesRaciones = 0;
  let mesAtenciones = 0;

  const estados = estadosReportePorDia(reportes, diasConParte);
  for (const [dia, estado] of estados) {
    const p = parsearDiaReporte(dia);
    if (p.anio !== hy || p.mes !== hm) continue;
    if (estado !== "pendiente") mesDiasActivos++;
    if (estado === "completo") mesDiasCompletos++;
    if (p.dia >= semInicio && p.dia <= semFin && estado !== "pendiente") semanaDiasActivos++;
  }

  for (const r of reportes) {
    const p = parsearDiaReporte(r.dia);
    if (p.anio === hy && p.mes === hm) {
      mesRaciones += racionesDelDia(r);
      mesAtenciones += r.atenciones_medicas;
    }
  }

  return {
    hoyEstado,
    hoyRaciones: racionesDelDia(reporteHoy),
    hoyAtenciones: reporteHoy?.atenciones_medicas ?? 0,
    semanaDelMes,
    semanaDiasActivos,
    mesDiasActivos,
    mesDiasCompletos,
    mesLabel,
    mesRaciones,
    mesAtenciones,
  };
}

/** Ventana temporal del gráfico de reportes (días). */
export type VentanaReporte = 7 | 15 | 30;

/** Punto diario para el gráfico de reportes del campamento. */
export interface PuntoSerieReporte {
  dia: string;
  refugiados: number;
  funcionarios: number;
  mascotas: number;
  atenciones: number;
  desayuno: number;
  almuerzo: number;
  cena: number;
  comidasTotal: number;
}

function claveDiaLocal(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Últimos N días calendario terminando en `hoyClave` (inclusive). */
export function ultimosDiasReporte(cantidad: number, hoyClave: string): string[] {
  const { anio, mes, dia } = parsearDiaReporte(hoyClave);
  const fin = new Date(anio, mes - 1, dia);
  const out: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(fin);
    d.setDate(d.getDate() - i);
    out.push(claveDiaLocal(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }
  return out;
}

function ultimoSnapshotHasta(
  snaps: SnapshotOcupacion[],
  diaActual: string,
): SnapshotOcupacion | undefined {
  const sorted = [...snaps].sort(
    (a, b) => a.dia.localeCompare(b.dia) || a.ts - b.ts,
  );
  let res: import("./serieOcupacionCentros").SnapshotOcupacion | undefined;
  for (const s of sorted) {
    if (s.dia <= diaActual) res = s;
    else break;
  }
  return res;
}

/**
 * Serie diaria para el gráfico de reportes: población (carry-forward desde
 * `ocupaciones_centros`) + comidas/atenciones (día exacto en `reportes_centros`).
 */
export function serieReporteCentro(
  centroId: string,
  snapshots: SnapshotOcupacion[],
  reportes: ReporteDiario[],
  ventana: VentanaReporte,
  hoyClave: string,
): PuntoSerieReporte[] {
  const delCentro = snapshots.filter((s) => s.centro_id === centroId);
  const reportesMap = new Map(
    reportes.filter((r) => r.centro_id === centroId).map((r) => [r.dia, r]),
  );
  const dias = ultimosDiasReporte(ventana, hoyClave);

  return dias.map((dia) => {
    const snap = ultimoSnapshotHasta(delCentro, dia);
    const vuln = normalizarVulnerables(snap?.ocupacion);
    const reporte = reportesMap.get(dia);
    const comidas = normalizarComidas(reporte?.comidas);
    return {
      dia,
      refugiados: snap?.total_afectados ?? 0,
      funcionarios: snap?.personal_total ?? 0,
      mascotas: vuln.mascotas,
      atenciones: reporte?.atenciones_medicas ?? 0,
      desayuno: comidas.desayuno.raciones,
      almuerzo: comidas.almuerzo.raciones,
      cena: comidas.cena.raciones,
      comidasTotal: racionesDelDia(reporte),
    };
  });
}
