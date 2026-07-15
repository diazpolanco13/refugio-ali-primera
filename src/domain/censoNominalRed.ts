// Dominio del tablero red de censo nominal: progreso vs parte por campamento.

import type { ProgresoCenso } from "@/domain/refugiados";
import type { EstadoContrasteCenso } from "@/domain/censoResumen";

export type EstadoCensoNominalRed =
  | "sin_iniciar"
  | "en_curso"
  | "meta_alcanzada"
  | "discrepancia";

export interface ResumenCensoNominalCentro {
  centroId: string;
  centroNombre: string;
  nro: number | null;
  /** Complejo operativo (p. ej. gran-colombia); varios edificios = 1 en totales de red. */
  complejoId?: string | null;
  /** Etiqueta corta de unidad interna SEBIN (DIR. REG, DAI, …). Vacío si sin asignar. */
  unidadSebin: string;
  registrados: number;
  familias: number;
  metaRefugiados: number;
  metaFamilias: number;
  pctRefugiados: number;
  pctFamilias: number;
  parteDia: string | null;
  ultimoRegistroTs: number;
  contraste: EstadoContrasteCenso;
  embarazadas: number;
  discapacidad: number;
  adultosMayores: number;
  conEnfermedad: number;
  mujeres: number;
  hombres: number;
  menores: number;
}

export function contrasteDesdeProgreso(
  progreso: ProgresoCenso,
): EstadoContrasteCenso {
  const meta = progreso.metaRefugiados;
  const actual = progreso.registradosRefugiados;
  if (meta <= 0) return actual > 0 ? "en_progreso" : "sin_parte";
  if (actual <= 0) return "sin_censo";
  if (actual > meta) return "excede_parte";
  if (actual === meta) return "cuadra";
  return "en_progreso";
}

export function estadoCensoNominalRed(
  r: ResumenCensoNominalCentro,
): EstadoCensoNominalRed {
  if (r.contraste === "excede_parte") return "discrepancia";
  if (r.contraste === "cuadra") return "meta_alcanzada";
  if (r.registrados <= 0) return "sin_iniciar";
  return "en_curso";
}

export function deltaParteNominal(r: ResumenCensoNominalCentro): number {
  if (r.metaRefugiados <= 0) return 0;
  return Math.abs(r.registrados - r.metaRefugiados);
}
