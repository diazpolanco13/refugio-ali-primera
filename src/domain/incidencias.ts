// Dominio de las incidencias por centro (tabla `incidencias_centros`).
//
// Cada incidencia es un registro append con seguimiento: descripción, una
// **etiqueta de severidad** (urgente/importante/cotidiana), una o varias
// **categorías globales** (para la clasificación de la red) y un estado
// abierta/resuelta. Los helpers de agrupación por día y severidad máxima
// alimentan los calendarios (del centro y global).

/** Etiqueta de severidad de una incidencia. */
export type EtiquetaIncidencia = "urgente" | "importante" | "cotidiana";

export interface MetaEtiqueta {
  valor: EtiquetaIncidencia;
  label: string;
  /** Color del semáforo (rojo/ámbar/gris), para badges y puntos del calendario. */
  color: string;
  /** Orden de severidad: menor = más grave (para ordenar y comparar). */
  orden: number;
}

export const ETIQUETAS_INCIDENCIA: MetaEtiqueta[] = [
  { valor: "urgente", label: "Urgente", color: "#ef4444", orden: 0 },
  { valor: "importante", label: "Importante", color: "#f59e0b", orden: 1 },
  { valor: "cotidiana", label: "Cotidiana", color: "#64748b", orden: 2 },
];

export const META_ETIQUETA: Record<EtiquetaIncidencia, MetaEtiqueta> = Object.fromEntries(
  ETIQUETAS_INCIDENCIA.map((e) => [e.valor, e]),
) as Record<EtiquetaIncidencia, MetaEtiqueta>;

/**
 * Normaliza el texto crudo de la etiqueta a una clave válida. Defensiva:
 * cualquier valor desconocido cae en `cotidiana` (la menos grave).
 */
export function normalizarEtiqueta(raw: string | undefined | null): EtiquetaIncidencia {
  if (raw === "urgente" || raw === "importante" || raw === "cotidiana") return raw;
  return "cotidiana";
}

/** Categoría global de clasificación de incidencias (una incidencia puede tener varias). */
export type CategoriaIncidencia =
  | "seguridad"
  | "salud"
  | "agua"
  | "alimentacion"
  | "infraestructura"
  | "servicios"
  | "convivencia"
  | "otro";

export const CATEGORIAS_INCIDENCIA: {
  valor: CategoriaIncidencia;
  label: string;
  icono: string;
}[] = [
  { valor: "seguridad", label: "Seguridad", icono: "🛡️" },
  { valor: "salud", label: "Salud", icono: "🩺" },
  { valor: "agua", label: "Agua", icono: "💧" },
  { valor: "alimentacion", label: "Alimentación", icono: "🍽️" },
  { valor: "infraestructura", label: "Infraestructura", icono: "🏗️" },
  { valor: "servicios", label: "Servicios", icono: "🔌" },
  { valor: "convivencia", label: "Convivencia", icono: "🤝" },
  { valor: "otro", label: "Otro", icono: "📌" },
];

export const CATEGORIA_LABEL: Record<CategoriaIncidencia, string> = Object.fromEntries(
  CATEGORIAS_INCIDENCIA.map((c) => [c.valor, c.label]),
) as Record<CategoriaIncidencia, string>;

const CATEGORIAS_VALIDAS = new Set<string>(CATEGORIAS_INCIDENCIA.map((c) => c.valor));

/** Filtra un array crudo de categorías dejando solo las válidas del catálogo. */
export function normalizarCategorias(
  raw: (string | null | undefined)[] | undefined | null,
): CategoriaIncidencia[] {
  if (!raw) return [];
  return raw.filter((c): c is CategoriaIncidencia =>
    Boolean(c && CATEGORIAS_VALIDAS.has(c)),
  );
}

/** Estado de seguimiento de una incidencia. */
export type EstadoIncidencia = "abierta" | "resuelta";

/** Incidencia de un centro (fila de `incidencias_centros`). */
export interface Incidencia {
  id: string;
  centro_id: string;
  /** YYYY-MM-DD (día en que ocurrió/se registró). */
  dia: string;
  /** Timestamp (ms) del registro. */
  ts: number;
  descripcion: string;
  etiqueta: EtiquetaIncidencia;
  categorias: CategoriaIncidencia[];
  estado: EstadoIncidencia;
  /** Timestamp (ms) de resolución; null si sigue abierta. */
  resuelta_ts: number | null;
  /** Username de quien la resolvió; null si sigue abierta. */
  resuelta_por: string | null;
  /** Username de quien la abrió (estable: `updated_by` se pisa al editar).
   *  El operador solo puede resolver las incidencias que él creó. */
  creada_por: string | null;
  updated_at: number;
  updated_by: string;
}

/**
 * Normaliza una fila de `incidencias_centros` al tipo de dominio. Tolera
 * filas incompletas (campos null o categorías fuera del catálogo).
 */
export function normalizarIncidencia(
  raw: Partial<Incidencia> & { id: string; centro_id: string; dia: string },
): Incidencia {
  return {
    id: raw.id,
    centro_id: raw.centro_id,
    dia: raw.dia,
    ts: raw.ts ?? 0,
    descripcion: raw.descripcion ?? "",
    etiqueta: normalizarEtiqueta(raw.etiqueta),
    categorias: normalizarCategorias(raw.categorias),
    estado: raw.estado === "resuelta" ? "resuelta" : "abierta",
    resuelta_ts: raw.resuelta_ts ?? null,
    resuelta_por: raw.resuelta_por ?? null,
    creada_por: raw.creada_por ?? null,
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

/**
 * Compara dos etiquetas por severidad (para `sort`): las más graves primero.
 * Devuelve negativo si `a` es más grave que `b`.
 */
export function compararSeveridad(a: EtiquetaIncidencia, b: EtiquetaIncidencia): number {
  return META_ETIQUETA[a].orden - META_ETIQUETA[b].orden;
}

/**
 * Agrupa incidencias por día (YYYY-MM-DD → incidencias de ese día, ordenadas
 * por severidad y luego por ts desc). Base de los calendarios.
 */
export function agruparIncidenciasPorDia(
  incidencias: Incidencia[],
): Map<string, Incidencia[]> {
  const map = new Map<string, Incidencia[]>();
  for (const inc of incidencias) {
    const arr = map.get(inc.dia) ?? [];
    arr.push(inc);
    map.set(inc.dia, arr);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) => compararSeveridad(a.etiqueta, b.etiqueta) || b.ts - a.ts,
    );
  }
  return map;
}

/**
 * Severidad máxima (etiqueta más grave) de un conjunto de incidencias, p. ej.
 * las de un día del calendario. Devuelve null si el array está vacío.
 */
export function severidadMaxima(
  incidencias: Incidencia[],
): EtiquetaIncidencia | null {
  if (incidencias.length === 0) return null;
  return incidencias.reduce<EtiquetaIncidencia>(
    (max, inc) => (compararSeveridad(inc.etiqueta, max) < 0 ? inc.etiqueta : max),
    incidencias[0].etiqueta,
  );
}

/**
 * Severidad máxima por día (YYYY-MM-DD → etiqueta más grave del día). Es lo
 * que pinta el punto de color de cada día en el calendario.
 */
export function severidadMaximaPorDia(
  incidencias: Incidencia[],
): Map<string, EtiquetaIncidencia> {
  const porDia = agruparIncidenciasPorDia(incidencias);
  const map = new Map<string, EtiquetaIncidencia>();
  for (const [dia, incs] of porDia) {
    const sev = severidadMaxima(incs);
    if (sev) map.set(dia, sev);
  }
  return map;
}

/** Incidencias abiertas, ordenadas por severidad (urgentes primero) y ts desc. */
export function incidenciasAbiertas(incidencias: Incidencia[]): Incidencia[] {
  return incidencias
    .filter((i) => i.estado === "abierta")
    .sort((a, b) => compararSeveridad(a.etiqueta, b.etiqueta) || b.ts - a.ts);
}

/** Componentes de una clave YYYY-MM-DD. */
export function parsearDiaIncidencia(dia: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, diaNum] = dia.split("-").map(Number);
  return { anio, mes, dia: diaNum };
}

/** Contadores por HOY, semana del mes en curso y mes calendario. */
export function contadoresIncidenciasPorPeriodo(
  incidencias: Incidencia[],
  hoyClave: string,
): {
  hoy: number;
  semanaDelMes: number;
  semanaCount: number;
  mesCount: number;
  mesLabel: string;
  abiertas: number;
  urgentesAbiertas: number;
} {
  const { anio: hy, mes: hm, dia: hd } = parsearDiaIncidencia(hoyClave);
  const semanaDelMes = Math.ceil(hd / 7);
  const semInicio = (semanaDelMes - 1) * 7 + 1;
  const diasEnMes = new Date(hy, hm, 0).getDate();
  const semFin = Math.min(semanaDelMes * 7, diasEnMes);
  const mesLabelRaw = new Date(hy, hm - 1, 1).toLocaleDateString("es-VE", { month: "long" });
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1);

  let hoy = 0;
  let semanaCount = 0;
  let mesCount = 0;
  for (const inc of incidencias) {
    const p = parsearDiaIncidencia(inc.dia);
    if (inc.dia === hoyClave) hoy++;
    if (p.anio === hy && p.mes === hm) {
      mesCount++;
      if (p.dia >= semInicio && p.dia <= semFin) semanaCount++;
    }
  }

  const abiertasList = incidenciasAbiertas(incidencias);
  return {
    hoy,
    semanaDelMes,
    semanaCount,
    mesCount,
    mesLabel,
    abiertas: abiertasList.length,
    urgentesAbiertas: abiertasList.filter((i) => i.etiqueta === "urgente").length,
  };
}

/** Ventana temporal del gráfico de incidencias (días). */
export type VentanaSerieIncidencias = 7 | 15 | 30;

export interface PuntoSerieIncidencias {
  dia: string;
  total: number;
  urgentes: number;
  importantes: number;
  cotidianas: number;
  abiertas: number;
}

/** Últimos N días calendario terminando en `hoyClave` (YYYY-MM-DD). */
export function ultimosDiasIncidencias(
  cantidad: VentanaSerieIncidencias,
  hoyClave: string,
): string[] {
  const [hy, hm, hd] = hoyClave.split("-").map(Number);
  const fin = new Date(hy, hm - 1, hd);
  const out: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(fin);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

/** Conteo diario por severidad para el gráfico de un centro. */
export function serieIncidenciasCentroVentana(
  incidencias: Incidencia[],
  ventana: VentanaSerieIncidencias,
  hoyClave: string,
): PuntoSerieIncidencias[] {
  const porDia = agruparIncidenciasPorDia(incidencias);
  return ultimosDiasIncidencias(ventana, hoyClave).map((dia) => {
    const incs = porDia.get(dia) ?? [];
    return {
      dia,
      total: incs.length,
      urgentes: incs.filter((i) => i.etiqueta === "urgente").length,
      importantes: incs.filter((i) => i.etiqueta === "importante").length,
      cotidianas: incs.filter((i) => i.etiqueta === "cotidiana").length,
      abiertas: incs.filter((i) => i.estado === "abierta").length,
    };
  });
}
