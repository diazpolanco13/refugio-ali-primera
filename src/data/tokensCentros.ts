// Tokens de terreno por campamento (tabla `tokens_centros`, ver
// supabase/tokens_terreno.sql). La RLS solo deja leerlos a admin/analista_sae:
// para el resto de roles el select devuelve vacío y la UI oculta la sección.

import { supabase } from "./supabaseClient";

export type TipoTokenCentro = "personal" | "publico";

/** Token activo de un campamento (null si no hay o el rol no puede leerlo). */
export async function obtenerTokenActivoCentro(
  centroId: string,
  tipo: TipoTokenCentro,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tokens_centros")
    .select("token")
    .eq("centro_id", centroId)
    .eq("tipo", tipo)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.token ?? null;
}
