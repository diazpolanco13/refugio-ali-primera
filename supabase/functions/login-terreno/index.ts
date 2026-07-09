// Edge Function `login-terreno` (Fase 2 del acceso de campo).
//
// Canjea un token de terreno (`tokens_centros.tipo = 'personal'`, el del QR
// del campamento) por una sesión del usuario `operador-<centro_id>`:
//   1. Valida el token contra `tokens_centros` (activo, tipo personal).
//   2. Busca el operador del campamento; si no existe lo crea (auth.users con
//      email sintético SIN contraseña + perfil rol `operador` con ese único
//      centro asignado, hash_id generado aquí como en `create-user`).
//   3. Emite un magiclink con `generateLink` y devuelve su `hashed_token`;
//      el frontend lo canjea con `supabase.auth.verifyOtp` → sesión real y la
//      RLS de siempre (operador limitado a su centro) hace el resto.
//
// El usuario compartido del campamento no tiene contraseña: la ÚNICA forma de
// entrar es el token del QR, que es revocable por campamento. Registra en
// `historial` la creación del operador y cada login de terreno.
//
// Desplegada vía MCP `deploy_edge_function` (verify_jwt: true — la anon key
// es un JWT válido). Este archivo es la referencia versionada.

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

/** Genera un hash de marca de agua tipo `B957-8E8F` (4+4 hex mayúsculas). */
function generarHashId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return json({ error: "Falta el token de terreno" }, 400);

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1) El token del QR es la credencial: debe estar activo y ser de personal.
  const { data: filaToken, error: tokenErr } = await adminClient
    .from("tokens_centros")
    .select("centro_id")
    .eq("token", token)
    .eq("tipo", "personal")
    .eq("activo", true)
    .maybeSingle();
  if (tokenErr) return json({ error: `Error validando token: ${tokenErr.message}` }, 500);
  if (!filaToken) {
    return json({ error: "Enlace o código QR no válido o revocado" }, 401);
  }
  const centroId = filaToken.centro_id as string;

  const { data: centro } = await adminClient
    .from("centros")
    .select("data")
    .eq("id", centroId)
    .eq("deleted", false)
    .maybeSingle();
  if (!centro) return json({ error: "El campamento del token ya no existe" }, 410);
  const nombreCentro =
    (centro.data as { nombre?: string })?.nombre?.trim() || centroId;

  const username = `operador-${centroId}`;
  const email = `${username}@refugio.app`;

  // 2) Operador del campamento: buscar o crear (sin contraseña).
  const { data: perfil } = await adminClient
    .from("perfiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (!perfil) {
    const { data: nuevo, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { username, terreno: true },
    });
    if (createErr && !createErr.message.includes("already")) {
      return json({ error: `Error creando operador: ${createErr.message}` }, 500);
    }

    if (nuevo?.user) {
      let hashId = generarHashId();
      for (let i = 0; i < 5; i++) {
        const { data: choque } = await adminClient
          .from("perfiles")
          .select("user_id")
          .eq("hash_id", hashId)
          .maybeSingle();
        if (!choque) break;
        hashId = generarHashId();
      }

      const { error: perfilErr } = await adminClient.from("perfiles").insert({
        user_id: nuevo.user.id,
        username,
        nombre: `Terreno · ${nombreCentro}`,
        rol: "operador",
        centros_asignados: [centroId],
        responsabilidad: "Acceso de terreno (QR del campamento)",
        hash_id: hashId,
        marca_agua: true,
      });
      if (perfilErr) {
        await adminClient.auth.admin.deleteUser(nuevo.user.id);
        return json({ error: `Error creando perfil: ${perfilErr.message}` }, 500);
      }

      await adminClient.from("historial").insert({
        ts: Date.now(),
        usuario: username,
        accion: "crear_usuario_terreno",
        entidad: "usuario",
        entidad_id: nuevo.user.id,
        detalle: { username, centro_id: centroId, origen: "login-terreno" },
      });
    }
  }

  // 3) Magiclink → hashed_token que el frontend canjea con verifyOtp.
  const { data: enlace, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !enlace?.properties?.hashed_token) {
    return json({ error: `No se pudo emitir el acceso: ${linkErr?.message ?? "sin token"}` }, 500);
  }

  await adminClient.from("historial").insert({
    ts: Date.now(),
    usuario: username,
    accion: "login_terreno",
    entidad: "centro",
    entidad_id: centroId,
    detalle: { origen: "qr" },
  });

  return json(
    { token_hash: enlace.properties.hashed_token, centro_id: centroId, username },
    200,
  );
});
