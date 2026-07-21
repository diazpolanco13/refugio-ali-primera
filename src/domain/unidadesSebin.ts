/**
 * Catálogo de direcciones/unidades internas del SEBIN.
 * Fuente de verdad: tabla `unidades_sebin` en Supabase.
 * Este módulo mantiene un fallback estático (seed jul-2026) y un caché en
 * memoria que el hook `useUnidadesSebin` refresca con Realtime.
 */

/** Clave canónica de una unidad (slug: `dir_reg`, `dai`, …). */
export type ClaveUnidadSebin = string;

export interface MetaUnidadSebin {
  clave: ClaveUnidadSebin;
  /** Etiqueta corta para panel y mapa. */
  label: string;
  /** Valor almacenado en `supervision.unidad_sebin`. */
  valorDb: string;
  /** Color del anillo del marcador. */
  color: string;
  /** Cuerpo al que pertenece (`null` = global, p. ej. sin_asignar). */
  cuerpoClave?: string | null;
  /** Logo opcional (path o URL Storage). */
  logoUrl?: string | null;
  /** Orden de presentación (menor = primero). */
  orden?: number;
  /** Si false, no aparece en selectores nuevos (sigue resolviendo datos viejos). */
  activo?: boolean;
}

/** Fila tipada de la tabla `unidades_sebin`. */
export interface UnidadSebinFila {
  clave: string;
  label: string;
  valor_db: string;
  color: string;
  cuerpo_clave?: string | null;
  logo_url?: string | null;
  orden: number;
  activo: boolean;
  updated_at?: number;
  updated_by?: string | null;
}

/** Seed / fallback si aún no cargó Supabase (históricamente unidades SEBIN). */
export const CATALOGO_UNIDADES_SEBIN_FALLBACK: MetaUnidadSebin[] = [
  {
    clave: "dir_reg",
    label: "DIR. REG",
    valorDb: "DIR. REG - SEBIN",
    color: "#2563eb",
    cuerpoClave: "sebin",
    orden: 10,
  },
  {
    clave: "dir_educacion",
    label: "DIR. EDUCACIÓN",
    valorDb: "DIR. EDUCACION - SEBIN",
    color: "#0891b2",
    cuerpoClave: "sebin",
    orden: 20,
  },
  {
    clave: "dai",
    label: "DAI",
    valorDb: "DAI - SEBIN",
    color: "#0d9488",
    cuerpoClave: "sebin",
    orden: 30,
  },
  {
    clave: "int_financ",
    label: "INT. FINANC.",
    valorDb: "INT. FINANC. - SEBIN",
    color: "#059669",
    cuerpoClave: "sebin",
    orden: 40,
  },
  {
    clave: "dir_secretaria",
    label: "DIR. SECRETARÍA",
    valorDb: "DIR. SECRETARIA - SEBIN",
    color: "#ca8a04",
    cuerpoClave: "sebin",
    orden: 50,
  },
  {
    clave: "dir_patrullaje",
    label: "DIR. PATRULLAJE",
    valorDb: "DIR. PATRULLAJE - SEBIN",
    color: "#d97706",
    cuerpoClave: "sebin",
    orden: 60,
  },
  {
    clave: "dir_control_adm",
    label: "DIR. CONTROL ADM.",
    valorDb: "DIR. CONTROL ADM. - SEBIN",
    color: "#ea580c",
    cuerpoClave: "sebin",
    orden: 70,
  },
  {
    clave: "dir_ciber_int",
    label: "DIR. CIBER INT.",
    valorDb: "DIR. CIBER INT. - SEBIN",
    color: "#7c3aed",
    cuerpoClave: "sebin",
    orden: 80,
  },
  {
    clave: "dir_contra_int",
    label: "DIR. CONTRA INT.",
    valorDb: "DIR. CONTRA INT. - SEBIN",
    color: "#db2777",
    cuerpoClave: "sebin",
    orden: 90,
  },
  {
    clave: "dir_contra_int_ortega",
    label: "DIR. CONTRA INT. (ORTEGA)",
    valorDb: "DIR. CONTRA INT. (ORTEGA) - SEBIN",
    color: "#e11d48",
    cuerpoClave: "sebin",
    orden: 100,
  },
  {
    clave: "dir_int",
    label: "DIR. INT.",
    valorDb: "DIR. INT. - SEBIN",
    color: "#4f46e5",
    cuerpoClave: "sebin",
    orden: 110,
  },
  {
    clave: "control_educativo",
    label: "CONTROL EDUCATIVO",
    valorDb: "CONTROL EDUCATIVO - SEBIN",
    color: "#65a30d",
    cuerpoClave: "sebin",
    orden: 120,
  },
  {
    clave: "sin_asignar",
    label: "Sin unidad",
    valorDb: "",
    color: "#64748b",
    cuerpoClave: null,
    orden: 999,
  },
];

/** @deprecated Usar `getCatalogoUnidadesSebin()`. Se mantiene por compatibilidad. */
export const CATALOGO_UNIDADES_SEBIN = CATALOGO_UNIDADES_SEBIN_FALLBACK;

const META_SIN_ASIGNAR: MetaUnidadSebin = {
  clave: "sin_asignar",
  label: "Sin unidad",
  valorDb: "",
  color: "#64748b",
  cuerpoClave: null,
  logoUrl: null,
  orden: 999,
  activo: true,
};

let catalogoVivo: MetaUnidadSebin[] = [...CATALOGO_UNIDADES_SEBIN_FALLBACK];
const listeners = new Set<() => void>();

function notificar() {
  for (const l of listeners) l();
}

/** Catálogo actual (vivo o fallback). Incluye inactivas para resolver datos viejos. */
export function getCatalogoUnidadesSebin(): MetaUnidadSebin[] {
  return catalogoVivo;
}

/** Solo unidades activas (selectores de asignación). Siempre incluye `sin_asignar`. */
export function getCatalogoUnidadesSebinActivas(): MetaUnidadSebin[] {
  const activas = catalogoVivo.filter((u) => u.activo !== false);
  if (!activas.some((u) => u.clave === "sin_asignar")) {
    return [...activas, META_SIN_ASIGNAR];
  }
  return activas;
}

/**
 * Unidades activas de un cuerpo (+ globales / sin_asignar).
 * Si `cuerpoClave` es vacío o `sin_asignar`, solo globales.
 */
export function getCatalogoUnidadesPorCuerpo(
  cuerpoClave: string | null | undefined,
): MetaUnidadSebin[] {
  const activas = getCatalogoUnidadesSebinActivas();
  if (!cuerpoClave || cuerpoClave === "sin_asignar") {
    return activas.filter((u) => !u.cuerpoClave || u.clave === "sin_asignar");
  }
  return activas.filter(
    (u) => u.clave === "sin_asignar" || !u.cuerpoClave || u.cuerpoClave === cuerpoClave,
  );
}

/**
 * Claves de cuerpo con ≥1 unidad activa propia (excl. `sin_asignar` y globales).
 * Sirve para armar el selector cascada cuerpo → sub-unidades sin hardcodear.
 */
export function getClavesCuerpoConUnidadesActivas(): string[] {
  const claves = new Set<string>();
  for (const u of getCatalogoUnidadesSebinActivas()) {
    if (u.clave === "sin_asignar" || !u.cuerpoClave) continue;
    claves.add(u.cuerpoClave);
  }
  return [...claves];
}

/**
 * Cuerpo sugerido para filtrar unidades de supervisión:
 * 1) cuerpo de la unidad ya asignada (si tiene unidades)
 * 2) cuerpo del campamento (si tiene unidades)
 * 3) primer cuerpo del orden preferido que tenga unidades
 */
export function sugerirCuerpoFiltroUnidades(
  unidadClaveOValor: string | null | undefined,
  cuerpoCampamento: string | null | undefined,
  ordenPreferidoCuerpos: readonly string[] = [],
): string | null {
  const conUnidades = new Set(getClavesCuerpoConUnidadesActivas());
  if (conUnidades.size === 0) return null;

  const claveUnidad = normalizarUnidadSebin(unidadClaveOValor);
  if (claveUnidad !== "sin_asignar") {
    const meta = getCatalogoUnidadesSebin().find((u) => u.clave === claveUnidad);
    if (meta?.cuerpoClave && conUnidades.has(meta.cuerpoClave)) {
      return meta.cuerpoClave;
    }
  }

  if (
    cuerpoCampamento &&
    cuerpoCampamento !== "sin_asignar" &&
    conUnidades.has(cuerpoCampamento)
  ) {
    return cuerpoCampamento;
  }

  for (const clave of ordenPreferidoCuerpos) {
    if (conUnidades.has(clave)) return clave;
  }
  return [...conUnidades][0] ?? null;
}

/** Actualiza el caché en memoria (lo llama el hook tras leer Supabase). */
export function setCatalogoUnidadesSebin(filas: MetaUnidadSebin[]): void {
  const ordenadas = [...filas].sort(
    (a, b) => (a.orden ?? 100) - (b.orden ?? 100) || a.label.localeCompare(b.label, "es"),
  );
  if (!ordenadas.some((u) => u.clave === "sin_asignar")) {
    ordenadas.push(META_SIN_ASIGNAR);
  }
  catalogoVivo = ordenadas;
  notificar();
}

/** Suscripción para que React re-renderice al cambiar el catálogo. */
export function suscribirCatalogoUnidadesSebin(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function filaAMetaUnidad(f: UnidadSebinFila): MetaUnidadSebin {
  return {
    clave: f.clave,
    label: f.label,
    valorDb: f.valor_db ?? "",
    color: f.color || "#64748b",
    cuerpoClave: f.cuerpo_clave ?? null,
    logoUrl: f.logo_url?.trim() ? f.logo_url.trim() : null,
    orden: f.orden ?? 100,
    activo: f.activo !== false,
  };
}

export const META_UNIDAD_SEBIN: Record<string, MetaUnidadSebin> = Object.fromEntries(
  CATALOGO_UNIDADES_SEBIN_FALLBACK.map((u) => [u.clave, u]),
);

/** Normaliza el texto de unidad SEBIN a clave canónica. */
export function normalizarUnidadSebin(raw: string | undefined | null): ClaveUnidadSebin {
  if (!raw?.trim()) return "sin_asignar";
  const limpio = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const catalogo = getCatalogoUnidadesSebin();

  // Match exacto por clave.
  const porClave = catalogo.find((u) => u.clave === limpio || u.clave === raw.trim());
  if (porClave) return porClave.clave;

  // Match por valor_db.
  for (const u of catalogo) {
    if (!u.valorDb) continue;
    const valor = u.valorDb.trim().toLowerCase().replace(/\s+/g, " ");
    if (valor === limpio) return u.clave;
  }

  const sinGuion = limpio.replace(/\s*-\s*sebin\s*$/, "").trim();
  for (const u of catalogo) {
    if (!u.valorDb) continue;
    const base = u.valorDb.toLowerCase().replace(/\s*-\s*sebin\s*$/, "").trim();
    if (sinGuion === base || limpio.includes(base)) return u.clave;
    if (u.label.toLowerCase().replace(/\s+/g, " ") === sinGuion) return u.clave;
  }
  return "sin_asignar";
}

export function metaUnidadSebinDe(raw: string | undefined | null): MetaUnidadSebin {
  const clave = normalizarUnidadSebin(raw);
  return (
    getCatalogoUnidadesSebin().find((u) => u.clave === clave) ??
    META_UNIDAD_SEBIN[clave] ??
    META_SIN_ASIGNAR
  );
}

/** Slug seguro para clave nueva a partir de una etiqueta. */
export function slugUnidadSebin(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 62) || "unidad";
}

/** Logo SEBIN compartido por todas las unidades internas. */
export const LOGO_SEBIN = "/logos-cuerpos/sebin.webp";

/** Color de marcadores atenuados al filtrar por otra dirección SEBIN. */
export const COLOR_MARCADOR_ATENUADO = "#52525b";

/**
 * Color unicolor del núcleo del marcador (modo "color") cuando NO se colorea
 * por unidad SEBIN — default. Negro: contraste claro sobre mapa; el aro de
 * progreso del reporte (rojo/amarillo/verde) sigue siendo lo que se lee,
 * sin competir con ~12 colores de unidad.
 */
export const COLOR_NUCLEO_NEUTRO = "#0a0a0a";
