// Edge Function `denuncia-registrar`
//
// Alta de denuncias del canal público (QR 'publico' del campamento) CON
// verificación obligatoria de Cap (proof-of-work). Es el único camino de alta:
// la RPC `denuncia_registrar` ya no está concedida a anon, así que nadie puede
// insertar sin pasar por aquí (y por tanto sin resolver Cap).
//
// Flujo: verifica el token de Cap (siteverify, el secret nunca sale del
// servidor) → toma la IP real del cliente de x-forwarded-for → llama a la RPC
// con service_role pasando la IP como p_ip (la RPC aplica los topes por
// campamento/IP/huella y captura los datos).
//
// Secrets (compartidos con login-with-cap): CAP_SECRET, CAP_SITE_KEY,
// CAP_BASE_URL (opcional). Desplegada vía MCP deploy_edge_function
// (verify_jwt: true — la anon key es un JWT válido).

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

async function verificarCap(
  capToken: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const capSecret = Deno.env.get("CAP_SECRET")?.trim();
  const capSiteKey = Deno.env.get("CAP_SITE_KEY")?.trim();
  const capBaseUrl = (
    Deno.env.get("CAP_BASE_URL") ?? "https://cap.m0n1t0r-d3-3v3nt0s.net"
  ).replace(/\/$/, "");

  if (!capSecret || !capSiteKey) {
    console.error("[denuncia-registrar] faltan CAP_SECRET o CAP_SITE_KEY");
    return { ok: false, motivo: "Verificación no configurada en el servidor" };
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
    console.error("[denuncia-registrar] fetch siteverify:", err);
    return { ok: false, motivo: "No se pudo contactar al servidor de verificación" };
  }

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };

  if (data.success === true) return { ok: true };

  if (res.status === 404) {
    return { ok: false, motivo: "Verificación expirada; marque de nuevo la casilla" };
  }
  return { ok: false, motivo: data.error ?? "Verificación de seguridad fallida" };
}

function ipCliente(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const primera = xff.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    token?: string;
    categoria?: string;
    titulo?: string;
    texto?: string;
    contacto?: string;
    userAgent?: string;
    dispositivoHuella?: string;
    dispositivoMeta?: unknown;
    capToken?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const capToken = body.capToken?.trim();
  if (!capToken) {
    return json({ error: "Falta la verificación de seguridad" }, 400);
  }
  if (!body.token?.trim()) {
    return json({ error: "Falta el código del campamento" }, 400);
  }

  const cap = await verificarCap(capToken);
  if (!cap.ok) {
    return json({ error: cap.motivo }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Servidor no configurado" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const meta =
    body.dispositivoMeta && typeof body.dispositivoMeta === "object"
      ? body.dispositivoMeta
      : null;

  const { data, error } = await admin.rpc("denuncia_registrar", {
    p_token: body.token.trim(),
    p_categoria: body.categoria ?? "",
    p_titulo: (body.titulo ?? "").trim(),
    p_texto: (body.texto ?? "").trim(),
    p_contacto: (body.contacto ?? "").trim() || null,
    p_user_agent: body.userAgent || null,
    p_dispositivo_huella: body.dispositivoHuella || null,
    p_dispositivo_meta: meta,
    p_ip: ipCliente(req),
  });

  if (error) {
    // Los mensajes de la RPC (validación / topes) son aptos para el usuario.
    return json({ error: error.message }, 400);
  }

  return json({ id: data }, 200);
});
