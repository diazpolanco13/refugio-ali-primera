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
