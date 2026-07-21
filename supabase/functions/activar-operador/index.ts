// Edge Function `activar-operador` (Fase 2 del plan de migración de
// operadores — docs/plan-migracion-operadores-password.md §6.1).
//
// El operador, tras entrar por el QR del campamento e identificarse por
// cédula, crea su contraseña propia: el token de terreno es la prueba de
// presencia que autoriza la operación (NO es un cambio de contraseña libre).
// Fija la contraseña en auth.users y marca `perfiles.activado_ts`.
//
// Reglas:
//   - Token de terreno válido y activo (mismo criterio que login-terreno).
//   - El `op-<cédula>` debe existir con rol operador; rechazados no activan.
//   - Solo UNA vez: si `activado_ts` ya está puesto, 409 (el reseteo posterior
//     es de su supervisor vía `update-user-password`, o suyo desde
//     Preferencias con la contraseña actual).
//   - Contraseña mínimo 6 caracteres y NUNCA igual a la cédula (plan §2).
//
// Desplegada vía MCP `deploy_edge_function` (verify_jwt: true). Este archivo
// es la referencia versionada del código que corre en producción.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: string; cedula?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const digits = typeof body.cedula === "string" ? body.cedula.replace(/\D/g, "") : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) return json({ error: "Falta el token de terreno" }, 400);
  if (digits.length < 5 || digits.length > 12) return json({ error: "Cédula inválida" }, 400);
  if (password.length < 6) {
    return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }
  if (password.replace(/\D/g, "") === digits) {
    return json({ error: "La contraseña no puede ser su cédula" }, 400);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Prueba de presencia: el QR impreso del campamento.
  const { data: filaToken, error: tokenErr } = await adminClient
    .from("tokens_centros")
    .select("centro_id")
    .eq("token", token)
    .eq("tipo", "personal")
    .eq("activo", true)
    .maybeSingle();
  if (tokenErr) return json({ error: `Error validando token: ${tokenErr.message}` }, 500);
  if (!filaToken) return json({ error: "Enlace o código QR no válido o revocado" }, 401);

  const { data: perfil } = await adminClient
    .from("perfiles")
    .select("user_id, username, nombre, aprobacion, activado_ts")
    .eq("cedula_norm", digits)
    .eq("rol", "operador")
    .maybeSingle();
  if (!perfil) {
    return json({ error: "Primero identifíquese con su cédula desde el QR" }, 404);
  }
  if (perfil.aprobacion === "rechazada") {
    return json(
      { error: "Su identificación fue rechazada por los analistas. Contacte a la coordinación de la red." },
      403,
    );
  }
  if (perfil.activado_ts != null) {
    return json(
      { error: "Su credencial ya fue activada. Entre con su contraseña; si la olvidó, pida un reseteo a su supervisor." },
      409,
    );
  }

  const { error: passErr } = await adminClient.auth.admin.updateUserById(
    perfil.user_id as string,
    { password },
  );
  if (passErr) return json({ error: `No se pudo fijar la contraseña: ${passErr.message}` }, 500);

  const activadoTs = Date.now();
  const { error: updErr } = await adminClient
    .from("perfiles")
    .update({ activado_ts: activadoTs })
    .eq("user_id", perfil.user_id);
  if (updErr) return json({ error: `No se pudo marcar la activación: ${updErr.message}` }, 500);

  await adminClient.from("historial").insert({
    ts: activadoTs,
    usuario: perfil.username,
    accion: "activar_operador",
    entidad: "usuario",
    entidad_id: perfil.user_id,
    detalle: {
      username: perfil.username,
      nombre: perfil.nombre,
      centro_id: filaToken.centro_id,
      origen: "qr-terreno",
    },
  });

  return json({ ok: true, activado_ts: activadoTs, username: perfil.username }, 200);
});
