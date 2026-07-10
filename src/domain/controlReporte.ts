// Control diario del reporte (tabla `reportes_control_dia`).

import type { RespuestaLevantamiento } from "./centrosTransitorios";

export interface ReporteControlDia {
  id?: string;
  centro_id: string;
  /** YYYY-MM-DD */
  dia: string;
  captahuella: RespuestaLevantamiento;
  captahuella_nota: string;
  juez_paz: RespuestaLevantamiento;
  juez_paz_nota: string;
  servicio_medico: RespuestaLevantamiento;
  servicio_medico_nota: string;
  ambulancia: RespuestaLevantamiento;
  ambulancia_nota: string;
  revisado: boolean;
  updated_at: number;
  updated_by: string;
}

export type CampoControlReporte =
  | "captahuella"
  | "juez_paz"
  | "servicio_medico"
  | "ambulancia";

export const CAMPOS_CONTROL_REPORTE: {
  clave: CampoControlReporte;
  nota: `${CampoControlReporte}_nota`;
  label: string;
}[] = [
  { clave: "captahuella", nota: "captahuella_nota", label: "Captahuella" },
  { clave: "juez_paz", nota: "juez_paz_nota", label: "Juez de paz" },
  { clave: "servicio_medico", nota: "servicio_medico_nota", label: "Servicio médico" },
  { clave: "ambulancia", nota: "ambulancia_nota", label: "Ambulancia" },
];

export const CONTROL_VACIO: Omit<ReporteControlDia, "centro_id" | "dia"> = {
  // Por defecto «No» (false). «En proceso» (null) es un estado explícito posterior.
  captahuella: false,
  captahuella_nota: "",
  juez_paz: false,
  juez_paz_nota: "",
  servicio_medico: false,
  servicio_medico_nota: "",
  ambulancia: false,
  ambulancia_nota: "",
  revisado: false,
  updated_at: 0,
  updated_by: "",
};

function normalizarRespuesta(raw: unknown): RespuestaLevantamiento {
  // Conserva true / false / null tal cual vienen de BD (null = «En proceso» ya elegido).
  if (raw === true || raw === false || raw === null) return raw;
  return false;
}

export function normalizarReporteControlDia(
  raw: Partial<ReporteControlDia> & { centro_id: string; dia: string },
): ReporteControlDia {
  return {
    id: raw.id,
    centro_id: raw.centro_id,
    dia: raw.dia,
    captahuella: normalizarRespuesta(raw.captahuella),
    captahuella_nota: raw.captahuella_nota ?? "",
    juez_paz: normalizarRespuesta(raw.juez_paz),
    juez_paz_nota: raw.juez_paz_nota ?? "",
    servicio_medico: normalizarRespuesta(raw.servicio_medico),
    servicio_medico_nota: raw.servicio_medico_nota ?? "",
    ambulancia: normalizarRespuesta(raw.ambulancia),
    ambulancia_nota: raw.ambulancia_nota ?? "",
    revisado: raw.revisado === true,
    updated_at: Number(raw.updated_at) || 0,
    updated_by: raw.updated_by ?? "",
  };
}

export function reporteControlDelDia(
  reportes: ReporteControlDia[],
  centroId: string,
  dia: string,
): ReporteControlDia | undefined {
  return reportes.find((r) => r.centro_id === centroId && r.dia === dia);
}

export function controlReportado(reporte: ReporteControlDia | undefined | null): boolean {
  return Boolean(reporte?.revisado);
}
