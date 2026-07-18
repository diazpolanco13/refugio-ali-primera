// Acceso público al estado de servicios: RPC `estado_servicios_publico`
// (solo incidentes ABIERTOS, sin PII; concedida a anon a propósito para el
// banner de /censo y /terreno, como terreno_centro).

import type { IncidenteAbiertoPublico } from "@/domain/estadoServicios";
import { supabase } from "./supabaseClient";

export async function incidentesAbiertosPublico(): Promise<
  IncidenteAbiertoPublico[]
> {
  const { data, error } = await supabase.rpc("estado_servicios_publico");
  if (error || !Array.isArray(data)) return [];
  return data as IncidenteAbiertoPublico[];
}
