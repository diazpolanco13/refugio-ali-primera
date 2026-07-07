// Seguimiento vivo de requerimientos (tabla `requerimientos_seguimiento`).

export type CategoriaRequerimientoSeguimiento =
  | "dormitorio"
  | "electrodomesticos"
  | "cocina"
  | "seguridad_salud"
  | "saneamiento"
  | "otro";

export type EstatusRequerimientoSeguimiento =
  | "solicitado"
  | "en_gestion"
  | "parcial"
  | "entregado"
  | "archivado";

export const CATEGORIAS_REQUERIMIENTO: {
  valor: CategoriaRequerimientoSeguimiento;
  label: string;
}[] = [
  { valor: "dormitorio", label: "Dormitorio" },
  { valor: "electrodomesticos", label: "Electrodomésticos" },
  { valor: "cocina", label: "Cocina" },
  { valor: "seguridad_salud", label: "Seguridad / salud" },
  { valor: "saneamiento", label: "Saneamiento" },
  { valor: "otro", label: "Otro" },
];

export const ESTATUS_REQUERIMIENTO: {
  valor: EstatusRequerimientoSeguimiento;
  label: string;
  color: string;
}[] = [
  { valor: "solicitado", label: "Solicitado", color: "#ef4444" },
  { valor: "en_gestion", label: "En gestión", color: "#f59e0b" },
  { valor: "parcial", label: "Parcial", color: "#38bdf8" },
  { valor: "entregado", label: "Entregado", color: "#22c55e" },
  { valor: "archivado", label: "Archivado", color: "#64748b" },
];

export const META_ESTATUS_REQUERIMIENTO: Record<
  EstatusRequerimientoSeguimiento,
  (typeof ESTATUS_REQUERIMIENTO)[number]
> = Object.fromEntries(ESTATUS_REQUERIMIENTO.map((e) => [e.valor, e])) as Record<
  EstatusRequerimientoSeguimiento,
  (typeof ESTATUS_REQUERIMIENTO)[number]
>;

export interface RequerimientoSeguimiento {
  id: string;
  centro_id: string;
  concepto: string;
  cantidad: number;
  categoria: CategoriaRequerimientoSeguimiento;
  notas: string;
  estatus: EstatusRequerimientoSeguimiento;
  /** YYYY-MM-DD */
  reportado_dia: string;
  archivada_ts: number | null;
  creada_ts: number;
  resuelta_ts: number | null;
  updated_at: number;
  updated_by: string;
}

export function normalizarCategoriaRequerimiento(
  raw: string | undefined | null,
): CategoriaRequerimientoSeguimiento {
  const validas = CATEGORIAS_REQUERIMIENTO.map((c) => c.valor);
  if (validas.includes(raw as CategoriaRequerimientoSeguimiento)) {
    return raw as CategoriaRequerimientoSeguimiento;
  }
  return "otro";
}

export function normalizarEstatusRequerimiento(
  raw: string | undefined | null,
): EstatusRequerimientoSeguimiento {
  const validos = ESTATUS_REQUERIMIENTO.map((e) => e.valor);
  if (validos.includes(raw as EstatusRequerimientoSeguimiento)) {
    return raw as EstatusRequerimientoSeguimiento;
  }
  return "solicitado";
}

export function normalizarRequerimientoSeguimiento(
  raw: Partial<RequerimientoSeguimiento> & { id: string; centro_id: string },
): RequerimientoSeguimiento {
  return {
    id: raw.id,
    centro_id: raw.centro_id,
    concepto: raw.concepto ?? "",
    cantidad: Number.isFinite(raw.cantidad) ? Math.max(0, Math.floor(raw.cantidad!)) : 0,
    categoria: normalizarCategoriaRequerimiento(raw.categoria),
    notas: raw.notas ?? "",
    estatus: normalizarEstatusRequerimiento(raw.estatus),
    reportado_dia: raw.reportado_dia ?? "",
    archivada_ts: raw.archivada_ts != null ? Number(raw.archivada_ts) : null,
    creada_ts: Number(raw.creada_ts) || 0,
    resuelta_ts: raw.resuelta_ts != null ? Number(raw.resuelta_ts) : null,
    updated_at: Number(raw.updated_at) || 0,
    updated_by: raw.updated_by ?? "",
  };
}

export function requerimientosActivos(items: RequerimientoSeguimiento[]): RequerimientoSeguimiento[] {
  return items.filter((r) => r.estatus !== "archivado");
}

export function puedeArchivarRequerimiento(estatus: EstatusRequerimientoSeguimiento): boolean {
  return estatus === "entregado";
}

export { diasAbierto } from "./antiguedadSeguimiento";
