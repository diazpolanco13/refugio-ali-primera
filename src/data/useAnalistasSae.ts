import { useCallback } from "react";
import { useSupabaseQuery, type QueryBuilder } from "./useSupabaseQuery";

/** Perfil resumido de un analista SAE (catálogo de usuarios para asignación). */
export interface AnalistaSae {
  id: string;
  user_id: string;
  username: string | null;
  nombre: string | null;
  /** Ámbito legado en el perfil; la fuente operativa es `supervision.analistas_sae`. */
  centros_asignados: string[];
}

interface PerfilAnalistaRow extends Record<string, unknown> {
  user_id: string;
  username: string | null;
  nombre: string | null;
  centros_asignados: string[] | null;
  rol: string;
}

function filtrarAnalistasSae<T>(q: QueryBuilder<T>): QueryBuilder<T> {
  return q.eq("rol", "analista_sae");
}

function transformarAnalistaSae(r: PerfilAnalistaRow): AnalistaSae {
  return {
    id: r.user_id,
    user_id: r.user_id,
    username: r.username,
    nombre: r.nombre,
    centros_asignados: Array.isArray(r.centros_asignados)
      ? r.centros_asignados
      : [],
  };
}

function esAnalistaSae(row: AnalistaSae): boolean {
  return Boolean(row.user_id);
}

/** Lista de analistas SAE con Realtime (asignación operativa y filtro del tablero). */
export function useAnalistasSae(): AnalistaSae[] {
  // Referencias estables: si `filter`/`transform` cambian de identidad en cada
  // render, useSupabaseQuery re-fetcha y puede dejar el filtro de UI sin efecto.
  const filter = useCallback(filtrarAnalistasSae, []);
  const transform = useCallback(transformarAnalistaSae, []);
  const clientFilter = useCallback(esAnalistaSae, []);

  return useSupabaseQuery<AnalistaSae, PerfilAnalistaRow>("perfiles", {
    select: "user_id, username, nombre, centros_asignados, rol",
    filter,
    order: { column: "nombre", ascending: true },
    transform,
    clientFilter,
  });
}

export function etiquetaAnalistaSae(
  analista: Pick<AnalistaSae, "nombre" | "username">,
): string {
  const nombre = analista.nombre?.trim();
  if (nombre) return nombre;
  if (analista.username) return `@${analista.username}`;
  return "Sin nombre";
}

/**
 * Campamentos donde este analista figura en `supervision.analistas_sae`
 * (asignación operativa del centro).
 */
export function contarCentrosConAnalista(
  userId: string,
  centros: ReadonlyArray<{ supervision?: { analistas_sae?: string[] } | null }>,
): number {
  let n = 0;
  for (const c of centros) {
    if (c.supervision?.analistas_sae?.includes(userId)) n++;
  }
  return n;
}
