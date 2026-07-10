// Timestamps de última actualización por tarea en /terreno.

export type ClaveActualizacionTerreno = "capacidad" | "autoridades" | "geolocalizacion";

export interface TerrenoActualizado {
  capacidad?: number;
  autoridades?: number;
  geolocalizacion?: number;
}

export function normalizarTerrenoActualizado(raw: unknown): TerrenoActualizado {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: TerrenoActualizado = {};
  for (const k of ["capacidad", "autoridades", "geolocalizacion"] as const) {
    const n = Number(o[k]);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

export function conActualizacionTerreno(
  actual: TerrenoActualizado | undefined,
  clave: ClaveActualizacionTerreno,
  ts: number = Date.now(),
): TerrenoActualizado {
  return { ...normalizarTerrenoActualizado(actual), [clave]: ts };
}

/** Texto corto para la card: «hoy 14:30» o «9 jul · 14:30». */
export function formatearHoraActualizacionTerreno(ts: number | null | undefined): string | null {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const hora = d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: false });
  const hoy = new Date();
  const mismoDia =
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate();
  if (mismoDia) return `hoy ${hora}`;
  const dia = d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  return `${dia} · ${hora}`;
}
