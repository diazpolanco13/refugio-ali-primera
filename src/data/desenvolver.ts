// Helper para desenvolver filas de las tablas blob+jsonb de Supabase.
//
// Las tablas sincronizables (`sectores`, `puntos`, `lineas`, `censos`,
// `distribuciones`, `limpiezas`, `centros`) guardan el objeto de dominio dentro
// de una columna `data` jsonb, más los metadatos `id`, `updated_at`,
// `updated_by`, `deleted` a nivel de fila. El frontend necesita acceder a los
// campos del dominio (p. ej. `centro.nro`, `centro.nombre`) como si estuvieran
// en la raíz. Este helper aplana `data` y le sobrescribe `id`/`updated_at`/
// `updated_by`/`deleted` con los de la fila, para que el consumidor trabaje con
// el objeto de dominio ya "desenvuelto".
//
// Se usa junto a `useSupabaseQuery<T>(tabla, { transform: desenvolver })`.

import { normalizarGeom } from "./normalizarGeom";

/** Fila cruda que devuelve Supabase para una tabla blob+jsonb. */
export interface FilaSync<T> {
  [k: string]: unknown;
  id: string;
  updated_at: number;
  updated_by?: string | null;
  deleted: boolean;
  data: T;
}

/**
 * Aplana una fila blob `{ id, updated_at, updated_by, deleted, data, ... }` al
 * tipo de dominio `T`, sobrescribiendo los metadatos con los de la fila. Si
 * `data` trae su propio `id`/`updated_at`/`updated_by` (típico en el blob), el
 * de la fila gana para garantizar consistencia.
 *
 * Además de `data`, preserva cualquier otra columna top-level de la fila que no
 * viva dentro del jsonb (p. ej. `geom` geography en `centros`). Sin esto, los
 * campos fuera del blob se perderían al desenvolver.
 */
export function desenvolver<T extends object>(fila: FilaSync<T>): T & {
  id: string;
  updated_at: number;
  updated_by: string | null;
  deleted: boolean;
} {
  // Separar `data` del resto de columnas top-level (id, updated_at, geom, ...).
  const { data, geom, ...rest } = fila;
  // PostgREST serializa `geography(Point, 4326)` como hex EWKB; el frontend
  // (MapLibre) espera un GeoJSON Point. Normalizamos aquí para que cualquier
  // consumidor de `centros` reciba `geom` en formato `{type,coordinates}`.
  const geomNormalizada = "geom" in fila ? normalizarGeom(geom) : undefined;
  return {
    ...data,
    ...rest,
    ...(geomNormalizada !== undefined ? { geom: geomNormalizada } : {}),
    id: fila.id,
    updated_at: fila.updated_at,
    updated_by: fila.updated_by ?? null,
    deleted: fila.deleted,
  };
}
