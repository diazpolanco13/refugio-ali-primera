/** Clave canónica de una dirección/unidad interna del SEBIN asignada a un campamento. */
export type ClaveUnidadSebin =
  | "dir_reg"
  | "dir_educacion"
  | "dai"
  | "int_financ"
  | "dir_secretaria"
  | "dir_patrullaje"
  | "dir_control_adm"
  | "dir_ciber_int"
  | "dir_contra_int"
  | "dir_contra_int_ortega"
  | "dir_int"
  | "control_educativo"
  | "sin_asignar";

export interface MetaUnidadSebin {
  clave: ClaveUnidadSebin;
  /** Etiqueta corta para panel y mapa. */
  label: string;
  /** Valor almacenado en `supervision.unidad_sebin`. */
  valorDb: string;
  /** Color del anillo del marcador (SEBIN comparte logo; el color distingue la unidad). */
  color: string;
}

/** Catálogo de direcciones internas SEBIN (distribución jul-2026). */
export const CATALOGO_UNIDADES_SEBIN: MetaUnidadSebin[] = [
  { clave: "dir_reg", label: "DIR. REG", valorDb: "DIR. REG - SEBIN", color: "#2563eb" },
  {
    clave: "dir_educacion",
    label: "DIR. EDUCACIÓN",
    valorDb: "DIR. EDUCACION - SEBIN",
    color: "#0891b2",
  },
  { clave: "dai", label: "DAI", valorDb: "DAI - SEBIN", color: "#0d9488" },
  {
    clave: "int_financ",
    label: "INT. FINANC.",
    valorDb: "INT. FINANC. - SEBIN",
    color: "#059669",
  },
  {
    clave: "dir_secretaria",
    label: "DIR. SECRETARÍA",
    valorDb: "DIR. SECRETARIA - SEBIN",
    color: "#ca8a04",
  },
  {
    clave: "dir_patrullaje",
    label: "DIR. PATRULLAJE",
    valorDb: "DIR. PATRULLAJE - SEBIN",
    color: "#d97706",
  },
  {
    clave: "dir_control_adm",
    label: "DIR. CONTROL ADM.",
    valorDb: "DIR. CONTROL ADM. - SEBIN",
    color: "#ea580c",
  },
  {
    clave: "dir_ciber_int",
    label: "DIR. CIBER INT.",
    valorDb: "DIR. CIBER INT. - SEBIN",
    color: "#7c3aed",
  },
  {
    clave: "dir_contra_int",
    label: "DIR. CONTRA INT.",
    valorDb: "DIR. CONTRA INT. - SEBIN",
    color: "#db2777",
  },
  {
    clave: "dir_contra_int_ortega",
    label: "DIR. CONTRA INT. (ORTEGA)",
    valorDb: "DIR. CONTRA INT. (ORTEGA) - SEBIN",
    color: "#e11d48",
  },
  { clave: "dir_int", label: "DIR. INT.", valorDb: "DIR. INT. - SEBIN", color: "#4f46e5" },
  {
    clave: "control_educativo",
    label: "CONTROL EDUCATIVO",
    valorDb: "CONTROL EDUCATIVO - SEBIN",
    color: "#65a30d",
  },
  { clave: "sin_asignar", label: "Sin unidad", valorDb: "", color: "#64748b" },
];

export const META_UNIDAD_SEBIN: Record<ClaveUnidadSebin, MetaUnidadSebin> = Object.fromEntries(
  CATALOGO_UNIDADES_SEBIN.map((u) => [u.clave, u]),
) as Record<ClaveUnidadSebin, MetaUnidadSebin>;

const MAPA_VALOR_DB: Record<string, ClaveUnidadSebin> = Object.fromEntries(
  CATALOGO_UNIDADES_SEBIN.filter((u) => u.valorDb).map((u) => [
    u.valorDb.trim().toLowerCase().replace(/\s+/g, " "),
    u.clave,
  ]),
) as Record<string, ClaveUnidadSebin>;

/** Normaliza el texto de unidad SEBIN a clave canónica. */
export function normalizarUnidadSebin(raw: string | undefined | null): ClaveUnidadSebin {
  if (!raw?.trim()) return "sin_asignar";
  const limpio = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (MAPA_VALOR_DB[limpio]) return MAPA_VALOR_DB[limpio];
  const sinGuion = limpio.replace(/\s*-\s*sebin\s*$/, "").trim();
  for (const u of CATALOGO_UNIDADES_SEBIN) {
    if (!u.valorDb) continue;
    const base = u.valorDb.toLowerCase().replace(/\s*-\s*sebin\s*$/, "").trim();
    if (sinGuion === base || limpio.includes(base)) return u.clave;
  }
  return "sin_asignar";
}

export function metaUnidadSebinDe(raw: string | undefined | null): MetaUnidadSebin {
  return META_UNIDAD_SEBIN[normalizarUnidadSebin(raw)];
}

/** Logo SEBIN compartido por todas las unidades internas. */
export const LOGO_SEBIN = "/logos-cuerpos/sebin.webp";

/** Color de marcadores atenuados al filtrar por otra dirección SEBIN. */
export const COLOR_MARCADOR_ATENUADO = "#52525b";
