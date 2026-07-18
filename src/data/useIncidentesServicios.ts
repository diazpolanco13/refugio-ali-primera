// Incidentes de servicios (`incidentes_servicios`) con Realtime, mismo patrón
// que useOcupacionesCentros. La RLS limita la lectura a admin / analista_sae /
// autoridad (para el resto el select devuelve vacío).

import { useMemo } from "react";
import type { IncidenteServicio } from "@/domain/estadoServicios";
import {
  useSupabaseQueryConEstado,
  type QueryBuilder,
  type UseSupabaseQueryEstado,
} from "./useSupabaseQuery";

/**
 * Solo los incidentes ABIERTOS (para la luz de salud del sidebar). Realtime:
 * al resolverse un incidente el UPDATE llega y el clientFilter lo saca solo.
 */
export function useIncidentesAbiertos(): IncidenteServicio[] {
  const filter = useMemo(
    () =>
      (q: QueryBuilder<IncidenteServicio & Record<string, unknown>>) =>
        q.eq("estado", "abierto"),
    [],
  );
  return useSupabaseQueryConEstado<IncidenteServicio>("incidentes_servicios", {
    filter,
    clientFilter: (r) => r.estado === "abierto",
  }).datos;
}

export function useIncidentesServicios(
  dias = 90,
): UseSupabaseQueryEstado<IncidenteServicio> {
  // `desde` estable por montaje: evita re-suscribir el canal en cada render.
  const desde = useMemo(() => Date.now() - dias * 86_400_000, [dias]);
  const filter = useMemo(
    () =>
      (q: QueryBuilder<IncidenteServicio & Record<string, unknown>>) =>
        q.gte("inicio_ts", desde),
    [desde],
  );
  const order = useMemo(
    () => ({ column: "inicio_ts", ascending: false }),
    [],
  );
  return useSupabaseQueryConEstado<IncidenteServicio>("incidentes_servicios", {
    filter,
    order,
    clientFilter: (r) => r.inicio_ts >= desde,
  });
}
