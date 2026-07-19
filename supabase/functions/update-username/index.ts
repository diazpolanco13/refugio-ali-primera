// Edge Function `update-username` (v2 — 19-jul-2026).
//
// Renombra el usuario (login): actualiza el email sintético
// `<username>@refugio.app` en `auth.users` Y `perfiles.username` en una sola
// operación con rollback. Existe porque el username no se puede cambiar desde
// el cliente (el email vive en auth.users y requiere service_role).
//
// Permisos (v2 permite el auto-renombrado desde Preferencias de cuenta):
//   · admin → renombra a cualquiera.
//   · analista_sae → a sí mismo o a operadores.
//   · resto de roles → solo a sí mismo.
//   · Identidades de terreno generadas por el sistema (`op-<cedula>`,
//     `operador-<centro>`) NO se renombran: login-terreno las busca por ese
//     patrón. Tampoco se acepta un nombre nuevo con esos prefijos.
//
// Tras un auto-renombrado el frontend refresca la sesión
// (supabase.auth.refreshSession + sincronizarSesion); ver
// `renombrarMiUsuario()` en src/data/authSupabase.ts.
//
// Desplegada vía MCP `deploy_edge_function` (verify_jwt: true). Este archivo
// es la referencia versionada del código que corre en producción.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Debe formar un email válido en `<username>@refugio.app` y calzar con el
// login de la app (que lo usa tal cual, en minúsculas).
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
// Identidades creadas por login-terreno; el patrón es contrato del sistema.
const MAQUINA_RE = /^(op-|operador-)/;

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const {
    data: { user: caller },
    error: callerErr,
  } = await adminClient.auth.getUser(token);
  if (callerErr || !caller) return json({ error: "Token inválido" }, 401);

  const { data: perfilCaller } = await adminClient
    .from("perfiles")
    .select("rol, username")
    .eq("user_id", caller.id)
    .single();
  if (!perfilCaller) return json({ error: "Perfil del solicitante no encontrado" }, 403);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const userId = typeof body?.user_id === "string" ? body.user_id : "";
  const nuevo =
    typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!userId || !nuevo) {
    return json({ error: "Faltan campos requeridos: user_id, username" }, 400);
  }
  if (!USERNAME_RE.test(nuevo)) {
    return json(
      {
        error:
          "Username inválido: 3-32 caracteres, minúsculas/números y . _ - (debe empezar con letra o número)",
      },
      400,
    );
  }
  if (MAQUINA_RE.test(nuevo)) {
    return json(
      { error: "Los prefijos op- y operador- están reservados para el sistema" },
      400,
    );
  }

  const { data: perfilTarget } = await adminClient
    .from("perfiles")
    .select("username, nombre, rol")
    .eq("user_id", userId)
    .maybeSingle();
  if (!perfilTarget) return json({ error: "Usuario no encontrado" }, 404);

  const anterior = perfilTarget.username as string | null;
  if (anterior && MAQUINA_RE.test(anterior)) {
    return json(
      {
        error:
          "Esta identidad de terreno la genera el sistema y no se puede renombrar",
      },
      403,
    );
  }

  const esPropio = userId === caller.id;
  const autorizado =
    perfilCaller.rol === "admin" ||
    esPropio ||
    (perfilCaller.rol === "analista_sae" && perfilTarget.rol === "operador");
  if (!autorizado) {
    return json({ error: "Sin permiso para renombrar a este usuario" }, 403);
  }

  if (anterior === nuevo) return json({ ok: true, username: nuevo }, 200);

  const { data: choque } = await adminClient
    .from("perfiles")
    .select("user_id")
    .eq("username", nuevo)
    .maybeSingle();
  if (choque) return json({ error: `El username «${nuevo}» ya está en uso` }, 409);

  // 1) Email sintético en auth.users (con rollback si falla el perfil).
  const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, {
    email: `${nuevo}@refugio.app`,
    email_confirm: true,
    user_metadata: { username: nuevo },
  });
  if (authErr) {
    const status = authErr.message.includes("already") ? 409 : 400;
    return json({ error: authErr.message }, status);
  }

  // 2) perfiles.username
  const { error: perfilErr } = await adminClient
    .from("perfiles")
    .update({ username: nuevo })
    .eq("user_id", userId);
  if (perfilErr) {
    if (anterior) {
      await adminClient.auth.admin.updateUserById(userId, {
        email: `${anterior}@refugio.app`,
        email_confirm: true,
        user_metadata: { username: anterior },
      });
    }
    return json({ error: `Error actualizando perfil: ${perfilErr.message}` }, 500);
  }

  await adminClient.from("historial").insert({
    ts: Date.now(),
    usuario: perfilCaller.username,
    accion: "renombrar_usuario",
    entidad: "usuario",
    entidad_id: userId,
    detalle: { de: anterior, a: nuevo, nombre: perfilTarget.nombre, propio: esPropio },
  });

  return json({ ok: true, username: nuevo }, 200);
});
