// Vínculo Telegram del operador de terreno (Fase B del plan de identidad).
// El deep-link abre el bot @camp_inteligent_bot con un token de un solo uso
// (RPC `telegram_generar_vinculo`); el webhook del bot (Edge Function
// `telegram-bot`) captura el chat_id y lo guarda en `telegram_operadores`.

import { supabase } from "./supabaseClient";
import { registrarHistorial } from "./historial";

export const TELEGRAM_BOT_USERNAME = "camp_inteligent_bot";

/** Entradas a /terreno permitidas sin vincular Telegram (gate de vínculo). */
export const GRACIA_TELEGRAM_MAX = 3;

export interface VinculoTelegram {
  chat_id: number;
  telegram_username: string | null;
  telegram_nombre: string | null;
  verificado_ts: number;
}

/** Deep-link al bot con el token de vínculo. */
export function urlVinculoTelegram(token: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`;
}

/** Genera (o renueva) el token de vínculo del usuario autenticado. */
export async function generarVinculoTelegram(): Promise<string> {
  const { data, error } = await supabase.rpc("telegram_generar_vinculo");
  if (error) {
    throw new Error(
      /ya tiene Telegram vinculado/i.test(error.message)
        ? "Este usuario ya tiene Telegram vinculado."
        : error.message,
    );
  }
  if (typeof data !== "string" || !data) {
    throw new Error("No se pudo generar el enlace de vínculo.");
  }
  return data;
}

/** Vínculo del usuario de la sesión actual (RLS: solo ve su propia fila). */
export async function miVinculoTelegram(): Promise<VinculoTelegram | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("telegram_operadores")
    .select("chat_id, telegram_username, telegram_nombre, verificado_ts")
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return data as VinculoTelegram;
}

/**
 * Entradas sin vincular ya consumidas por el usuario de la sesión. Vive en
 * `perfiles.entradas_sin_telegram` (servidor): el terreno borra caché y
 * localStorage con frecuencia, ahí no puede vivir el contador.
 */
export async function entradasSinTelegram(): Promise<number> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user.id;
  if (!uid) return 0;
  const { data, error } = await supabase
    .from("perfiles")
    .select("entradas_sin_telegram")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.entradas_sin_telegram ?? 0);
}

/**
 * Consume una entrada de gracia del gate (RPC `terreno_omitir_telegram`,
 * SECURITY DEFINER: el operador no puede resetear el contador por RLS).
 * Devuelve el total consumido tras incrementar.
 */
export async function omitirVinculoTelegram(): Promise<number> {
  const { data, error } = await supabase.rpc("terreno_omitir_telegram");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * Borra el vínculo Telegram de un usuario. Sin `userId` desvincula al usuario
 * de la sesión (RLS: cada quien su fila; admin/analista cualquier fila). El
 * usuario puede volver a vincular cuando quiera desde /terreno.
 */
export async function desvincularTelegram(opts?: {
  userId?: string;
  /** Username del perfil (para la bitácora cuando desvincula un admin). */
  username?: string | null;
}): Promise<void> {
  let uid = opts?.userId;
  if (!uid) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    uid = session?.user.id;
  }
  if (!uid) throw new Error("Requiere sesión");
  const { data, error } = await supabase
    .from("telegram_operadores")
    .delete()
    .eq("user_id", uid)
    .select("telegram_username");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Este usuario no tiene Telegram vinculado.");
  }
  registrarHistorial("desvincular_telegram", "usuario", uid, {
    telegram_username: data[0]?.telegram_username ?? null,
    ...(opts?.username ? { username: opts.username } : {}),
  });
}

/** Vínculos de varios usuarios (bandeja; RLS limita a admin/analista). */
export async function vinculosTelegramDeUsuarios(
  userIds: string[],
): Promise<Map<string, VinculoTelegram>> {
  const m = new Map<string, VinculoTelegram>();
  if (userIds.length === 0) return m;
  const { data } = await supabase
    .from("telegram_operadores")
    .select("user_id, chat_id, telegram_username, telegram_nombre, verificado_ts")
    .in("user_id", userIds);
  for (const fila of data ?? []) {
    const { user_id, ...resto } = fila as VinculoTelegram & { user_id: string };
    m.set(user_id, resto);
  }
  return m;
}
