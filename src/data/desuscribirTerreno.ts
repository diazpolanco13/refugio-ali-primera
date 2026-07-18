// Baja de suscripción a campamentos de terreno (`centros_asignados`).
// RPC `desuscribir_campamento_terreno`: el operador se baja a sí mismo;
// admin/analista pueden bajar a otro desde la bandeja.

import { supabase } from "@/data/supabaseClient";

/**
 * Quita un campamento (o todos si `centroId` es null) de `centros_asignados`.
 * Devuelve la lista restante.
 */
export async function desuscribirCampamentoTerreno(opts: {
  centroId?: string | null;
  /** Solo admin/analista: user_id del operador. Null = el propio. */
  userId?: string | null;
}): Promise<string[]> {
  const { data, error } = await supabase.rpc("desuscribir_campamento_terreno", {
    p_centro_id: opts.centroId?.trim() || null,
    p_user_id: opts.userId ?? null,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as string[]) : [];
}
