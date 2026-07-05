// Dominio de áreas de infraestructura por campamento (tabla
// `areas_infraestructura_centros`). Catálogo de áreas físicas con fotos
// iniciales y estatus de atención; las fotos "después" vienen de reparaciones
// vinculadas.

import type { FotoReparacion, Reparacion } from "./reparaciones";

/** Estatus de atención de un área de infraestructura. */
export type EstadoInfraestructura = "requiere_mejora" | "en_proceso" | "mejorado";

export interface MetaEstadoInfraestructura {
  valor: EstadoInfraestructura;
  label: string;
  color: string;
  orden: number;
}

export const ESTADOS_INFRAESTRUCTURA: MetaEstadoInfraestructura[] = [
  { valor: "requiere_mejora", label: "Requiere mejora", color: "#ef4444", orden: 0 },
  { valor: "en_proceso", label: "En proceso", color: "#f59e0b", orden: 1 },
  { valor: "mejorado", label: "Mejorado", color: "#22c55e", orden: 2 },
];

export const META_ESTADO: Record<EstadoInfraestructura, MetaEstadoInfraestructura> =
  Object.fromEntries(ESTADOS_INFRAESTRUCTURA.map((e) => [e.valor, e])) as Record<
    EstadoInfraestructura,
    MetaEstadoInfraestructura
  >;

/** Máximo de fotos iniciales por área. */
export const MAX_FOTOS_INICIALES = 3;

export interface FotoInfraestructura {
  url: string;
  ts: number;
}

/** Área física de un campamento registrada en infraestructura. */
export interface AreaInfraestructura {
  id: string;
  centro_id: string;
  nombre: string;
  descripcion_inicial: string;
  fotos_iniciales: FotoInfraestructura[];
  estado: EstadoInfraestructura;
  creada_ts: number;
  creada_por: string;
  updated_at: number;
  updated_by: string;
  mejorada_ts: number | null;
}

/** Normaliza el estado crudo a una clave válida. */
export function normalizarEstado(raw: string | undefined | null): EstadoInfraestructura {
  if (raw === "requiere_mejora" || raw === "en_proceso" || raw === "mejorado") return raw;
  return "requiere_mejora";
}

/** Normaliza el array de fotos iniciales desde jsonb. */
export function normalizarFotosIniciales(raw: unknown): FotoInfraestructura[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
    .map((f) => ({
      url: String(f.url ?? ""),
      ts: Number(f.ts) || 0,
    }))
    .filter((f) => f.url.length > 0)
    .slice(0, MAX_FOTOS_INICIALES);
}

/** Convierte una fila cruda de Supabase al tipo de dominio. */
export function normalizarAreaInfraestructura(
  raw: Partial<AreaInfraestructura> & { id: string },
): AreaInfraestructura {
  return {
    id: raw.id,
    centro_id: raw.centro_id ?? "",
    nombre: raw.nombre ?? "",
    descripcion_inicial: raw.descripcion_inicial ?? "",
    fotos_iniciales: normalizarFotosIniciales(raw.fotos_iniciales),
    estado: normalizarEstado(raw.estado),
    creada_ts: Number(raw.creada_ts) || 0,
    creada_por: raw.creada_por ?? "",
    updated_at: Number(raw.updated_at) || 0,
    updated_by: raw.updated_by ?? "",
    mejorada_ts: raw.mejorada_ts != null ? Number(raw.mejorada_ts) : null,
  };
}

/** Reparaciones vinculadas a un área. */
export function reparacionesDeArea(areaId: string, reparaciones: Reparacion[]): Reparacion[] {
  return reparaciones
    .filter((r) => r.area_infraestructura_id === areaId)
    .sort((a, b) => b.creada_ts - a.creada_ts);
}

/** Últimas fotos "después" de reparaciones vinculadas al área (más recientes primero). */
export function fotosDespuesArea(
  area: AreaInfraestructura,
  reparacionesVinculadas: Reparacion[],
): FotoReparacion[] {
  void area;
  const fotos: FotoReparacion[] = [];
  for (const rep of reparacionesVinculadas) {
    for (const f of rep.fotos) {
      if (f.tipo === "despues") fotos.push(f);
    }
  }
  return fotos.sort((a, b) => b.ts - a.ts);
}

/** Sugiere un estado según las reparaciones vinculadas (no obligatorio). */
export function sugerirEstadoArea(
  area: AreaInfraestructura,
  reparacionesVinculadas: Reparacion[],
): EstadoInfraestructura | null {
  void area;
  if (reparacionesVinculadas.length === 0) return null;
  const pendientes = reparacionesVinculadas.filter((r) => r.estatus !== "reparado");
  if (pendientes.some((r) => r.estatus === "en_reparacion" || r.estatus === "dañado")) {
    return "en_proceso";
  }
  if (reparacionesVinculadas.every((r) => r.estatus === "reparado")) {
    return "mejorado";
  }
  return null;
}

/** Cuenta áreas por estado. */
export function contarPorEstado(
  areas: AreaInfraestructura[],
): Record<EstadoInfraestructura, number> {
  const counts: Record<EstadoInfraestructura, number> = {
    requiere_mejora: 0,
    en_proceso: 0,
    mejorado: 0,
  };
  for (const a of areas) counts[a.estado]++;
  return counts;
}

/** Días transcurridos entre dos timestamps (mínimo 0). */
export function diasTranscurridos(desde: number, hasta: number): number {
  if (!desde || !hasta) return 0;
  return Math.max(0, Math.floor((hasta - desde) / 86_400_000));
}
