// Bitácora de acciones (tabla `historial`). Dos piezas:
//
//  · `registrarHistorial()` — inserta una entrada tras cada acción crítica
//    (crear/editar/eliminar centro, abrir/resolver incidencia, reporte
//    diario). Fire-and-forget: NUNCA rompe la acción principal si falla. Las
//    acciones sobre usuarios se registran desde las Edge Functions con
//    service_role (el frontend no las duplica).
//  · `useHistorial()` — lectura con Realtime para la vista /logs. La RLS solo
//    deja LEER a admin y autoridad; los roles operativos insertan sin leer.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { getUsuario } from "./authSupabase";

/** Acciones registradas por el frontend (las Edge Functions añaden las de usuarios). */
export type AccionHistorial =
  | "crear_centro"
  | "editar_centro"
  | "eliminar_centro"
  | "abrir_incidencia"
  | "editar_incidencia"
  | "resolver_incidencia"
  | "eliminar_incidencia"
  | "reporte_diario"
  | "crear_usuario"
  | "eliminar_usuario"
  | "cambiar_password"
  | (string & {});

/** Fila de la tabla `historial`. */
export interface EntradaHistorial {
  id: string;
  ts: number;
  usuario: string | null;
  accion: AccionHistorial;
  entidad: string | null;
  entidad_id: string | null;
  detalle: Record<string, unknown> | null;
}

/**
 * Inserta una entrada en la bitácora. Nunca lanza: si falla (p. ej. RLS para
 * un rol sin permiso de insert, o sin conexión) solo lo avisa por consola,
 * porque la bitácora no debe tumbar la acción que la origina.
 */
export function registrarHistorial(
  accion: AccionHistorial,
  entidad: string,
  entidadId: string,
  detalle?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      const { error } = await supabase.from("historial").insert({
        ts: Date.now(),
        usuario: getUsuario()?.username ?? "local",
        accion,
        entidad,
        entidad_id: entidadId,
        detalle: detalle ?? null,
      });
      if (error) console.warn("[historial] insert:", error.message);
    } catch (err) {
      console.warn("[historial] insert:", err);
    }
  })();
}

/**
 * Entradas de la bitácora (más recientes primero) con Realtime. Pensado para
 * la vista /logs (solo admin y autoridad pueden leer; para el resto la RLS
 * devuelve vacío). Filtros server-side por rango de fechas; los filtros por
 * entidad/usuario se aplican en el cliente (el volumen es moderado).
 */
export function useHistorial({ desdeTs, limite = 500 }: { desdeTs?: number; limite?: number } = {}) {
  const [entradas, setEntradas] = useState<EntradaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      let q = supabase
        .from("historial")
        .select("*")
        .order("ts", { ascending: false })
        .limit(limite);
      if (desdeTs) q = q.gte("ts", desdeTs);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useHistorial] select:", error.message);
        setEntradas([]);
      } else {
        setEntradas((data ?? []) as EntradaHistorial[]);
      }
      setCargando(false);
    })();

    const canal = supabase
      .channel(`historial-logs-${desdeTs ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "historial" },
        (payload) => {
          const fila = payload.new as EntradaHistorial;
          if (desdeTs && fila.ts < desdeTs) return;
          setEntradas((prev) =>
            prev.some((e) => e.id === fila.id) ? prev : [fila, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(canal);
    };
  }, [desdeTs, limite]);

  return { entradas, cargando };
}
