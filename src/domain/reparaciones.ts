// Dominio de reparaciones por centro (tablas `reparaciones_centros` y
// `reportes_reparaciones_dia`).
//
// Cada reparación es un ítem persistente con título, descripción, estatus y
// fotos antes/después. Los flags diarios (`requiere_trabajos`, `se_trabajo_hoy`)
// viven en `reportes_reparaciones_dia` (una fila por centro/día).

/** Estatus de un trabajo/reparación en el campamento. */
export type EstatusReparacion = "dañado" | "en_reparacion" | "reparado";

export interface MetaEstatusReparacion {
  valor: EstatusReparacion;
  label: string;
  color: string;
  /** Orden de urgencia: menor = más pendiente. */
  orden: number;
}

export const ESTATUS_REPARACION: MetaEstatusReparacion[] = [
  { valor: "dañado", label: "Dañado", color: "#ef4444", orden: 0 },
  { valor: "en_reparacion", label: "En reparación", color: "#f59e0b", orden: 1 },
  { valor: "reparado", label: "Reparado", color: "#22c55e", orden: 2 },
];

export const META_ESTATUS: Record<EstatusReparacion, MetaEstatusReparacion> =
  Object.fromEntries(ESTATUS_REPARACION.map((e) => [e.valor, e])) as Record<
    EstatusReparacion,
    MetaEstatusReparacion
  >;

/** Tipo de foto de una reparación (antes o después del trabajo). */
export type TipoFotoReparacion = "antes" | "despues";

export interface FotoReparacion {
  url: string;
  tipo: TipoFotoReparacion;
  ts: number;
}

/** Ítem de trabajo/reparación persistente de un campamento. */
export interface Reparacion {
  id: string;
  centro_id: string;
  titulo: string;
  descripcion: string;
  estatus: EstatusReparacion;
  fotos: FotoReparacion[];
  creada_ts: number;
  creada_por: string;
  updated_at: number;
  updated_by: string;
  resuelta_ts: number | null;
  /** Área de infraestructura vinculada (opcional). */
  area_infraestructura_id: string | null;
}

/** Flags diarios del reporte de reparaciones (una fila por centro/día). */
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

/** Normaliza el estatus crudo a una clave válida. */
export function normalizarEstatus(raw: string | undefined | null): EstatusReparacion {
  if (raw === "dañado" || raw === "en_reparacion" || raw === "reparado") return raw;
  return "dañado";
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

/** Convierte una fila cruda de Supabase al tipo de dominio. */
export function normalizarReparacion(raw: Partial<Reparacion> & { id: string }): Reparacion {
  return {
    id: raw.id,
    centro_id: raw.centro_id ?? "",
    titulo: raw.titulo ?? "",
    descripcion: raw.descripcion ?? "",
    estatus: normalizarEstatus(raw.estatus),
    fotos: normalizarFotos(raw.fotos),
    creada_ts: Number(raw.creada_ts) || 0,
    creada_por: raw.creada_por ?? "",
    updated_at: Number(raw.updated_at) || 0,
    updated_by: raw.updated_by ?? "",
    resuelta_ts: raw.resuelta_ts != null ? Number(raw.resuelta_ts) : null,
    area_infraestructura_id: raw.area_infraestructura_id ?? null,
  };
}

/** Convierte una fila cruda de reportes_reparaciones_dia al tipo de dominio. */
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

/** Reparaciones que aún no están resueltas (estatus ≠ reparado). */
export function reparacionesPendientes(reparaciones: Reparacion[]): Reparacion[] {
  return reparaciones.filter((r) => r.estatus !== "reparado");
}

/** ¿El campamento tiene al menos una reparación pendiente? */
export function centroRequiereReparaciones(reparaciones: Reparacion[]): boolean {
  return reparacionesPendientes(reparaciones).length > 0;
}

/** Cuenta reparaciones por estatus. */
export function contarPorEstatus(reparaciones: Reparacion[]): Record<EstatusReparacion, number> {
  const counts: Record<EstatusReparacion, number> = {
    dañado: 0,
    en_reparacion: 0,
    reparado: 0,
  };
  for (const r of reparaciones) counts[r.estatus]++;
  return counts;
}

/** Busca el reporte diario de reparaciones de un centro en un día. */
export function reporteReparacionesDelDia(
  reportes: ReporteReparacionesDia[],
  centroId: string,
  dia: string,
): ReporteReparacionesDia | undefined {
  return reportes.find((r) => r.centro_id === centroId && r.dia === dia);
}
