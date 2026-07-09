// Denuncias de damnificados: alta pública vía RPC (token 'publico' del QR del
// campamento) y resolución desde la app (update directo; la RLS limita al
// supervisor a sus campamentos y excluye al operador).

import type { CentroCenso } from "./reposCenso";
import { registrarHistorial } from "./historial";
import { supabase } from "./supabaseClient";
import {
  huellaDispositivo,
  senalesDispositivo,
  type SenalesDispositivo,
} from "@/lib/huellaDispositivo";

/** Campamento de un token 'publico' (null si es inválido o fue revocado). */
export async function obtenerCentroDenuncia(token: string): Promise<CentroCenso | null> {
  const { data, error } = await supabase.rpc("denuncia_centro", { p_token: token });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as CentroCenso[];
  return filas[0] ?? null;
}

export interface DatosAltaDenuncia {
  token: string;
  categoria: string;
  titulo: string;
  texto: string;
  contacto: string;
}

/** Alta anónima de una denuncia/sugerencia. Devuelve el id. */
export async function registrarDenuncia(datos: DatosAltaDenuncia): Promise<string> {
  const senales: SenalesDispositivo = senalesDispositivo();
  const { userAgent, ...meta } = senales;
  const { data, error } = await supabase.rpc("denuncia_registrar", {
    p_token: datos.token,
    p_categoria: datos.categoria,
    p_titulo: datos.titulo.trim(),
    p_texto: datos.texto.trim(),
    p_contacto: datos.contacto.trim() || null,
    p_user_agent: userAgent || null,
    p_dispositivo_huella: huellaDispositivo(senales),
    p_dispositivo_meta: meta,
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
