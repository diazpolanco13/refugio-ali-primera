import type { EstadoCensoCentro } from "@/domain/censoResumen";

const CLAVE_FILTROS = "refugio-censo-red-filtros";

export type FiltroEstadoCensoRed = "todos" | EstadoCensoCentro;
export type OrdenCensoRed = "nombre" | "registrados" | "actividad" | "discrepancia";

export interface FiltrosCensoRed {
  busqueda: string;
  estado: FiltroEstadoCensoRed;
  orden: OrdenCensoRed;
}

/** Valores por defecto: censos en curso mientras el levantamiento siga activo. */
export const FILTROS_CENSO_RED_DEFAULT: FiltrosCensoRed = {
  busqueda: "",
  estado: "en_curso",
  orden: "nombre",
};

function esFiltroEstado(v: string): v is FiltroEstadoCensoRed {
  return (
    v === "todos" ||
    v === "sin_iniciar" ||
    v === "en_curso" ||
    v === "completado_declarado" ||
    v === "sin_ocupantes"
  );
}

function esOrden(v: string): v is OrdenCensoRed {
  return v === "nombre" || v === "registrados" || v === "actividad" || v === "discrepancia";
}

export function cargarFiltrosCensoRed(): FiltrosCensoRed {
  try {
    const raw = localStorage.getItem(CLAVE_FILTROS);
    if (!raw) return { ...FILTROS_CENSO_RED_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<FiltrosCensoRed>;
    return {
      busqueda: typeof parsed.busqueda === "string" ? parsed.busqueda : FILTROS_CENSO_RED_DEFAULT.busqueda,
      estado:
        typeof parsed.estado === "string" && esFiltroEstado(parsed.estado)
          ? parsed.estado
          : FILTROS_CENSO_RED_DEFAULT.estado,
      orden:
        typeof parsed.orden === "string" && esOrden(parsed.orden)
          ? parsed.orden
          : FILTROS_CENSO_RED_DEFAULT.orden,
    };
  } catch {
    return { ...FILTROS_CENSO_RED_DEFAULT };
  }
}

export function guardarFiltrosCensoRed(filtros: FiltrosCensoRed): void {
  try {
    localStorage.setItem(CLAVE_FILTROS, JSON.stringify(filtros));
  } catch {
    // localStorage lleno o bloqueado — ignorar
  }
}

export function filtrosCensoRedDistintosDeDefault(filtros: FiltrosCensoRed): boolean {
  return (
    filtros.busqueda.trim() !== FILTROS_CENSO_RED_DEFAULT.busqueda ||
    filtros.estado !== FILTROS_CENSO_RED_DEFAULT.estado ||
    filtros.orden !== FILTROS_CENSO_RED_DEFAULT.orden
  );
}
