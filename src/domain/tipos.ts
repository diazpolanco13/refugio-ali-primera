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

/** Grupos vulnerables (conteo agregado por sector, sin datos nominales). */
export interface Vulnerables {
  ninos: number;
  embarazadas: number;
  adultos_mayores: number;
  discapacidad: number;
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
  poblacion_estimada: number;
  familias: number;
  vulnerables: Vulnerables;
  notas: string;
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
