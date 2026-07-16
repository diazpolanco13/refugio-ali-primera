// Vínculo Telegram del operador de terreno (Fase B del plan de identidad).
// El deep-link abre el bot @camp_inteligent_bot con un token de un solo uso
// (RPC `telegram_generar_vinculo`); el webhook del bot (Edge Function
// `telegram-bot`) captura el chat_id y lo guarda en `telegram_operadores`.

import { supabase } from "./supabaseClient";

export const TELEGRAM_BOT_USERNAME = "camp_inteligent_bot";

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
