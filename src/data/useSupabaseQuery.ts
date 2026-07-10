// Hook de consulta para la nueva capa de datos (Fase 3 de la migración).
// Reemplaza a `useLiveQuery` de Dexie: carga inicial vía `supabase.from(...).select()`
// y mantiene el estado local sincronizado con la tabla vía Realtime
// (`postgres_changes`).
//
// Limitación conocida: el `filter` (function) se aplica al QueryBuilder para la
// carga inicial, pero NO se puede re-aplicar en el cliente a los eventos
// Realtime (no se serializa). Para esos casos usar `clientFilter`, que sí se
// evalúa en cada fila entrante (insert/update). Los updates/deletes se manejan
// por `id` sin necesidad de filtro.

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * Builder devuelto por `supabase.from(tabla).select(...)`. Lo tipamos de forma
 * estructural (todo lo que el `filter` del consumidor pueda encadenar) para no
 * acoplarnos a la parametrización genérica interna de supabase-js.
 */
export type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  neq: (column: string, value: unknown) => QueryBuilder<T>;
  gt: (column: string, value: unknown) => QueryBuilder<T>;
  gte: (column: string, value: unknown) => QueryBuilder<T>;
  lt: (column: string, value: unknown) => QueryBuilder<T>;
  lte: (column: string, value: unknown) => QueryBuilder<T>;
  like: (column: string, pattern: string) => QueryBuilder<T>;
  ilike: (column: string, pattern: string) => QueryBuilder<T>;
  in: (column: string, values: readonly unknown[]) => QueryBuilder<T>;
  order: (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  filter: (column: string, operator: string, value: unknown) => QueryBuilder<T>;
  // Promise-like: el await resuelve en { data, error }.
  then: <U>(onFulfilled: (value: { data: T[] | null; error: unknown }) => U | PromiseLike<U>) => Promise<U>;
};

export interface UseSupabaseQueryOptions<T, R = T> {
  /** Modifica el query inicial (eq, neq, gte, order, etc.). Default: sin filtros. */
  filter?: (q: QueryBuilder<R>) => QueryBuilder<R>;
  /** Orden de la carga inicial. Default: sin orden (Supabase devuelve por PK). */
  order?: { column: string; ascending?: boolean };
  /** Columnas a seleccionar. Default: "*". */
  select?: string;
  /**
   * Transforma cada fila cruda `R` (tal cual la devuelve Supabase) al tipo `T`
   * que consume el componente. Útil para las tablas blob+jsonb, donde el objeto
   * de dominio vive dentro de `data` y se aplana con `desenvolver(...)`.
   * Se aplica tanto a la carga inicial como a cada evento Realtime, antes de
   * `clientFilter`.
   */
  transform?: (raw: R) => T;
  /**
   * Filtro en cliente para eventos Realtime (insert/update). El `filter` del
   * QueryBuilder no se puede re-aplicar aquí; si la suscripción trae filas que
   * el `filter` inicial habría excluido, usar este callback para descartarlas.
   * Se evalúa sobre la fila ya transformada (si se pasó `transform`).
   */
  clientFilter?: (row: T) => boolean;
}

export interface UseSupabaseQueryEstado<T> {
  datos: T[];
  /** `true` solo hasta la primera resolución (éxito o error). Realtime no lo reactiva. */
  cargando: boolean;
  error: unknown | null;
}

/**
 * Variante con estado de carga/error. Preferir esta cuando la vista muestra skeleton.
 */
export function useSupabaseQueryConEstado<
  T extends { id: string },
  R extends Record<string, unknown> = T & Record<string, unknown>,
>(
  tabla: string,
  options: UseSupabaseQueryOptions<T, R> = {},
): UseSupabaseQueryEstado<T> {
  const { filter, order, select = "*", transform, clientFilter } = options;
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const clientFilterRef = useRef(clientFilter);
  clientFilterRef.current = clientFilter;
  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    let cancelado = false;
    const channelName = `useSupabaseQuery:${tabla}:${Math.random().toString(36).slice(2)}`;
    setCargando(true);
    setError(null);

    (async () => {
      let query = supabase.from(tabla).select(select) as unknown as QueryBuilder<R>;
      if (filter) query = filter(query);
      if (order) query = query.order(order.column, { ascending: order.ascending ?? true });
      const result = await query;
      if (cancelado) return;
      if (result.error) {
        console.warn(`[useSupabaseQuery:${tabla}] error en select:`, result.error);
        setError(result.error);
        setDatos([]);
        setCargando(false);
        return;
      }
      const arr = (result.data ?? []) as R[];
      const procesados = arr.map((r) =>
        transformRef.current ? transformRef.current(r) : (r as unknown as T),
      );
      const filtrado = clientFilterRef.current
        ? procesados.filter(clientFilterRef.current)
        : procesados;
      setDatos(filtrado);
      setError(null);
      setCargando(false);
    })();

    const channel = supabase
      .channel(channelName)
      .on<R>(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla },
        (payload) => {
          const cf = clientFilterRef.current;
          const tf = transformRef.current;
          if (payload.eventType === "INSERT") {
            const crudo = payload.new as R;
            const fila = (tf ? tf(crudo) : (crudo as unknown as T)) as T;
            if (cf && !cf(fila)) return;
            setDatos((prev) =>
              prev.some((r) => r.id === fila.id) ? prev : [...prev, fila],
            );
          } else if (payload.eventType === "UPDATE") {
            const crudo = payload.new as R;
            const fila = (tf ? tf(crudo) : (crudo as unknown as T)) as T;
            setDatos((prev) => prev.map((r) => (r.id === fila.id ? fila : r)));
            if (cf && !cf(fila)) {
              setDatos((prev) => prev.filter((r) => r.id !== fila.id));
            }
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setDatos((prev) => prev.filter((r) => r.id !== fila.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(`[useSupabaseQuery:${tabla}] error de suscripción Realtime`);
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [tabla, select, filter, order?.column, order?.ascending]);

  return { datos, cargando, error };
}

/**
 * Consulta tipada que devuelve solo el array (API histórica).
 * Para skeletons usar `useSupabaseQueryConEstado`.
 */
export function useSupabaseQuery<
  T extends { id: string },
  R extends Record<string, unknown> = T & Record<string, unknown>,
>(tabla: string, options: UseSupabaseQueryOptions<T, R> = {}): T[] {
  return useSupabaseQueryConEstado<T, R>(tabla, options).datos;
}
