// Dominio del reporte diario por centro (tabla `reportes_centros`).
//
// Cada centro reporta una vez al día (una fila por centro por día, la última
// edición gana, igual que `ocupaciones_centros`): las **comidas** recibidas en
// cada jornada (desayuno/almuerzo/cena, con raciones, hora de llegada y
// proveedor) y las **atenciones médicas** del día. El parte numérico
// (refugiados/familias/personal) NO vive aquí: lo escribe `guardarCentro()`
// como snapshot en `ocupaciones_centros`, así los gráficos existentes siguen
// valiendo.

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
