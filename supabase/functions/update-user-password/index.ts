// Edge Function `update-user-password`.
//
// Cambia la contraseña de OTRO usuario con service_role
// (`auth.admin.updateUserById`). Solo un admin autenticado puede invocarla.
// Registra la acción en `historial` (sin incluir la contraseña).
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
  if (!perfilCaller || perfilCaller.rol !== "admin") {
    return json({ error: "Solo admin puede cambiar contraseñas" }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const { user_id, password } = body || {};
  if (!user_id || typeof user_id !== "string") {
    return json({ error: "Falta user_id" }, 400);
  }
  if (typeof password !== "string" || password.length < 6) {
    return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }

  const { error: updErr } = await adminClient.auth.admin.updateUserById(user_id, {
    password,
  });
  if (updErr) return json({ error: `No se pudo cambiar la contraseña: ${updErr.message}` }, 500);

  const { data: objetivo } = await adminClient
    .from("perfiles")
    .select("username")
    .eq("user_id", user_id)
    .maybeSingle();

  await adminClient.from("historial").insert({
    ts: Date.now(),
    usuario: perfilCaller.username,
    accion: "cambiar_password",
    entidad: "usuario",
    entidad_id: user_id,
    detalle: objetivo ? { username: objetivo.username } : null,
  });

  return json({ ok: true }, 200);
});
