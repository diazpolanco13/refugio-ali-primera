// Dominio de trabajos/reparaciones por centro (tabla `reparaciones_centros`).
//
// Evolucionado al formato Telegram: estatus pendiente → en_progreso →
// completado → archivado, con finalidad y días abiertos.

/** Estatus de un trabajo en el campamento. */
export type EstatusTrabajo = "pendiente" | "en_progreso" | "completado" | "archivado";

/** @deprecated Usar EstatusTrabajo */
export type EstatusReparacion = EstatusTrabajo;

export interface MetaEstatusTrabajo {
  valor: EstatusTrabajo;
  label: string;
  color: string;
  orden: number;
}

export const ESTATUS_TRABAJO: MetaEstatusTrabajo[] = [
  { valor: "pendiente", label: "Pendiente", color: "#ef4444", orden: 0 },
  { valor: "en_progreso", label: "En progreso", color: "#f59e0b", orden: 1 },
  { valor: "completado", label: "Completado", color: "#22c55e", orden: 2 },
  { valor: "archivado", label: "Archivado", color: "#64748b", orden: 3 },
];

/** @deprecated Usar ESTATUS_TRABAJO */
export const ESTATUS_REPARACION = ESTATUS_TRABAJO;

export const META_ESTATUS_TRABAJO: Record<EstatusTrabajo, MetaEstatusTrabajo> =
  Object.fromEntries(ESTATUS_TRABAJO.map((e) => [e.valor, e])) as Record<
    EstatusTrabajo,
    MetaEstatusTrabajo
  >;

/** @deprecated Usar META_ESTATUS_TRABAJO */
export const META_ESTATUS = META_ESTATUS_TRABAJO;

/** Tipo de foto de un trabajo (antes o después). */
export type TipoFotoReparacion = "antes" | "despues";

export interface FotoReparacion {
  url: string;
  tipo: TipoFotoReparacion;
  ts: number;
}

/** Ítem de trabajo persistente de un campamento. */
export interface TrabajoCentro {
  id: string;
  centro_id: string;
  titulo: string;
  finalidad: string;
  descripcion: string;
  estatus: EstatusTrabajo;
  fotos: FotoReparacion[];
  /** YYYY-MM-DD */
  reportada_dia: string;
  creada_ts: number;
  creada_por: string;
  updated_at: number;
  updated_by: string;
  resuelta_ts: number | null;
  archivada_ts: number | null;
  area_infraestructura_id: string | null;
}

/** @deprecated Usar TrabajoCentro */
export type Reparacion = TrabajoCentro;

/** Flags diarios legacy (tabla `reportes_reparaciones_dia`). */
export interface ReporteReparacionesDia {
  id?: string;
  centro_id: string;
  dia: string;
  requiere_trabajos: boolean;
  se_trabajo_hoy: boolean;
  observaciones: string;
  updated_at?: number;
  updated_by?: string;
}

const MAPA_ESTATUS_LEGACY: Record<string, EstatusTrabajo> = {
  dañado: "pendiente",
  en_reparacion: "en_progreso",
  reparado: "completado",
  pendiente: "pendiente",
  en_progreso: "en_progreso",
  completado: "completado",
  archivado: "archivado",
};

/** Normaliza el estatus crudo a una clave válida (tolera valores legacy). */
export function normalizarEstatus(raw: string | undefined | null): EstatusTrabajo {
  if (raw && raw in MAPA_ESTATUS_LEGACY) return MAPA_ESTATUS_LEGACY[raw];
  return "pendiente";
}

/** Normaliza el array de fotos desde jsonb. */
export function normalizarFotos(raw: unknown): FotoReparacion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
    .map((f) => ({
      url: String(f.url ?? ""),
      tipo: (f.tipo === "despues" ? "despues" : "antes") as TipoFotoReparacion,
      ts: Number(f.ts) || 0,
    }))
    .filter((f) => f.url.length > 0);
}

function claveDesdeTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Convierte una fila cruda de Supabase al tipo de dominio. */
export function normalizarTrabajo(
  raw: Partial<TrabajoCentro> & { id: string },
): TrabajoCentro {
  const creadaTs = Number(raw.creada_ts) || 0;
  return {
    id: raw.id,
    centro_id: raw.centro_id ?? "",
    titulo: raw.titulo ?? "",
    finalidad: raw.finalidad ?? "",
    descripcion: raw.descripcion ?? "",
    estatus: normalizarEstatus(raw.estatus),
    fotos: normalizarFotos(raw.fotos),
    reportada_dia: raw.reportada_dia ?? (creadaTs ? claveDesdeTs(creadaTs) : ""),
    creada_ts: creadaTs,
    creada_por: raw.creada_por ?? "",
    updated_at: Number(raw.updated_at) || 0,
    updated_by: raw.updated_by ?? "",
    resuelta_ts: raw.resuelta_ts != null ? Number(raw.resuelta_ts) : null,
    archivada_ts: raw.archivada_ts != null ? Number(raw.archivada_ts) : null,
    area_infraestructura_id: raw.area_infraestructura_id ?? null,
  };
}

/** @deprecated Usar normalizarTrabajo */
export const normalizarReparacion = normalizarTrabajo;

export function normalizarReporteReparacionesDia(
  raw: Partial<ReporteReparacionesDia> & { centro_id: string; dia: string },
): ReporteReparacionesDia {
  return {
    id: raw.id,
    centro_id: raw.centro_id,
    dia: raw.dia,
    requiere_trabajos: Boolean(raw.requiere_trabajos),
    se_trabajo_hoy: Boolean(raw.se_trabajo_hoy),
    observaciones: raw.observaciones ?? "",
    updated_at: raw.updated_at,
    updated_by: raw.updated_by,
  };
}

/** Trabajos activos (no archivados). Incluye completados del día. */
export function trabajosActivos(trabajos: TrabajoCentro[]): TrabajoCentro[] {
  return trabajos.filter((t) => t.estatus !== "archivado");
}

/** Trabajos ya archivados (historial). */
export function trabajosArchivados(trabajos: TrabajoCentro[]): TrabajoCentro[] {
  return trabajos.filter((t) => t.estatus === "archivado");
}

/** Día YYYY-MM-DD en que se marcó completado (null si no aplica). */
export function diaResueltaTrabajo(t: TrabajoCentro): string | null {
  if (t.resuelta_ts == null || t.resuelta_ts <= 0) return null;
  return claveDesdeTs(t.resuelta_ts);
}

/**
 * Completado en un día anterior a `hoyClave` → debe pasar a archivados.
 * El día de cierre permanece en activos (parte / Telegram / PDF).
 */
export function debeAutoArchivarTrabajo(t: TrabajoCentro, hoyClave: string): boolean {
  if (t.estatus !== "completado") return false;
  const dia = diaResueltaTrabajo(t);
  if (!dia) return true;
  return dia < hoyClave;
}

/**
 * Ítems del parte de `diaClave`: vivos + archivados resueltos ese día
 * (el parte histórico sigue mostrando lo completado aunque ya se archivó).
 */
export function trabajosParaParteDelDia(
  trabajos: TrabajoCentro[],
  diaClave: string,
): TrabajoCentro[] {
  return trabajos.filter((t) => {
    if (t.estatus !== "archivado") return true;
    return diaResueltaTrabajo(t) === diaClave;
  });
}

/** @deprecated Usar trabajosActivos */
export function reparacionesPendientes(trabajos: TrabajoCentro[]): TrabajoCentro[] {
  return trabajos.filter((t) => t.estatus !== "completado" && t.estatus !== "archivado");
}

/** ¿El campamento tiene al menos un trabajo activo pendiente? */
export function centroRequiereReparaciones(trabajos: TrabajoCentro[]): boolean {
  return trabajosActivos(trabajos).some(
    (t) => t.estatus === "pendiente" || t.estatus === "en_progreso",
  );
}

export function contarPorEstatus(trabajos: TrabajoCentro[]): Record<EstatusTrabajo, number> {
  const counts: Record<EstatusTrabajo, number> = {
    pendiente: 0,
    en_progreso: 0,
    completado: 0,
    archivado: 0,
  };
  for (const t of trabajos) counts[t.estatus]++;
  return counts;
}

export function reporteReparacionesDelDia(
  reportes: ReporteReparacionesDia[],
  centroId: string,
  dia: string,
): ReporteReparacionesDia | undefined {
  return reportes.find((r) => r.centro_id === centroId && r.dia === dia);
}

export function puedeArchivarTrabajo(estatus: EstatusTrabajo): boolean {
  return estatus === "completado";
}

export { diasAbierto } from "./antiguedadSeguimiento";
