// Lógica pura del team de salubridad y aseo. Cruza los puntos de mantenimiento
// del mapa (baños, duchas, basura) con la bitácora de limpiezas (`limpiezas`)
// para calcular el cumplimiento diario (veces limpiado hoy vs. meta) y el
// estado del cronómetro. Lo consumen el panel de aseo y el dashboard.

import { esMantenimiento, infoLimpieza, type InfoLimpieza } from "./limpieza";
import type { PuntoServicio, RegistroLimpieza } from "./tipos";

/**
 * Meta de limpiezas por día de un punto. Se deriva de la frecuencia programada
 * (~24 / horas), con un mínimo de 2 (letrinas: mín. 2 veces al día). Si no hay
 * frecuencia programada, cae al default de 2.
 */
export function metaLimpiezasDia(punto: PuntoServicio): number {
  const horas = punto.frecuenciaLimpiezaHoras ?? 0;
  if (horas > 0) return Math.max(2, Math.round(24 / horas));
  return 2;
}

export interface ResumenPuntoLimpieza {
  punto: PuntoServicio;
  /** Estado del cronómetro (color, vencimiento). null si no es mantenimiento. */
  info: InfoLimpieza | null;
  /** Veces marcado limpio hoy. */
  vecesHoy: number;
  /** Meta de veces/día. */
  meta: number;
  /** ¿Alcanzó la meta del día? */
  cumpleMeta: boolean;
  /** Timestamp (ms) de la última limpieza registrada, o null. */
  ultima: number | null;
  /** Usuario que hizo la última limpieza, o null. */
  ultimaPor: string | null;
}

export interface ResumenSalubridad {
  puntos: ResumenPuntoLimpieza[];
  /** Total de puntos de mantenimiento. */
  total: number;
  /** Puntos con limpieza vencida (según cronómetro). */
  vencidos: number;
  /** Puntos que aún no alcanzan la meta del día. */
  pendientesMeta: number;
}

/**
 * Construye el resumen de salubridad del día indicado: por cada punto de
 * mantenimiento, cuántas veces se limpió hoy, la meta, y la última limpieza
 * (quién y cuándo). Recorre la bitácora una sola vez.
 */
export function resumenSalubridad(
  dia: string,
  puntos: PuntoServicio[],
  registros: RegistroLimpieza[],
  ahora: number = Date.now(),
): ResumenSalubridad {
  const vecesHoy = new Map<string, number>();
  const ultima = new Map<string, RegistroLimpieza>();

  for (const r of registros) {
    if (r.dia === dia) {
      vecesHoy.set(r.punto_id, (vecesHoy.get(r.punto_id) ?? 0) + 1);
    }
    const prev = ultima.get(r.punto_id);
    if (!prev || r.ts > prev.ts) ultima.set(r.punto_id, r);
  }

  const mantenimiento = puntos.filter((p) => esMantenimiento(p.tipo));

  const resumenPuntos: ResumenPuntoLimpieza[] = mantenimiento.map((punto) => {
    const meta = metaLimpiezasDia(punto);
    const veces = vecesHoy.get(punto.id) ?? 0;
    const ult = ultima.get(punto.id) ?? null;
    return {
      punto,
      info: infoLimpieza(punto, ahora),
      vecesHoy: veces,
      meta,
      cumpleMeta: veces >= meta,
      ultima: ult?.ts ?? punto.ultimaLimpieza ?? null,
      ultimaPor: ult?.updated_by ?? null,
    };
  });

  return {
    puntos: resumenPuntos,
    total: resumenPuntos.length,
    vencidos: resumenPuntos.filter((r) => r.info?.estado === "vencido").length,
    pendientesMeta: resumenPuntos.filter((r) => !r.cumpleMeta).length,
  };
}
