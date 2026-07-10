// Edge Function `login-terreno` (acceso de campo).
//
// Canjea un token de terreno (`tokens_centros.tipo = 'personal'`) por una
// sesión de operador:
//   - Sin `funcionario`: usuario compartido `operador-<centro_id>` (legado).
//   - Con `funcionario`: usuario temporal por persona
//     `operador-<centro_id>-<huella>` (nombre/teléfono/institución), para que
//     varias personas usen el mismo QR y queden como responsables distintos.
//
// Emite magiclink (`hashed_token`); el frontend lo canjea con verifyOtp.
// Desplegada vía MCP `deploy_edge_function` (verify_jwt: true).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FuncionarioBody {
  jerarquia?: string;
  nombre?: string;
  institucion?: string;
  telefono?: string;
}

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

function normalizarFuncionario(raw: FuncionarioBody | undefined): {
  jerarquia: string;
  nombre: string;
  institucion: string;
  telefono: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const jerarquia = typeof raw.jerarquia === "string" ? raw.jerarquia.trim() : "";
  const nombre = typeof raw.nombre === "string" ? raw.nombre.trim() : "";
  const institucion = typeof raw.institucion === "string" ? raw.institucion.trim() : "";
  const telefono = typeof raw.telefono === "string" ? raw.telefono.trim() : "";
  if (!jerarquia || !nombre || !institucion || !telefono) return null;
  return { jerarquia, nombre, institucion, telefono };
}

async function huellaFuncionario(f: {
  nombre: string;
  institucion: string;
  telefono: string;
}): Promise<string> {
  const tel = f.telefono.replace(/\D/g, "");
  const text = `${tel}|${f.nombre.toLowerCase()}|${f.institucion.toLowerCase()}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: string; funcionario?: FuncionarioBody };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return json({ error: "Falta el token de terreno" }, 400);
  const funcionario = normalizarFuncionario(body.funcionario);

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

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

  const huella = funcionario ? await huellaFuncionario(funcionario) : null;
  const username = huella ? `operador-${centroId}-${huella}` : `operador-${centroId}`;
  const email = `${username}@refugio.app`;

  const { data: perfil } = await adminClient
    .from("perfiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (!perfil) {
    const userMetadata: Record<string, unknown> = {
      username,
      terreno: true,
      centro_id: centroId,
    };
    if (funcionario) userMetadata.funcionario = funcionario;

    const { data: nuevo, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: userMetadata,
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
        nombre: funcionario ? funcionario.nombre : `Terreno · ${nombreCentro}`,
        rol: "operador",
        centros_asignados: [centroId],
        responsabilidad: funcionario
          ? `${funcionario.jerarquia} · ${funcionario.institucion}`
          : "Acceso de terreno (QR del campamento)",
        jerarquia: funcionario?.jerarquia ?? null,
        telegram: funcionario?.telefono ?? null,
        whatsapp: funcionario?.telefono ?? null,
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
        detalle: {
          username,
          centro_id: centroId,
          origen: "login-terreno",
          funcionario: funcionario ?? null,
        },
      });
    }
  } else if (funcionario) {
    // Actualizar datos de perfil y metadata si la misma persona vuelve a entrar.
    await adminClient
      .from("perfiles")
      .update({
        nombre: funcionario.nombre,
        responsabilidad: `${funcionario.jerarquia} · ${funcionario.institucion}`,
        jerarquia: funcionario.jerarquia,
        telegram: funcionario.telefono,
        whatsapp: funcionario.telefono,
      })
      .eq("user_id", perfil.user_id);
    await adminClient.auth.admin.updateUserById(perfil.user_id, {
      user_metadata: {
        username,
        terreno: true,
        centro_id: centroId,
        funcionario,
      },
    });
  }

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
    detalle: {
      origen: funcionario ? "qr_identificado" : "qr",
      funcionario: funcionario ?? null,
    },
  });

  return json(
    {
      token_hash: enlace.properties.hashed_token,
      centro_id: centroId,
      username,
      funcionario: funcionario ?? null,
    },
    200,
  );
});
