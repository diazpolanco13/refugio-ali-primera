import type { TipoPunto } from "./tipos";

// Estándares humanitarios de referencia (Esfera / Sphere Handbook 2018).
// CONFIGURABLES: son valores por defecto; validar y ajustar según el contexto.
// Cada entrada indica cuántas personas (o familias) cubre UNA unidad operativa
// del servicio. Ej: 1 punto de agua cubre 250 personas.
//
// NOTA: la cobertura se calcula a nivel de TODO EL PARQUE (población total del
// refugio) — no por sector — porque los puntos (agua, letrinas, duchas, comida,
// basura) están en ubicaciones fijas del parque y no dentro de cada sector.

export interface EstandarServicio {
  tipo: TipoPunto;
  /** Personas (o familias) que cubre una unidad operativa. */
  personasPorUnidad: number;
  /** Si el denominador es familias en vez de personas. */
  base: "personas" | "familias";
  /** Si es un servicio esencial que determina el semáforo del sector. */
  esencial: boolean;
  descripcion: string;
}

export const ESTANDARES: Partial<Record<TipoPunto, EstandarServicio>> = {
  hidratacion: {
    tipo: "hidratacion",
    personasPorUnidad: 250,
    base: "personas",
    esencial: true,
    descripcion: "1 punto de agua por cada 250 personas (Esfera).",
  },
  sanitarios: {
    tipo: "sanitarios",
    personasPorUnidad: 20,
    base: "personas",
    esencial: true,
    descripcion: "1 baño/letrina por cada 20 personas (Esfera).",
  },
  duchas: {
    tipo: "duchas",
    personasPorUnidad: 50,
    base: "personas",
    esencial: false,
    descripcion: "1 ducha por cada 50 personas (Esfera).",
  },
  salud: {
    tipo: "salud",
    personasPorUnidad: 500,
    base: "personas",
    esencial: true,
    descripcion: "1 puesto de atención por cada 500 personas (referencia).",
  },
  comida: {
    tipo: "comida",
    personasPorUnidad: 500,
    base: "personas",
    esencial: false,
    descripcion: "1 punto de comida por cada 500 personas (referencia).",
  },
  residuos: {
    tipo: "residuos",
    personasPorUnidad: 10,
    base: "familias",
    esencial: false,
    descripcion: "1 contenedor por cada 10 familias (Esfera).",
  },
};

/**
 * Ventanas horarias de las comidas principales (hora local, decimal: 11.5 =
 * 11:30). Se usan para disparar alertas si, pasada la ventana, no se registró
 * la hora de llegada de esa comida en el día.
 */
export type Comida = "desayuno" | "almuerzo" | "cena";

export const VENTANAS_COMIDA: Record<
  Comida,
  { inicio: number; fin: number; label: string }
> = {
  desayuno: { inicio: 6, fin: 9, label: "Desayuno" },
  almuerzo: { inicio: 11.5, fin: 14.5, label: "Almuerzo" },
  cena: { inicio: 17.5, fin: 20.5, label: "Cena" },
};

/** Litros de agua por persona/día recomendados (Esfera) — uso doméstico total
 *  (aseo, pocetas, cocina, bebida y lavado de ropa). */
export const AGUA_LITROS_PERSONA_DIA = 15;

/** Litros mínimos de agua potable (bebida y preparación de alimentos) por
 *  persona/día (Esfera / referencia OMS en emergencias). */
export const AGUA_POTABLE_LITROS_PERSONA_DIA = 3;

/** Comidas principales servidas por persona/día (desayuno, almuerzo, cena). */
export const COMIDAS_POR_PERSONA_DIA = 3;

/** Demanda diaria de agua según estándares Esfera para una población dada. */
export function demandaAguaDia(personas: number): {
  potableL: number;
  usoCotidianoL: number;
} {
  return {
    potableL: personas * AGUA_POTABLE_LITROS_PERSONA_DIA,
    usoCotidianoL: personas * AGUA_LITROS_PERSONA_DIA,
  };
}

/** m² cubiertos mínimos por persona (Esfera). */
export const M2_CUBIERTOS_POR_PERSONA = 3.5;
