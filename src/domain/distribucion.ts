// Lógica pura del registro de distribución de comida e hidratación.
// Agrupa las filas de la entidad `distribuciones` (cabeceras de jornada +
// entregas por sector) en un resumen por jornada para el panel y el dashboard.

import {
  CATALOGO_JORNADAS,
  type EntregaSector,
  type Jornada,
  type JornadaComida,
  type RegistroDistribucion,
  type Sector,
} from "./tipos";

/** Clave de día YYYY-MM-DD (hora local) a partir de un timestamp en ms. */
export function claveDiaLocal(ts: number = Date.now()): string {
  const d = new Date(ts);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function esJornada(r: RegistroDistribucion): r is JornadaComida {
  return r.clase === "jornada";
}
function esEntrega(r: RegistroDistribucion): r is EntregaSector {
  return r.clase === "entrega";
}

export interface ResumenJornada {
  jornada: Jornada;
  label: string;
  icono: string;
  /** Cabecera logística (hora de llegada, raciones…), si existe. */
  cabecera: JornadaComida | null;
  /** Timestamp de llegada de la comida (atajo). */
  horaLlegada: number | null;
  /** Entrega por sector_id (solo las marcadas como entregado). */
  entregas: Map<string, EntregaSector>;
  /** Sectores servidos (con entrega marcada). */
  servidos: number;
  /** Total de sectores del refugio. */
  total: number;
  /** ¿Todos los sectores servidos? (y hay al menos un sector). */
  completo: boolean;
}

/**
 * Construye el resumen por jornada del día indicado. Recorre todas las filas de
 * distribución una sola vez y las agrupa por jornada, cruzando con los sectores
 * actuales para calcular el progreso (servidos / total).
 */
export function resumenDistribucion(
  dia: string,
  registros: RegistroDistribucion[],
  sectores: Sector[],
): ResumenJornada[] {
  const cabeceras = new Map<Jornada, JornadaComida>();
  const entregasPorJornada = new Map<Jornada, Map<string, EntregaSector>>();

  for (const r of registros) {
    if (r.dia !== dia) continue;
    if (esJornada(r)) {
      cabeceras.set(r.jornada, r);
    } else if (esEntrega(r) && r.entregado) {
      const m = entregasPorJornada.get(r.jornada) ?? new Map<string, EntregaSector>();
      m.set(r.sector_id, r);
      entregasPorJornada.set(r.jornada, m);
    }
  }

  const total = sectores.length;

  return CATALOGO_JORNADAS.map(({ valor, label, icono }) => {
    const cabecera = cabeceras.get(valor) ?? null;
    const entregas = entregasPorJornada.get(valor) ?? new Map<string, EntregaSector>();
    // Solo cuentan las entregas de sectores que aún existen.
    let servidos = 0;
    for (const s of sectores) {
      if (entregas.has(s.id)) servidos++;
    }
    return {
      jornada: valor,
      label,
      icono,
      cabecera,
      horaLlegada: cabecera?.hora_llegada ?? null,
      entregas,
      servidos,
      total,
      completo: total > 0 && servidos >= total,
    };
  });
}

/** Formatea un timestamp (ms) como hora local corta (ej. "12:30"). */
export function formatoHora(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/** Timestamp (ms) → "HH:MM" local para un <input type="time">. "" si es null. */
export function horaAInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * "HH:MM" + día "YYYY-MM-DD" → timestamp (ms) en hora local. Devuelve null si
 * el valor está vacío o es inválido.
 */
export function horaDesdeInput(dia: string, hhmm: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const [y, mo, d] = dia.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}
