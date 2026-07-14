// Progreso del reporte diario (0-6 fases) de todos los campamentos, hoy.
// Lee la vista `estado_reporte_hoy` (security_invoker: respeta la RLS de
// centros/ocupaciones_centros/reportes_centros/reportes_control_dia, así que
// un supervisor solo ve sus centros asignados, igual que el resto del mapa).
//
// Importante: cada fase solo prueba que el operador la guardó/confirmó hoy,
// no que haya cambiado un dato real — "confirmar sin cambios" también cuenta
// (ver BloqueConfirmacionReporte). Es una señal de "reporte abierto/pasado
// revista", no de "verificado".

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { suscribirMutacionLive } from "./liveInvalidation";

export interface EstadoReporteHoyCentro {
  centro_id: string;
  parte_ok: boolean;
  salud_ok: boolean;
  control_ok: boolean;
  trabajos_ok: boolean;
  requerimientos_ok: boolean;
  novedades_ok: boolean;
}

const FASES = [
  "parte_ok",
  "salud_ok",
  "control_ok",
  "trabajos_ok",
  "requerimientos_ok",
  "novedades_ok",
] as const;

export const TOTAL_FASES_REPORTE_DIA = FASES.length;

/** Cuántas de las 6 fases del reporte diario quedaron marcadas hoy (0-6). */
export function fasesCompletadasHoy(estado: EstadoReporteHoyCentro | undefined): number {
  if (!estado) return 0;
  return FASES.reduce((n, fase) => n + (estado[fase] ? 1 : 0), 0);
}

/** Tablas que alimentan la vista: cualquier mutación en ellas invalida el estado de hoy. */
const TABLAS_ORIGEN = ["reportes_centros", "reportes_control_dia", "ocupaciones_centros"] as const;

/** `centroId`: limita la consulta a un solo centro (para el popup del mapa). Sin filtro = toda la red. */
export function useEstadoReporteHoy(centroId?: string): Map<string, EstadoReporteHoyCentro> {
  const [estados, setEstados] = useState<Map<string, EstadoReporteHoyCentro>>(new Map());

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      let q = supabase.from("estado_reporte_hoy").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useEstadoReporteHoy] error en select:", error.message);
        return;
      }
      setEstados(
        new Map(
          ((data ?? []) as EstadoReporteHoyCentro[]).map((fila) => [fila.centro_id, fila]),
        ),
      );
    }

    void cargar();
    const unsubs = TABLAS_ORIGEN.map((tabla) => suscribirMutacionLive(tabla, () => void cargar()));

    const channel = supabase
      .channel(`useEstadoReporteHoy:${centroId ?? "red"}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reportes_centros" }, () =>
        void cargar(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes_control_dia" },
        () => void cargar(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ocupaciones_centros" },
        () => void cargar(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useEstadoReporteHoy] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      unsubs.forEach((unsub) => unsub());
      void supabase.removeChannel(channel);
    };
  }, [centroId]);

  return estados;
}
