import type { PuntoServicio, TipoPunto } from "./tipos";

// Cronómetro de limpieza/recolección para baños, duchas y basura.

export const MANTENIMIENTO_TIPOS: TipoPunto[] = ["sanitarios", "duchas", "residuos"];

export function esMantenimiento(tipo: TipoPunto): boolean {
  return MANTENIMIENTO_TIPOS.includes(tipo);
}

/** Frecuencia por defecto (horas) al crear un punto de mantenimiento. */
export function frecuenciaPorDefecto(tipo: TipoPunto): number {
  if (tipo === "residuos") return 12;
  return 8; // baños y duchas: ~3 veces al día
}

export type EstadoLimpieza = "ok" | "pronto" | "vencido" | "sin_programar";

export const COLOR_LIMPIEZA: Record<EstadoLimpieza, string> = {
  ok: "#22c55e",
  pronto: "#f59e0b",
  vencido: "#ef4444",
  sin_programar: "#94a3b8",
};

export interface InfoLimpieza {
  estado: EstadoLimpieza;
  color: string;
  /** ms desde la última limpieza (null si nunca). */
  desdeMs: number | null;
  /** ms hasta que vence (negativo = vencido; null si no aplica). */
  venceEnMs: number | null;
}

/** Estado del cronómetro de un punto. null si el tipo no es de mantenimiento. */
export function infoLimpieza(p: PuntoServicio, ahora: number): InfoLimpieza | null {
  if (!esMantenimiento(p.tipo)) return null;
  const horas = p.frecuenciaLimpiezaHoras ?? 0;
  const desdeMs = p.ultimaLimpieza != null ? ahora - p.ultimaLimpieza : null;

  if (!horas) {
    return { estado: "sin_programar", color: COLOR_LIMPIEZA.sin_programar, desdeMs, venceEnMs: null };
  }
  if (p.ultimaLimpieza == null) {
    // Programado pero nunca registrado: requiere limpieza.
    return { estado: "vencido", color: COLOR_LIMPIEZA.vencido, desdeMs: null, venceEnMs: 0 };
  }
  const dueMs = horas * 3_600_000;
  const venceEnMs = dueMs - (desdeMs as number);
  const ratio = (desdeMs as number) / dueMs;
  const estado: EstadoLimpieza = ratio >= 1 ? "vencido" : ratio >= 0.75 ? "pronto" : "ok";
  return { estado, color: COLOR_LIMPIEZA[estado], desdeMs, venceEnMs };
}

/** Formatea una duración en ms a texto corto: "2h 15m", "45m". */
export function formatoDuracion(ms: number): string {
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** Texto para la etiqueta del marcador. Ej: "🧹 vence en 45m" / "⛔ vencida hace 30m". */
export function textoLimpieza(p: PuntoServicio, ahora: number): string {
  const info = infoLimpieza(p, ahora);
  if (!info) return "";
  const accion = p.tipo === "residuos" ? "recolección" : "limpieza";
  if (info.estado === "sin_programar") return "";
  if (info.estado === "vencido") {
    if (info.venceEnMs == null || info.desdeMs == null) return `⛔ ${accion} pendiente`;
    return `⛔ ${accion} vencida hace ${formatoDuracion(info.venceEnMs)}`;
  }
  return `🧹 ${accion} en ${formatoDuracion(info.venceEnMs ?? 0)}`;
}
