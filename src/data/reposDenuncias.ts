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
    .eq("id", id)
    .eq("deleted", false);
  if (error) throw new Error(error.message);
  registrarHistorial("resolver_denuncia", "denuncia", id, { centro_id: centroId });
}

export interface DatosEdicionDenuncia {
  categoria: string;
  titulo: string;
  texto: string;
  contacto: string;
}

/** Edita el contenido de una denuncia (admin / analista SAE). */
export async function editarDenuncia(
  id: string,
  centroId: string,
  usuario: string,
  datos: DatosEdicionDenuncia,
): Promise<void> {
  const titulo = datos.titulo.trim();
  const texto = datos.texto.trim();
  const contacto = datos.contacto.trim();
  if (titulo.length < 3 || titulo.length > 120) {
    throw new Error("El título debe tener entre 3 y 120 caracteres");
  }
  if (texto.length < 10 || texto.length > 1200) {
    throw new Error("El texto debe tener entre 10 y 1200 caracteres");
  }
  if (contacto.length > 120) {
    throw new Error("El contacto no puede superar 120 caracteres");
  }
  const ahora = Date.now();
  const { error } = await supabase
    .from("denuncias_centros")
    .update({
      categoria: datos.categoria,
      titulo,
      texto,
      contacto: contacto || null,
      updated_at: ahora,
      updated_by: usuario,
    })
    .eq("id", id)
    .eq("deleted", false);
  if (error) throw new Error(error.message);
  registrarHistorial("editar_denuncia", "denuncia", id, { centro_id: centroId });
}

/** Borrado suave: la denuncia sale de las bandejas y queda en la papelera. */
export async function softDeleteDenuncia(
  id: string,
  centroId: string,
  _usuario: string,
): Promise<void> {
  // RPC security definer: el UPDATE directo falla para analista_sae porque
  // PostgREST exige SELECT de la fila resultante y las eliminadas solo las ve admin.
  const { error } = await supabase.rpc("denuncia_soft_delete", { p_id: id });
  if (error) throw new Error(error.message);
  registrarHistorial("eliminar_denuncia", "denuncia", id, {
    centro_id: centroId,
    soft: true,
  });
}

/** Restaura una denuncia desde la papelera (solo admin). */
export async function restaurarDenuncia(
  id: string,
  centroId: string,
  usuario: string,
): Promise<void> {
  const ahora = Date.now();
  const { error } = await supabase
    .from("denuncias_centros")
    .update({
      deleted: false,
      deleted_at: null,
      deleted_by: null,
      updated_at: ahora,
      updated_by: usuario,
    })
    .eq("id", id)
    .eq("deleted", true);
  if (error) throw new Error(error.message);
  registrarHistorial("restaurar_denuncia", "denuncia", id, { centro_id: centroId });
}

/** Purga definitiva desde la papelera (solo admin). */
export async function purgarDenuncia(
  id: string,
  centroId: string,
): Promise<void> {
  const { error } = await supabase
    .from("denuncias_centros")
    .delete()
    .eq("id", id)
    .eq("deleted", true);
  if (error) throw new Error(error.message);
  registrarHistorial("purgar_denuncia", "denuncia", id, { centro_id: centroId });
}
