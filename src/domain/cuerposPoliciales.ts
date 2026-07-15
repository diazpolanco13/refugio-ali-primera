/**
 * Catálogo de cuerpos policiales / de seguridad.
 * Fuente de verdad: tabla `cuerpos_policiales` en Supabase.
 * Fallback estático + caché en memoria (hook `useCuerposPoliciales` + Realtime).
 */

/** Clave canónica del cuerpo (slug dinámico). */
export type ClaveCuerpo = string;

export interface MetaCuerpo {
  clave: ClaveCuerpo;
  label: string;
  icono: string;
  color: string;
  /** Logo/escudo: path público o URL Storage. `null` si no hay. */
  logo: string | null;
  orden?: number;
  activo?: boolean;
  /** Nombre completo institucional (membrete de los PDF). */
  nombreOficial?: string | null;
  /** Sala/unidad de análisis del cuerpo (lado derecho del membrete). */
  salaNombre?: string | null;
  salaLogo?: string | null;
}

/** Fila tipada de la tabla `cuerpos_policiales`. */
export interface CuerpoPolicialFila {
  clave: string;
  label: string;
  color: string;
  icono: string;
  logo_url: string | null;
  orden: number;
  activo: boolean;
  nombre_oficial?: string | null;
  sala_nombre?: string | null;
  sala_logo_url?: string | null;
  updated_at?: number;
  updated_by?: string | null;
}

/** Seed / fallback si aún no cargó Supabase. */
export const CATALOGO_CUERPOS_FALLBACK: MetaCuerpo[] = [
  { clave: "gnb", label: "GNB", icono: "🪖", color: "#4d7c0f", logo: "/logos-cuerpos/gnb.webp", orden: 10 },
  {
    clave: "sebin",
    label: "SEBIN",
    icono: "🛡️",
    color: "#1e3a8a",
    logo: "/logos-cuerpos/sebin.webp",
    orden: 20,
    nombreOficial: "Servicio Bolivariano de Inteligencia Nacional",
    salaNombre: "Sala de Análisis Estratégico",
    salaLogo: "/logos/logo-sae.png",
  },
  { clave: "dgcim", label: "DGCIM", icono: "🎖️", color: "#334155", logo: "/logos-cuerpos/dgcim.webp", orden: 30 },
  { clave: "cicpc", label: "CICPC", icono: "🔍", color: "#7c3aed", logo: "/logos-cuerpos/cicpc.webp", orden: 40 },
  { clave: "pnb", label: "PNB", icono: "👮", color: "#1d4ed8", logo: "/logos-cuerpos/pnb.webp", orden: 50 },
  {
    clave: "poli_baruta",
    label: "Poli Baruta",
    icono: "🚓",
    color: "#0ea5e9",
    logo: "/logos-cuerpos/poli_baruta.webp",
    orden: 60,
  },
  {
    clave: "poli_caracas",
    label: "PoliCaracas",
    icono: "🚔",
    color: "#059669",
    logo: "/logos-cuerpos/poli_caracas.webp",
    orden: 70,
  },
  {
    clave: "poli_chacao",
    label: "PoliChacao",
    icono: "🚨",
    color: "#d97706",
    logo: "/logos-cuerpos/poli_chacao.webp",
    orden: 80,
  },
  {
    clave: "poli_hatillo",
    label: "Poli El Hatillo",
    icono: "🛵",
    color: "#db2777",
    logo: "/logos-cuerpos/poli_hatillo.webp",
    orden: 90,
  },
  {
    clave: "poli_sucre",
    label: "Poli Sucre",
    icono: "🚦",
    color: "#ea580c",
    logo: "/logos-cuerpos/poli_sucre.webp",
    orden: 100,
  },
  {
    clave: "poli_miranda",
    label: "Poli Miranda",
    icono: "🏍️",
    color: "#65a30d",
    logo: "/logos-cuerpos/poli_miranda.webp",
    orden: 110,
  },
  { clave: "psuv", label: "PSUV", icono: "🌹", color: "#dc2626", logo: "/logos-cuerpos/psuv.webp", orden: 120 },
  {
    clave: "min_educacion",
    label: "Min Educación",
    icono: "📚",
    color: "#2563eb",
    logo: "/logos-cuerpos/min_educacion.webp",
    orden: 130,
  },
  {
    clave: "alcaldia_ccs",
    label: "Alcaldía de Caracas",
    icono: "🏛️",
    color: "#ca8a04",
    logo: "/logos-cuerpos/alcaldia_ccs.webp",
    orden: 140,
  },
  {
    clave: "milicia",
    label: "Milicia",
    icono: "⚔️",
    color: "#15803d",
    logo: "/logos-cuerpos/milicia.webp",
    orden: 150,
  },
  {
    clave: "gbp",
    label: "Guardia del Pueblo",
    icono: "🛡️",
    color: "#b91c1c",
    logo: "/logos-cuerpos/gbp.webp",
    orden: 160,
  },
  { clave: "armada", label: "Armada Bolivariana", icono: "⚓", color: "#0369a1", logo: null, orden: 170 },
  { clave: "ejercito", label: "Ejército", icono: "🎖️", color: "#166534", logo: null, orden: 180 },
  { clave: "sin_asignar", label: "Sin asignar", icono: "❔", color: "#64748b", logo: null, orden: 999 },
];

/** @deprecated Usar `getCatalogoCuerpos()`. Compatibilidad. */
export const CATALOGO_CUERPOS = CATALOGO_CUERPOS_FALLBACK;

const META_SIN_ASIGNAR: MetaCuerpo = {
  clave: "sin_asignar",
  label: "Sin asignar",
  icono: "❔",
  color: "#64748b",
  logo: null,
  orden: 999,
  activo: true,
};

let catalogoVivo: MetaCuerpo[] = [...CATALOGO_CUERPOS_FALLBACK];
const listeners = new Set<() => void>();

function notificar() {
  for (const l of listeners) l();
}

function mapaAliasEstatico(): Record<string, ClaveCuerpo> {
  return {
    guardianacionalbolivariana: "gnb",
    gnb: "gnb",
    sebin: "sebin",
    dgcim: "dgcim",
    cicpc: "cicpc",
    pnb: "pnb",
    polibaruta: "poli_baruta",
    policaracas: "poli_caracas",
    polichacao: "poli_chacao",
    polihatillo: "poli_hatillo",
    polielhatillo: "poli_hatillo",
    polisucre: "poli_sucre",
    polimiranda: "poli_miranda",
    psuv: "psuv",
    mineducacion: "min_educacion",
    ministeriodeducacion: "min_educacion",
    btssantateresa: "min_educacion",
    bts: "min_educacion",
    alcaldiadecaracas: "alcaldia_ccs",
    alcaldiadeccs: "alcaldia_ccs",
    alcaldiaccs: "alcaldia_ccs",
    milicia: "milicia",
    miliciabolivariana: "milicia",
    gbp: "gbp",
    guardiadelpueblo: "gbp",
    guardiabolivarianadelpueblo: "gbp",
    armada: "armada",
    armadabolivariana: "armada",
    ejercito: "ejercito",
    ejercitobolivariano: "ejercito",
    sinasignar: "sin_asignar",
  };
}

function claveCuerpoDeTexto(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/** Catálogo actual (vivo o fallback). Incluye inactivos para resolver datos viejos. */
export function getCatalogoCuerpos(): MetaCuerpo[] {
  return catalogoVivo;
}

/** Solo cuerpos activos (selectores). Siempre incluye `sin_asignar`. */
export function getCatalogoCuerposActivos(): MetaCuerpo[] {
  const activos = catalogoVivo.filter((c) => c.activo !== false);
  if (!activos.some((c) => c.clave === "sin_asignar")) {
    return [...activos, META_SIN_ASIGNAR];
  }
  return activos;
}

/** Mapa clave → meta del catálogo vivo. */
export function getMetaCuerpoMap(): Record<string, MetaCuerpo> {
  return Object.fromEntries(catalogoVivo.map((c) => [c.clave, c]));
}

/**
 * Proxy compatible con `META_CUERPO[clave]` (código legacy).
 * Resuelve contra el catálogo vivo.
 */
export const META_CUERPO: Record<string, MetaCuerpo> = new Proxy(
  {} as Record<string, MetaCuerpo>,
  {
    get(_t, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;
      return (
        catalogoVivo.find((c) => c.clave === prop) ??
        CATALOGO_CUERPOS_FALLBACK.find((c) => c.clave === prop) ??
        META_SIN_ASIGNAR
      );
    },
    ownKeys() {
      return catalogoVivo.map((c) => c.clave);
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (typeof prop !== "string") return undefined;
      const meta = catalogoVivo.find((c) => c.clave === prop);
      if (!meta) return undefined;
      return { configurable: true, enumerable: true, value: meta };
    },
  },
);

export function setCatalogoCuerpos(filas: MetaCuerpo[]): void {
  const ordenadas = [...filas].sort(
    (a, b) => (a.orden ?? 100) - (b.orden ?? 100) || a.label.localeCompare(b.label, "es"),
  );
  if (!ordenadas.some((c) => c.clave === "sin_asignar")) {
    ordenadas.push(META_SIN_ASIGNAR);
  }
  catalogoVivo = ordenadas;
  notificar();
}

export function suscribirCatalogoCuerpos(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function filaAMetaCuerpo(f: CuerpoPolicialFila): MetaCuerpo {
  return {
    clave: f.clave,
    label: f.label,
    icono: f.icono || "🛡️",
    color: f.color || "#64748b",
    logo: f.logo_url?.trim() ? f.logo_url.trim() : null,
    orden: f.orden ?? 100,
    activo: f.activo !== false,
    nombreOficial: f.nombre_oficial?.trim() || null,
    salaNombre: f.sala_nombre?.trim() || null,
    salaLogo: f.sala_logo_url?.trim() || null,
  };
}

/**
 * Normaliza texto crudo del cuerpo a clave canónica.
 * Acepta clave, label y alias históricos.
 */
export function normalizarCuerpo(raw: string | undefined | null): ClaveCuerpo {
  if (!raw) return "sin_asignar";
  const limpio = claveCuerpoDeTexto(raw);
  const catalogo = getCatalogoCuerpos();

  const porClave = catalogo.find((c) => c.clave === limpio || c.clave === raw.trim());
  if (porClave) return porClave.clave;

  for (const c of catalogo) {
    if (claveCuerpoDeTexto(c.label) === limpio) return c.clave;
  }

  const alias = mapaAliasEstatico()[limpio];
  if (alias) return alias;

  return "sin_asignar";
}

export function metaCuerpoDe(raw: string | undefined | null): MetaCuerpo {
  const clave = normalizarCuerpo(raw);
  return (
    getCatalogoCuerpos().find((c) => c.clave === clave) ??
    CATALOGO_CUERPOS_FALLBACK.find((c) => c.clave === clave) ??
    META_SIN_ASIGNAR
  );
}

/** Slug seguro para clave nueva a partir de una etiqueta. */
export function slugCuerpo(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .slice(0, 62) || "cuerpo"
  );
}
