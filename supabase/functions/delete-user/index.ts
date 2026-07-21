// Edge Function `delete-user`.
//
// Elimina un usuario COMPLETO: borra el `auth.users` con service_role y el
// `ON DELETE CASCADE` de `perfiles.user_id → auth.users.id` arrastra el
// perfil. Autorización (plan migración operadores §5):
//   - admin: cualquier usuario (como siempre).
//   - analista_sae / supervisor: SOLO operadores dentro de su alcance — la
//     RPC `puede_gestionar_operador` (service_role) aplica la regla: analista
//     de red cualquier operador; analista con ámbito / supervisor solo si
//     comparte al menos un centro con el operador.
// Nadie puede eliminarse a sí mismo. Registra la acción en `historial`.
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
  const rolesPermitidos = ["admin", "analista_sae", "supervisor"];
  if (!perfilCaller || !rolesPermitidos.includes(perfilCaller.rol)) {
    return json({ error: "Su rol no puede eliminar usuarios" }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const { user_id } = body || {};
  if (!user_id || typeof user_id !== "string") {
    return json({ error: "Falta user_id" }, 400);
  }
  if (user_id === caller.id) {
    return json({ error: "No puedes eliminar tu propia cuenta" }, 400);
  }

  // No-admin: solo operadores dentro de su alcance (regla en el servidor,
  // la UI únicamente oculta el botón).
  if (perfilCaller.rol !== "admin") {
    const { data: permitido, error: permisoErr } = await adminClient.rpc(
      "puede_gestionar_operador",
      { p_caller: caller.id, p_objetivo: user_id },
    );
    if (permisoErr) {
      return json({ error: `No se pudo validar el alcance: ${permisoErr.message}` }, 500);
    }
    if (permitido !== true) {
      return json({ error: "Solo puede eliminar operadores de sus campamentos" }, 403);
    }
  }

  // Datos del objetivo para la bitácora (antes de borrarlo)
  const { data: objetivo } = await adminClient
    .from("perfiles")
    .select("username, nombre, rol")
    .eq("user_id", user_id)
    .maybeSingle();

  const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
  if (delErr) return json({ error: `No se pudo eliminar: ${delErr.message}` }, 500);

  await adminClient.from("historial").insert({
    ts: Date.now(),
    usuario: perfilCaller.username,
    accion: "eliminar_usuario",
    entidad: "usuario",
    entidad_id: user_id,
    detalle: objetivo ?? null,
  });

  return json({ ok: true }, 200);
});
