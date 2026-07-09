// Edge Function `login-with-cap`
//
// Verifica el token de Cap (siteverify) y, si es válido, autentica contra
// Supabase Auth. El secret de Cap nunca sale del servidor; el frontend solo
// envía el token generado por el widget.
//
// Secrets requeridos en Supabase (Edge Functions → Secrets):
//   CAP_SECRET, CAP_SITE_KEY, CAP_BASE_URL (opcional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verificarCap(
  capToken: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const capSecret = Deno.env.get("CAP_SECRET")?.trim();
  const capSiteKey = Deno.env.get("CAP_SITE_KEY")?.trim();
  const capBaseUrl = (
    Deno.env.get("CAP_BASE_URL") ?? "https://cap.m0n1t0r-d3-3v3nt0s.net"
  ).replace(/\/$/, "");

  if (!capSecret || !capSiteKey) {
    console.error("[login-with-cap] faltan CAP_SECRET o CAP_SITE_KEY");
    return { ok: false, motivo: "CAPTCHA no configurado en el servidor" };
  }

  const url = `${capBaseUrl}/${capSiteKey}/siteverify`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: capSecret, response: capToken }),
    });
  } catch (err) {
    console.error("[login-with-cap] fetch siteverify:", err);
    return { ok: false, motivo: "No se pudo contactar al servidor CAPTCHA" };
  }

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };

  if (data.success === true) return { ok: true };

  console.warn(
    "[login-with-cap] siteverify falló",
    res.status,
    data.error ?? "sin detalle",
  );

  if (res.status === 403 && data.error?.includes("secret")) {
    return {
      ok: false,
      motivo: "CAP_SECRET incorrecto en Supabase (no coincide con Cap)",
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      motivo: "Token CAPTCHA expirado o ya usado; verifica de nuevo",
    };
  }

  return {
    ok: false,
    motivo: data.error ?? "Verificación de seguridad fallida",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { username?: string; password?: string; capToken?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const username = body.username?.trim();
  const password = body.password;
  const capToken = body.capToken?.trim();

  if (!username || !password || !capToken) {
    return json({ error: "Faltan credenciales o verificación de seguridad" }, 400);
  }

  const cap = await verificarCap(capToken);
  if (!cap.ok) {
    return json({ error: cap.motivo }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Auth no configurado en el servidor" }, 503);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `${username}@refugio.app`;
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return json({ error: error.message }, 401);
  if (!data.session) return json({ error: "Login sin sesión devuelta" }, 401);

  return json(
    {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    },
    200,
  );
});
