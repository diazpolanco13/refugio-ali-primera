// Tipos de dominio de la Sala Situacional.

/** Tipos de punto de servicio = capas conmutables del mapa. */
export type TipoPunto =
  | "hidratacion"
  | "comida"
  | "salud"
  | "sanitarios"
  | "duchas"
  | "residuos"
  | "carpa"
  | "recreacion"
  | "seguridad"
  | "energia"
  | "acceso";

export type EstadoPunto = "operativo" | "saturado" | "fuera_servicio";

export type EstadoSector = "verde" | "amarillo" | "rojo";

/**
 * Desglose demográfico del sector por edad y sexo (conteo agregado, sin datos
 * nominales). Los grupos etarios (niñez, adultos, adultos mayores) son
 * excluyentes y suman la población; embarazadas y discapacidad son
 * transversales (subconjuntos que pueden solaparse con los etarios).
 */
export interface Vulnerables {
  // Niñez (0-17)
  ninos: number; // varones
  ninas: number; // niñas
  // Adultos (18-59)
  adultos_h: number;
  adultos_m: number;
  // Adultos mayores (60+)
  adultos_mayores_h: number;
  adultos_mayores_m: number;
  // Grupos transversales
  embarazadas: number;
  discapacidad_h: number;
  discapacidad_m: number;
}

export const VULNERABLES_VACIO: Vulnerables = {
  ninos: 0,
  ninas: 0,
  adultos_h: 0,
  adultos_m: 0,
  adultos_mayores_h: 0,
  adultos_mayores_m: 0,
  embarazadas: 0,
  discapacidad_h: 0,
  discapacidad_m: 0,
};

/** Normaliza un objeto vulnerables tolerando datos viejos o incompletos. */
export function normalizarVulnerables(
  v: Partial<Vulnerables> | null | undefined,
): Vulnerables {
  return { ...VULNERABLES_VACIO, ...(v ?? {}) };
}

/** Total de hombres del sector (suma de grupos etarios masculinos). */
export function totalHombres(v: Vulnerables): number {
  return (v.ninos || 0) + (v.adultos_h || 0) + (v.adultos_mayores_h || 0);
}

/** Total de mujeres del sector (suma de grupos etarios femeninos). */
export function totalMujeres(v: Vulnerables): number {
  return (v.ninas || 0) + (v.adultos_m || 0) + (v.adultos_mayores_m || 0);
}

/** Población total del sector según el desglose por edad y sexo. */
export function totalPoblacion(v: Vulnerables): number {
  return totalHombres(v) + totalMujeres(v);
}

/**
 * Total de personas en grupos vulnerables prioritarios: niñez, adultos
 * mayores, embarazadas y personas con discapacidad (excluye adultos 18-59
 * sin condición). Es un estimado: puede haber solapamiento entre grupos.
 */
export function totalVulnerables(v: Vulnerables): number {
  return (
    (v.ninos || 0) +
    (v.ninas || 0) +
    (v.adultos_mayores_h || 0) +
    (v.adultos_mayores_m || 0) +
    (v.embarazadas || 0) +
    (v.discapacidad_h || 0) +
    (v.discapacidad_m || 0)
  );
}

/** Suma el desglose demográfico de varios sectores. */
export function sumarVulnerables(sectores: { vulnerables?: Partial<Vulnerables> | null }[]): Vulnerables {
  const total = { ...VULNERABLES_VACIO };
  for (const s of sectores) {
    const v = normalizarVulnerables(s.vulnerables);
    (Object.keys(total) as (keyof Vulnerables)[]).forEach((k) => {
      total[k] += v[k] || 0;
    });
  }
  return total;
}

/** Categoría del responsable, para saber a qué cuerpo/rol pertenece. */
export type CategoriaResponsable =
  | "funcionario"
  | "voluntario"
  | "policia"
  | "militar"
  | "bombero"
  | "proteccion_civil"
  | "salud"
  | "comunidad"
  | "otro";

export const CATEGORIAS_RESPONSABLE: {
  valor: CategoriaResponsable;
  label: string;
  color: string;
}[] = [
  { valor: "funcionario", label: "Funcionario", color: "#3b82f6" },
  { valor: "voluntario", label: "Voluntario", color: "#22c55e" },
  { valor: "policia", label: "Policía", color: "#1d4ed8" },
  { valor: "militar", label: "Militar (GNB/FANB)", color: "#4d7c0f" },
  { valor: "bombero", label: "Bombero", color: "#dc2626" },
  { valor: "proteccion_civil", label: "Protección Civil", color: "#ea580c" },
  { valor: "salud", label: "Personal de salud", color: "#e11d48" },
  { valor: "comunidad", label: "Comunidad", color: "#a855f7" },
  { valor: "otro", label: "Otro", color: "#64748b" },
];

/** Funciones frecuentes (sugerencias para el campo función). */
export const FUNCIONES_COMUNES = [
  "Coordinación general",
  "Censo / registro",
  "Recolección de basura",
  "Sanitarios / baños",
  "Distribución de agua",
  "Distribución de comida",
  "Atención médica",
  "Seguridad",
  "Logística",
  "Recreación / niñez",
  "Energía / iluminación",
];

/** Un responsable asignado a una función dentro de un sector. */
export interface Responsable {
  id: string;
  nombre: string;
  telefono: string;
  categoria: CategoriaResponsable;
  /** Función/rol: "Recolección de basura", "Baños", "Censo", etc. */
  funcion: string;
}

/** Paleta para colorear sectores de forma distinguible. */
export const SECTOR_COLORES = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#64748b",
];

export interface Sector {
  id: string;
  nombre: string;
  /** Polígono GeoJSON en [lng, lat]. */
  geom: GeoJSON.Polygon;
  /** Color del sector (personalizable). */
  color: string;
  /** Responsables por función (basura, baños, censo, coordinación…). */
  responsables: Responsable[];
  /** Carpas/contenedores familiares contados en el recorrido inicial del sector. */
  carpas: number;
  /** Suma del desglose demográfico (se calcula al guardar). */
  poblacion_estimada: number;
  familias: number;
  vulnerables: Vulnerables;
  notas: string;
  updated_at: number;
  updated_by: string;
}

/**
 * Foto (snapshot) del censo de un sector en un instante dado. Registro
 * histórico append-only: nunca se edita, solo se añaden nuevas filas. Permite
 * reconstruir la evolución poblacional del refugio por fechas (entradas/salidas).
 */
export interface CensoSnapshot {
  id: string;
  /** Sector al que pertenece la foto. */
  sector_id: string;
  /** Nombre del sector al momento de la foto (por si luego cambia/desaparece). */
  sector_nombre: string;
  /** Momento del censo (ms). Se agrupa por día en el dashboard. */
  ts: number;
  poblacion: number;
  familias: number;
  carpas: number;
  vulnerables: Vulnerables;
  updated_at: number;
  updated_by: string;
}

export interface PuntoServicio {
  id: string;
  tipo: TipoPunto;
  nombre: string;
  /** Punto GeoJSON en [lng, lat]. */
  geom: GeoJSON.Point;
  estado: EstadoPunto;
  /** Capacidad/aforo del punto (personas, baños, camas, funcionarios… según tipo). */
  capacidad: number;
  /** Solo seguridad/salud: organismo (PNB, GNB, Bomberos…). */
  organismo?: string;
  /** Solo seguridad: movilidad (a_pie, moto, patrulla…). */
  movilidad?: string;
  /** Solo baños/duchas: género (hombres, mujeres, mixto). */
  genero?: string;
  /** Solo baños/duchas: condición (estandar, improvisada). */
  condicion?: string;
  /** Baños/duchas/basura: cada cuántas horas debe limpiarse/recogerse. */
  frecuenciaLimpiezaHoras?: number;
  /** Timestamp (ms) de la última limpieza/recolección marcada. */
  ultimaLimpieza?: number;
  notas: string;
  updated_at: number;
  updated_by: string;
}

export const ESTADOS_PUNTO: { valor: EstadoPunto; label: string; color: string }[] = [
  { valor: "operativo", label: "Operativo", color: "#22c55e" },
  { valor: "saturado", label: "Saturado", color: "#f59e0b" },
  { valor: "fuera_servicio", label: "Fuera de servicio", color: "#ef4444" },
];

export const ESTADO_SECTOR_COLOR: Record<EstadoSector, string> = {
  verde: "#22c55e",
  amarillo: "#f59e0b",
  rojo: "#ef4444",
};

/** Metadatos de cada capa: etiqueta, ícono y color de marcador. */
export interface MetaTipo {
  tipo: TipoPunto;
  label: string;
  icono: string;
  color: string;
  /** Unidad de la capacidad para el formulario. */
  unidadCapacidad: string;
}

export const CATALOGO_TIPOS: MetaTipo[] = [
  { tipo: "hidratacion", label: "Hidratación / Agua", icono: "💧", color: "#38bdf8", unidadCapacidad: "personas/día" },
  { tipo: "comida", label: "Comida / Comedor", icono: "🍲", color: "#fb923c", unidadCapacidad: "raciones" },
  { tipo: "salud", label: "Atención médica", icono: "⚕️", color: "#f43f5e", unidadCapacidad: "camas/puestos" },
  { tipo: "sanitarios", label: "Sanitarios / Baños", icono: "🚽", color: "#a78bfa", unidadCapacidad: "baños" },
  { tipo: "duchas", label: "Duchas", icono: "🚿", color: "#06b6d4", unidadCapacidad: "duchas" },
  { tipo: "residuos", label: "Residuos / Basura", icono: "🗑️", color: "#84cc16", unidadCapacidad: "contenedores" },
  { tipo: "carpa", label: "Carpa / Campamento", icono: "⛺", color: "#facc15", unidadCapacidad: "personas" },
  { tipo: "recreacion", label: "Recreación / Niñez", icono: "🛝", color: "#2dd4bf", unidadCapacidad: "personas" },
  { tipo: "seguridad", label: "Seguridad / Mando", icono: "👮", color: "#60a5fa", unidadCapacidad: "funcionarios" },
  { tipo: "energia", label: "Energía / Iluminación", icono: "💡", color: "#fde047", unidadCapacidad: "puntos de luz" },
  { tipo: "acceso", label: "Acceso / Salida", icono: "🚪", color: "#cbd5e1", unidadCapacidad: "" },
];

/** Movilidad de un punto de seguridad. */
export const MOVILIDADES: { valor: string; label: string; icono: string }[] = [
  { valor: "a_pie", label: "A pie", icono: "🚶" },
  { valor: "moto", label: "Moto", icono: "🏍️" },
  { valor: "patrulla", label: "Patrulla", icono: "🚓" },
  { valor: "bicicleta", label: "Bicicleta", icono: "🚲" },
  { valor: "camion", label: "Camión / Unidad", icono: "🚚" },
];

export const MOVILIDAD_ICONO: Record<string, string> = Object.fromEntries(
  MOVILIDADES.map((m) => [m.valor, m.icono]),
);
export const MOVILIDAD_LABEL: Record<string, string> = Object.fromEntries(
  MOVILIDADES.map((m) => [m.valor, m.label]),
);

/** Género de baños/duchas (segregación por sexo, recomendada por Esfera). */
export const GENEROS: { valor: string; label: string; icono: string }[] = [
  { valor: "hombres", label: "Hombres", icono: "🚹" },
  { valor: "mujeres", label: "Mujeres", icono: "🚺" },
  { valor: "mixto", label: "Mixto", icono: "🚻" },
];
export const GENERO_ICONO: Record<string, string> = Object.fromEntries(
  GENEROS.map((g) => [g.valor, g.icono]),
);
export const GENERO_LABEL: Record<string, string> = Object.fromEntries(
  GENEROS.map((g) => [g.valor, g.label]),
);

/** Condición de baños/duchas: cumple estándar o improvisada. */
export const CONDICIONES: { valor: string; label: string }[] = [
  { valor: "estandar", label: "Cumple estándar" },
  { valor: "improvisada", label: "Improvisada" },
];
export const CONDICION_LABEL: Record<string, string> = Object.fromEntries(
  CONDICIONES.map((c) => [c.valor, c.label]),
);

/** Organismos frecuentes (sugerencias para puntos de seguridad/salud). */
export const ORGANISMOS_COMUNES = [
  "PNB (Policía Nacional)",
  "GNB / FANB",
  "PoliCaracas",
  "CICPC",
  "Protección Civil",
  "Bomberos",
  "Milicia Bolivariana",
  "Guardia del Pueblo",
];

export const META_POR_TIPO: Record<TipoPunto, MetaTipo> = Object.fromEntries(
  CATALOGO_TIPOS.map((m) => [m.tipo, m]),
) as Record<TipoPunto, MetaTipo>;

/** Centro del Parque del Oeste "Alí Primera", Caracas. */
export const PARQUE_CENTRO: [number, number] = [-66.939458, 10.5141373];
export const PARQUE_ZOOM = 16.5;

/** Líneas de referencia cartográfica (límites, calles, caminerías). Sin relleno. */
export type TipoLinea = "limite_parque" | "calle" | "camineria";

export type EstiloTrazo = "solido" | "punteado" | "guiones";

export interface LineaReferencia {
  id: string;
  nombre: string;
  tipo: TipoLinea;
  /** LineString GeoJSON en [lng, lat]. */
  geom: GeoJSON.LineString;
  color: string;
  estilo: EstiloTrazo;
  /** Grosor del trazo en píxeles (MapLibre). */
  ancho: number;
  notas: string;
  updated_at: number;
  updated_by: string;
}

export interface MetaTipoLinea {
  tipo: TipoLinea;
  label: string;
  icono: string;
  color: string;
  estilo: EstiloTrazo;
  ancho: number;
}

export const CATALOGO_LINEAS: MetaTipoLinea[] = [
  {
    tipo: "limite_parque",
    label: "Límite del parque",
    icono: "⬚",
    color: "#fbbf24",
    estilo: "punteado",
    ancho: 3,
  },
  {
    tipo: "calle",
    label: "Calle / vía",
    icono: "═",
    color: "#e2e8f0",
    estilo: "solido",
    ancho: 2.5,
  },
  {
    tipo: "camineria",
    label: "Caminería / sendero",
    icono: "╌",
    color: "#94a3b8",
    estilo: "guiones",
    ancho: 2,
  },
];

export const META_LINEA_POR_TIPO: Record<TipoLinea, MetaTipoLinea> = Object.fromEntries(
  CATALOGO_LINEAS.map((m) => [m.tipo, m]),
) as Record<TipoLinea, MetaTipoLinea>;

/** Valores por defecto de apariencia según el tipo de línea. */
export function defaultsLinea(tipo: TipoLinea): Pick<LineaReferencia, "color" | "estilo" | "ancho"> {
  const m = META_LINEA_POR_TIPO[tipo];
  return { color: m.color, estilo: m.estilo, ancho: m.ancho };
}
