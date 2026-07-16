// Edge Function `telegram-bot` — webhook del bot @camp_inteligent_bot
// (Fase B del plan de identidad, docs/plan-identidad-terreno.md).
//
// Telegram entrega cada update aquí (setWebhook con `secret_token`); la
// función valida el header `X-Telegram-Bot-Api-Secret-Token` contra
// `app_secrets.telegram_webhook_secret` y responde vía sendMessage con
// `app_secrets.telegram_bot_token`. verify_jwt: FALSE (Telegram no manda JWT
// de Supabase) — la autenticación ES el secret del webhook.
//
// Comandos:
//   /start <token>  → consume el token de `telegram_vinculos` (generado por
//                     la RPC `telegram_generar_vinculo` desde /terreno) y
//                     casa el chat_id con el usuario en `telegram_operadores`.
//                     Primer casamiento gana (unique en user_id y chat_id).
//   /start          → explica cómo vincular.
//   otro texto      → mensaje genérico.
//
// Siempre responde 200 a Telegram (si no, reintenta el mismo update en loop).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

function ok(): Response {
  return new Response("ok", { status: 200 });
}

async function leerSecret(admin: SupabaseClient, clave: string): Promise<string | null> {
  const { data } = await admin.from("app_secrets").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor ?? null;
}

async function enviar(botToken: string, chatId: number, texto: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
    });
  } catch {
    // No reintentar: Telegram reenvía el update si respondemos != 200,
    // pero un sendMessage fallido no debe tumbar el webhook.
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return ok();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const secretEsperado = await leerSecret(admin, "telegram_webhook_secret");
  const secretRecibido = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secretEsperado || secretRecibido !== secretEsperado) {
    // 401 sin cuerpo: origen no es Telegram (o secret rotado).
    return new Response("unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return ok();
  }

  const msg = update.message;
  const texto = msg?.text?.trim() ?? "";
  const chatId = msg?.chat?.id;
  if (!msg || !chatId || msg.chat.type !== "private") return ok();

  const botToken = await leerSecret(admin, "telegram_bot_token");
  if (!botToken) return ok();

  const AYUDA =
    "Este es el bot de la red de Campamentos Transitorios.\n\n" +
    "Para vincular su Telegram: entre al portal de su campamento " +
    "(código QR), identifíquese con su cédula y toque *Vincular Telegram*. " +
    "Ese botón abre este chat con su código personal.";

  if (!texto.startsWith("/start")) {
    await enviar(botToken, chatId, AYUDA);
    return ok();
  }

  const tokenVinculo = texto.slice("/start".length).trim();
  if (!tokenVinculo) {
    await enviar(botToken, chatId, AYUDA);
    return ok();
  }

  const ahora = Date.now();
  const { data: vinculo } = await admin
    .from("telegram_vinculos")
    .select("token, user_id, expira_ts, usado_ts")
    .eq("token", tokenVinculo)
    .maybeSingle();

  if (!vinculo || vinculo.usado_ts != null || Number(vinculo.expira_ts) < ahora) {
    await enviar(
      botToken,
      chatId,
      "⚠️ Ese enlace de vínculo no es válido o ya venció. " +
        "Genere uno nuevo desde el portal de su campamento (botón *Vincular Telegram*).",
    );
    return ok();
  }

  const { data: perfil } = await admin
    .from("perfiles")
    .select("user_id, username, nombre, cedula, cedula_norm")
    .eq("user_id", vinculo.user_id)
    .maybeSingle();
  if (!perfil) {
    await enviar(botToken, chatId, "⚠️ El usuario de ese enlace ya no existe. Identifíquese de nuevo en el portal.");
    return ok();
  }

  // ¿Este chat ya está casado con otro operador? (primer casamiento gana)
  const { data: chatPrevio } = await admin
    .from("telegram_operadores")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (chatPrevio && chatPrevio.user_id !== perfil.user_id) {
    await enviar(
      botToken,
      chatId,
      "⚠️ Este Telegram ya está vinculado a otro operador. " +
        "Si es un error, repórtelo a los analistas SAE de su campamento.",
    );
    return ok();
  }

  // ¿Este usuario ya tiene otro chat? (no se re-vincula solo; analista deshace)
  const { data: usuarioPrevio } = await admin
    .from("telegram_operadores")
    .select("chat_id")
    .eq("user_id", perfil.user_id)
    .maybeSingle();
  if (usuarioPrevio && Number(usuarioPrevio.chat_id) !== chatId) {
    await enviar(
      botToken,
      chatId,
      "⚠️ Su usuario ya está vinculado a otro Telegram. " +
        "Para cambiar de teléfono, pida a los analistas SAE que deshagan el vínculo anterior.",
    );
    return ok();
  }

  const { error: upsertErr } = await admin.from("telegram_operadores").upsert(
    {
      user_id: perfil.user_id,
      cedula_norm: perfil.cedula_norm ?? null,
      chat_id: chatId,
      telegram_username: msg.from?.username ?? null,
      telegram_nombre: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || null,
      verificado_ts: ahora,
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) {
    await enviar(botToken, chatId, "⚠️ No se pudo completar el vínculo. Intente de nuevo en unos minutos.");
    return ok();
  }

  await admin
    .from("telegram_vinculos")
    .update({ usado_ts: ahora })
    .eq("token", tokenVinculo);

  await admin.from("historial").insert({
    ts: ahora,
    usuario: perfil.username,
    accion: "vincular_telegram",
    entidad: "usuario",
    entidad_id: perfil.user_id,
    detalle: {
      username: perfil.username,
      nombre: perfil.nombre,
      cedula: perfil.cedula,
      telegram_username: msg.from?.username ?? null,
    },
  });

  await enviar(
    botToken,
    chatId,
    `✅ *Telegram vinculado.*\n\n${perfil.nombre || perfil.username}\n` +
      `Cédula: ${perfil.cedula ?? "—"}\n\n` +
      "Por este chat recibirá recordatorios y avisos de la red de campamentos.",
  );
  return ok();
});
