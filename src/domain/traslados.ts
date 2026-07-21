// Dominio de traslados formales entre campamentos.

/** Miembro movido en un traslado (payload JSONB de la tabla/RPC). */
export interface MiembroTraslado {
  refugiado_id: string;
  alojamiento_origen_id: string;
  alojamiento_destino_id: string;
  es_jefe_familia: boolean;
}

/** Origen del registro en tabla `traslados`. */
export type FuenteTraslado = "wizard" | "censo_nominal";

/** Persona resuelta para mostrar en historial enriquecido. */
export interface PersonaTrasladoVista {
  refugiado_id: string;
  nombre: string;
  cedula: string | null;
  tipo_doc: string | null;
  es_jefe_familia: boolean;
}

/** Fila de historial `traslados`. */
export interface Traslado {
  id: string;
  familia_id_origen: string | null;
  familia_id_destino: string | null;
  centro_origen: string;
  centro_destino: string;
  motivo: string;
  miembros: MiembroTraslado[];
  creada_ts: number;
  creada_por: string;
  fuente: FuenteTraslado;
}

/** Traslado con nombres/cédulas de miembros resueltos. */
export interface TrasladoEnriquecido extends Traslado {
  personas: PersonaTrasladoVista[];
}

/** Persona activa en un hogar candidato a traslado. */
export interface MiembroHogarTraslado {
  alojamiento_id: string;
  refugiado_id: string;
  nombre: string;
  cedula: string | null;
  tipo_doc: string | null;
  es_jefe_familia: boolean;
  parentesco_jefe: string;
  estado: string;
}

/**
 * Hogar trasladable: familia con N miembros, o persona sola
 * (`familia_id` null → se usa `alojamiento_id` en la RPC).
 */
export interface HogarTrasladable {
  clave: string;
  familia_id: string | null;
  /** Solo cuando no hay familia (persona sola). */
  alojamiento_id: string | null;
  centro_id: string;
  centro_nombre?: string;
  nombre_hogar: string;
  /** Alojamiento de la persona buscada (pre-selección en UI). */
  referencia_alojamiento_id?: string | null;
  miembros: MiembroHogarTraslado[];
}

/** Candidato devuelto por búsqueda por nombre (máx. 20). */
export interface CandidatoTrasladoNombre {
  alojamiento_id: string;
  refugiado_id: string;
  nombre: string;
  cedula: string | null;
  tipo_doc: string | null;
  sexo: string | null;
  edad: number | null;
  centro_id: string;
  centro_nombre: string;
}

export interface FiltrosTrasladoNombre {
  nombres?: string;
  apellidos?: string;
  sexo?: string | null;
  edadMin?: number | null;
  edadMax?: number | null;
}

export interface ResultadoTraslado {
  traslado_id: string;
  familia_id_destino: string;
  miembros: MiembroTraslado[];
  centro_origen: string;
  centro_destino: string;
}

export interface InputEjecutarTraslado {
  centroOrigen: string;
  centroDestino: string;
  motivo: string;
  alojamientoIds: string[];
  /** Persona buscada / referencia para jefe si el líder no viaja. */
  jefeAlojamientoId?: string | null;
  fecha?: string | null;
}

export function normalizarMiembroTraslado(raw: unknown): MiembroTraslado {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    refugiado_id: String(m.refugiado_id ?? ""),
    alojamiento_origen_id: String(m.alojamiento_origen_id ?? ""),
    alojamiento_destino_id: String(m.alojamiento_destino_id ?? ""),
    es_jefe_familia: Boolean(m.es_jefe_familia),
  };
}

export function normalizarFuenteTraslado(raw: unknown): FuenteTraslado {
  return raw === "censo_nominal" ? "censo_nominal" : "wizard";
}

export function etiquetaFuenteTraslado(fuente: FuenteTraslado): string {
  return fuente === "censo_nominal" ? "Censo" : "Wizard";
}

export function normalizarTraslado(raw: Record<string, unknown>): Traslado {
  const miembrosRaw = Array.isArray(raw.miembros) ? raw.miembros : [];
  return {
    id: String(raw.id ?? ""),
    familia_id_origen: raw.familia_id_origen
      ? String(raw.familia_id_origen)
      : null,
    familia_id_destino: raw.familia_id_destino
      ? String(raw.familia_id_destino)
      : null,
    centro_origen: String(raw.centro_origen ?? ""),
    centro_destino: String(raw.centro_destino ?? ""),
    motivo: String(raw.motivo ?? ""),
    miembros: miembrosRaw.map(normalizarMiembroTraslado),
    creada_ts: Number(raw.creada_ts ?? 0),
    creada_por: String(raw.creada_por ?? ""),
    fuente: normalizarFuenteTraslado(raw.fuente),
  };
}
