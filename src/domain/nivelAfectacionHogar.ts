// Nivel de afectación de un hogar: calculado a partir de la severidad de la
// vivienda y el conteo de pérdidas familiares, nunca preguntado directamente.

import type { EstatusVivienda } from "./refugiados";

export type NivelAfectacion = "critico" | "atencion" | "estable" | "sin_verificar";

export interface MetaNivelAfectacion {
  valor: NivelAfectacion;
  label: string;
  color: string;
  emoji: string;
}

export const NIVELES_AFECTACION: MetaNivelAfectacion[] = [
  { valor: "critico", label: "Crítico", color: "#ef4444", emoji: "🔴" },
  { valor: "atencion", label: "Requiere atención", color: "#eab308", emoji: "🟡" },
  { valor: "estable", label: "Estable", color: "#22c55e", emoji: "🟢" },
  { valor: "sin_verificar", label: "Sin verificar", color: "#94a3b8", emoji: "⚪" },
];

export const META_NIVEL_AFECTACION: Record<NivelAfectacion, MetaNivelAfectacion> =
  Object.fromEntries(NIVELES_AFECTACION.map((n) => [n.valor, n])) as Record<
    NivelAfectacion,
    MetaNivelAfectacion
  >;

const SEVERIDAD_CRITICA: EstatusVivienda[] = ["destruida", "inabitable"];
const SEVERIDAD_ATENCION: EstatusVivienda[] = ["parcial_habitable", "habitable_con_riesgo"];

/**
 * Deriva el nivel de afectación de un hogar sin preguntarlo: cualquier
 * fallecido o desaparecido es crítico sin importar la vivienda; si no hay
 * pérdidas, manda la severidad de la vivienda.
 */
export function nivelAfectacionHogar(
  estatusVivienda: EstatusVivienda,
  fallecidosConfirmados: number,
  desaparecidos: number,
): NivelAfectacion {
  if (fallecidosConfirmados > 0 || desaparecidos > 0) return "critico";
  if (SEVERIDAD_CRITICA.includes(estatusVivienda)) return "critico";
  if (SEVERIDAD_ATENCION.includes(estatusVivienda)) return "atencion";
  if (estatusVivienda === "sin_dano") return "estable";
  return "sin_verificar";
}
