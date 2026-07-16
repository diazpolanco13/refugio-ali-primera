// Edge Function `recordatorio-partes` — mensajería proactiva a operadores de
// terreno vía @camp_inteligent_bot (Fase C, decidida el 16-jul-2026).
//
// La dispara pg_cron (migración `recordatorios_terreno_cron`) con el header
// `X-Cron-Secret` (app_secrets.cron_secret). verify_jwt: FALSE — la
// autenticación ES ese secret. Dos modos (body `{"modo": ...}`):
//
//   - `buenos_dias` (7:00 am VE): a TODO operador con Telegram vinculado, el
//     estado de sus campamentos — reporte del día área por área + censo con
//     su última actualización — y el aviso de que a las 11:00 llega
//     recordatorio si no ha reportado.
//   - `recordatorio` (11:00, 12:00, 13:00 y luego cada 30 min hasta las
//     18:00 VE): SOLO a operadores con áreas pendientes, listando qué falta.
//     Al completar el reporte dejan de llegar (el cron consulta el estado
//     real en cada disparo — sin estado propio).
//
// El estado por campamento lo arma la función SQL `resumen_terreno_centros`
// (una sola consulta). Los envíos son secuenciales y best-effort: un chat
// bloqueado no detiene al resto. Horas en America/Caracas (UTC-4).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ResumenCentro {
  centro_id: string;
  nombre: string;
  parte_ok: boolean;
  control_ok: boolean;
  salud_ok: boolean;
  trabajos_ok: boolean;
  requerimientos_ok: boolean;
  novedades_ok: boolean;
  censados: number;
  parte_personas: number;
  censo_ts: number | null;
}

const AREAS: Array<{ campo: keyof ResumenCentro; etiqueta: string }> = [
  { campo: "parte_ok", etiqueta: "Parte numérico" },
  { campo: "control_ok", etiqueta: "Control" },
  { campo: "salud_ok", etiqueta: "Salud" },
  { campo: "trabajos_ok", etiqueta: "Trabajos" },
  { campo: "requerimientos_ok", etiqueta: "Requerimientos" },
  { campo: "novedades_ok", etiqueta: "Novedades" },
];

function hoyVenezuela(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

function fechaCorta(ts: number | null): string {
  if (!ts) return "sin registros";
  return new Date(Number(ts)).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function areasPendientes(r: ResumenCentro): string[] {
  return AREAS.filter((a) => r[a.campo] !== true).map((a) => a.etiqueta);
}

function bloqueCentroBuenosDias(r: ResumenCentro): string {
  // ❌ y no ⬜: el cuadrado blanco se camufla con el fondo de Telegram.
  const lineas = AREAS.map(
    (a) => `  ${r[a.campo] === true ? "✅" : "❌"} ${a.etiqueta}`,
  ).join("\n");
  const faltanCenso = Math.max(0, r.parte_personas - r.censados);
  const censo =
    r.parte_personas > 0
      ? `${r.censados} de ${r.parte_personas} personas` +
        (faltanCenso > 0 ? ` (faltan ${faltanCenso})` : " · al día")
      : `${r.censados} personas censadas (aún sin parte que contrastar)`;
  return (
    `⛺ *${r.nombre}*\n` +
    `📋 Reporte de hoy:\n${lineas}\n` +
    `👥 Censo: ${censo}\n` +
    `   Última actualización: ${fechaCorta(r.censo_ts)}`
  );
}

async function leerSecret(admin: SupabaseClient, clave: string): Promise<string | null> {
  const { data } = await admin.from("app_secrets").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor ?? null;
}

async function enviar(botToken: string, chatId: number, texto: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const secretEsperado = await leerSecret(admin, "cron_secret");
  if (!secretEsperado || req.headers.get("x-cron-secret") !== secretEsperado) {
    return new Response("unauthorized", { status: 401 });
  }

  let modo = "recordatorio";
  try {
    const body = await req.json();
    if (body?.modo === "buenos_dias") modo = "buenos_dias";
  } catch {
    /* body opcional */
  }

  const botToken = await leerSecret(admin, "telegram_bot_token");
  if (!botToken) return new Response("sin bot token", { status: 500 });

  // Operadores con Telegram vinculado y acceso vigente.
  const { data: vinculos } = await admin
    .from("telegram_operadores")
    .select("user_id, chat_id");
  if (!vinculos?.length) return Response.json({ modo, enviados: 0, motivo: "sin vinculados" });

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("user_id, nombre, rol, aprobacion, centros_asignados")
    .in("user_id", vinculos.map((v) => v.user_id))
    .eq("rol", "operador")
    .neq("aprobacion", "rechazada");
  if (!perfiles?.length) return Response.json({ modo, enviados: 0, motivo: "sin operadores" });

  const todosCentros = [
    ...new Set(perfiles.flatMap((p) => (p.centros_asignados as string[] | null) ?? [])),
  ];
  if (!todosCentros.length) return Response.json({ modo, enviados: 0, motivo: "sin centros" });

  const { data: resumenes, error: resumenErr } = await admin.rpc("resumen_terreno_centros", {
    p_centros: todosCentros,
    p_dia: hoyVenezuela(),
  });
  if (resumenErr) return new Response(`resumen: ${resumenErr.message}`, { status: 500 });
  const porCentro = new Map<string, ResumenCentro>(
    ((resumenes ?? []) as ResumenCentro[]).map((r) => [r.centro_id, r]),
  );

  const chatDe = new Map<string, number>(vinculos.map((v) => [v.user_id, Number(v.chat_id)]));
  let enviados = 0;

  for (const perfil of perfiles) {
    const chatId = chatDe.get(perfil.user_id);
    if (!chatId) continue;
    const centros = ((perfil.centros_asignados as string[] | null) ?? [])
      .map((id) => porCentro.get(id))
      .filter((r): r is ResumenCentro => Boolean(r));
    if (!centros.length) continue;

    if (modo === "buenos_dias") {
      const primerNombre = (perfil.nombre ?? "").trim().split(/\s+/)[0] || "operador";
      const texto =
        `🌅 *Buenos días, ${primerNombre}.*\n` +
        `Estado de su(s) campamento(s) hoy:\n\n` +
        centros.map(bloqueCentroBuenosDias).join("\n\n") +
        `\n\n_Si a las 11:00 a. m. aún no ha enviado su reporte, recibirá un recordatorio._`;
      if (await enviar(botToken, chatId, texto)) enviados++;
      continue;
    }

    // recordatorio: solo campamentos con áreas pendientes.
    const pendientes = centros
      .map((r) => ({ r, faltan: areasPendientes(r) }))
      .filter((x) => x.faltan.length > 0);
    if (!pendientes.length) continue;

    const texto =
      `⏰ *Recordatorio: falta el reporte de hoy.*\n\n` +
      pendientes
        .map((x) => `⛺ *${x.r.nombre}*\n   Pendiente: ${x.faltan.join(", ")}`)
        .join("\n\n") +
      `\n\nEntre por el código QR de su campamento y complete el reporte. ` +
      `Este recordatorio se repetirá hasta que esté completo.`;
    if (await enviar(botToken, chatId, texto)) enviados++;
  }

  return Response.json({ modo, enviados });
});
