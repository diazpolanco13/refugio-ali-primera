// Lógica pura del registro de distribución de comida e hidratación.
// Agrupa las filas de la entidad `distribuciones` (cabeceras de jornada +
// entregas por sector) en un resumen por jornada para el panel y el dashboard.

import {
  CATALOGO_JORNADAS,
  type CensoSnapshot,
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

/** Un día de la serie de comidas repartidas: raciones servidas por jornada. */
export interface PuntoComidas {
  /** Inicio del día en ms (para orden y eje temporal). */
  ts: number;
  /** Clave de día YYYY-MM-DD. */
  fecha: string;
  /** Etiqueta legible para el eje (ej. "24 jun"). */
  etiqueta: string;
  desayuno: number;
  almuerzo: number;
  cena: number;
  merienda: number;
  hidratacion: number;
  /** Suma de todas las jornadas del día. */
  total: number;
}

/** Etiqueta corta en español para el eje del gráfico a partir de "YYYY-MM-DD". */
function etiquetaDesdeClave(dia: string): string {
  const [y, mo, d] = dia.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Serie diaria de comidas repartidas por jornada. Para cada día con registro de
 * distribución, suma la **población de los sectores marcados como servidos** en
 * cada jornada (un plato por persona del sector). Así se puede comparar, por
 * fechas, si se reparten más desayunos que cenas (p. ej. gente que sale a
 * trabajar y no almuerza en el refugio).
 *
 * La población de cada sector se toma de su censo más reciente con fecha <= ese
 * día (carry-forward, igual que la serie poblacional); si el sector no tiene
 * censos, usa su población actual como respaldo.
 */
export function serieComidasPorJornada(
  registros: RegistroDistribucion[],
  sectores: Sector[],
  censos: CensoSnapshot[] = [],
): PuntoComidas[] {
  // Población actual por sector (respaldo si no hay censos históricos).
  const poblacionActual = new Map<string, number>();
  for (const s of sectores) poblacionActual.set(s.id, s.poblacion_estimada || 0);

  // Censos por sector ordenados por ts, para el carry-forward.
  const censosPorSector = new Map<string, CensoSnapshot[]>();
  for (const c of censos) {
    const arr = censosPorSector.get(c.sector_id) ?? [];
    arr.push(c);
    censosPorSector.set(c.sector_id, arr);
  }
  for (const arr of censosPorSector.values()) arr.sort((a, b) => a.ts - b.ts);

  const poblacionEnDia = (sectorId: string, finDia: number): number => {
    const arr = censosPorSector.get(sectorId);
    if (arr && arr.length) {
      let val: number | null = null;
      for (const c of arr) {
        if (c.ts <= finDia) val = c.poblacion || 0;
        else break;
      }
      if (val != null) return val;
    }
    return poblacionActual.get(sectorId) ?? 0;
  };

  // Agrupar por día → jornada → conjunto de sectores servidos (sin duplicar).
  const porDia = new Map<string, Map<Jornada, Set<string>>>();
  for (const r of registros) {
    if (!esEntrega(r) || !r.entregado) continue;
    const mj = porDia.get(r.dia) ?? new Map<Jornada, Set<string>>();
    const set = mj.get(r.jornada) ?? new Set<string>();
    set.add(r.sector_id);
    mj.set(r.jornada, set);
    porDia.set(r.dia, mj);
  }

  const dias = [...porDia.keys()].sort();
  return dias.map((dia) => {
    const [y, mo, d] = dia.split("-").map(Number);
    const ts = new Date(y, mo - 1, d).getTime();
    const finDia = new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
    const mj = porDia.get(dia)!;
    const sumar = (j: Jornada): number => {
      const set = mj.get(j);
      if (!set) return 0;
      let total = 0;
      for (const sid of set) total += poblacionEnDia(sid, finDia);
      return total;
    };
    const desayuno = sumar("desayuno");
    const almuerzo = sumar("almuerzo");
    const cena = sumar("cena");
    const merienda = sumar("merienda");
    const hidratacion = sumar("hidratacion");
    return {
      ts,
      fecha: dia,
      etiqueta: etiquetaDesdeClave(dia),
      desayuno,
      almuerzo,
      cena,
      merienda,
      hidratacion,
      total: desayuno + almuerzo + cena + merienda + hidratacion,
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
