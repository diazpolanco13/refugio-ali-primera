import type { TipoPunto } from "./tipos";

// Estándares humanitarios de referencia (Esfera / Sphere Handbook 2018).
// CONFIGURABLES: son valores por defecto; validar y ajustar según el contexto.
// Cada entrada indica cuántas personas (o familias) cubre UNA unidad operativa
// del servicio. Ej: 1 punto de agua cubre 250 personas.

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

/** Litros de agua por persona/día recomendados (Esfera). */
export const AGUA_LITROS_PERSONA_DIA = 15;

/** m² cubiertos mínimos por persona (Esfera). */
export const M2_CUBIERTOS_POR_PERSONA = 3.5;
