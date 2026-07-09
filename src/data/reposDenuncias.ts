// Denuncias de damnificados: alta pública vía RPC (token 'publico' del QR del
// campamento) y resolución desde la app (update directo; la RLS limita al
// supervisor a sus campamentos y excluye al operador).

import type { CentroCenso } from "./reposCenso";
import { registrarHistorial } from "./historial";
import { supabase } from "./supabaseClient";

/** Campamento de un token 'publico' (null si es inválido o fue revocado). */
export async function obtenerCentroDenuncia(token: string): Promise<CentroCenso | null> {
  const { data, error } = await supabase.rpc("denuncia_centro", { p_token: token });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as CentroCenso[];
  return filas[0] ?? null;
}

/** Alta anónima de una denuncia/sugerencia. Devuelve el id. */
export async function registrarDenuncia(
  token: string,
  categoria: string,
  texto: string,
  contacto: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("denuncia_registrar", {
    p_token: token,
    p_categoria: categoria,
    p_texto: texto.trim(),
    p_contacto: contacto.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Marca una denuncia como resuelta, con nota opcional de qué se hizo. */
export async function resolverDenuncia(
  id: string,
  centroId: string,
  usuario: string,
  nota: string,
): Promise<void> {
  const ahora = Date.now();
  const { error } = await supabase
    .from("denuncias_centros")
    .update({
      estado: "resuelta",
      resuelta_ts: ahora,
      resuelta_por: usuario,
      nota_resolucion: nota.trim() || null,
      updated_at: ahora,
      updated_by: usuario,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  registrarHistorial("resolver_denuncia", "denuncia", id, { centro_id: centroId });
}
