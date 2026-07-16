// Edge Function `login-terreno` v3 (acceso de campo, Fase A del plan de
// identidad — docs/plan-identidad-terreno.md).
//
// Canjea un token de terreno (`tokens_centros.tipo = 'personal'`) por una
// sesión de operador. Tres modos:
//
//   1. **Por cédula (v3, preferido)** — `paso: "consultar"` resuelve la
//      identidad (perfil existente → nexus_consultas → gateway Nexus con
//      X-Gateway-Secret → desconocida) sin crear nada; `paso: "entrar"`
//      hace find-or-create del usuario ÚNICO `op-<cedula_norm>` (una persona
//      = un usuario para siempre), agrega el campamento a centros_asignados
//      y emite el magiclink. Usuarios nuevos quedan `aprobacion: 'pendiente'`
//      (bandeja de analistas, decisión (b) del 16-jul) y `verificado_nexus`
//      según la fuente del nombre (Nexus o manual).
//   2. **Legacy `funcionario` (v2)** — usuario temporal por persona
//      `operador-<centro_id>-<huella>`. Se mantiene durante la transición
//      (lo usa /censo).
//   3. **Legacy compartido (v1)** — sin funcionario ni cédula:
//      `operador-<centro_id>`.
//
// El secret del gateway Nexus vive en `app_secrets` (tabla RLS deny-all,
// solo la service role la lee). Emite magiclink (`hashed_token`); el
// frontend lo canjea con verifyOtp. Desplegada vía MCP `deploy_edge_function`
// (verify_jwt: true).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEXUS_GATEWAY_URL = "https://nexus.m0n1t0r-d3-3v3nt0s.net";
/** Timeout de la consulta al gateway (VPN institucional; puede colgarse). */
const NEXUS_TIMEOUT_MS = 8000;

interface FuncionarioBody {
  jerarquia?: string;
  nombre?: string;
  institucion?: string;
  telefono?: string;
}

interface Body {
  token?: string;
  funcionario?: FuncionarioBody;
  // v3
  paso?: "consultar" | "entrar";
  cedula?: string;
  letra?: string;
  jerarquia?: string;
  /** Solo cuando la cédula no se pudo verificar (Nexus caído y sin caché). */
  nombre_manual?: string;
}

interface PersonaNexusSlim {
  ok?: boolean;
  nombre_completo?: string;
  primer_nombre?: string;
  primer_apellido?: string;
  sexo?: string | null;
  fecha_nacimiento?: string | null;
  fallecido?: boolean;
  error?: string;
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

async function hashIdLibre(admin: SupabaseClient): Promise<string> {
  let hashId = generarHashId();
  for (let i = 0; i < 5; i++) {
    const { data: choque } = await admin
      .from("perfiles")
      .select("user_id")
      .eq("hash_id", hashId)
      .maybeSingle();
    if (!choque) break;
    hashId = generarHashId();
  }
  return hashId;
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

/** Cédula → { letra, digits } o null si es inválida. */
function normalizarCedula(cedula: string, letra: string): { letra: "V" | "E"; digits: string } | null {
  const l = letra === "E" ? "E" : "V";
  const digits = cedula.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 12) return null;
  return { letra: l, digits };
}

/** Ficha Nexus: primero nuestra caché `nexus_consultas`, luego el gateway. */
async function fichaNexus(
  admin: SupabaseClient,
  letra: string,
  digits: string,
): Promise<{ persona: PersonaNexusSlim; origen: "cache" | "nexus" } | { persona: null; origen: "no_encontrada" | "no_disponible" }> {
  const { data: guardada } = await admin
    .from("nexus_consultas")
    .select("data")
    .eq("letra", letra)
    .eq("cedula", digits)
    .maybeSingle();
  if (guardada?.data && (guardada.data as PersonaNexusSlim).nombre_completo) {
    return { persona: guardada.data as PersonaNexusSlim, origen: "cache" };
  }

  const { data: fila } = await admin
    .from("app_secrets")
    .select("valor")
    .eq("clave", "nexus_gateway_secret")
    .maybeSingle();
  const secret = fila?.valor;
  if (!secret) return { persona: null, origen: "no_disponible" };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NEXUS_TIMEOUT_MS);
    const resp = await fetch(
      `${NEXUS_GATEWAY_URL}/v1/person/search/external/full/${letra}/${digits}/censo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gateway-Secret": secret },
        body: "{}",
        signal: ctrl.signal,
      },
    );
    clearTimeout(timer);
    const persona = (await resp.json()) as PersonaNexusSlim;
    if (resp.status === 404 || persona.ok === false) {
      return { persona: null, origen: "no_encontrada" };
    }
    if (!resp.ok || !persona.nombre_completo) {
      return { persona: null, origen: "no_disponible" };
    }
    // Guardar en caché para el resto de la app (fire-and-forget).
    void admin.from("nexus_consultas").upsert(
      {
        letra,
        cedula: digits,
        data: persona,
        actualizado_ts: Date.now(),
        actualizado_por: "login-terreno",
      },
      { onConflict: "letra,cedula" },
    );
    return { persona, origen: "nexus" };
  } catch {
    return { persona: null, origen: "no_disponible" };
  }
}

/**
 * Alerta de seguridad: si la persona tiene Telegram vinculado, le avisa que
 * se inició sesión con su cédula (con botón "No fui yo" que atiende el
 * webhook `telegram-bot`). Fire-and-forget con timeout corto: NUNCA puede
 * demorar ni tumbar el login.
 */
async function notificarLoginTelegram(
  admin: SupabaseClient,
  userId: string,
  detalle: { cedula: string; nombreCentro: string; jerarquia: string },
): Promise<void> {
  try {
    const { data: vinculo } = await admin
      .from("telegram_operadores")
      .select("chat_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!vinculo?.chat_id) return;
    const { data: fila } = await admin
      .from("app_secrets")
      .select("valor")
      .eq("clave", "telegram_bot_token")
      .maybeSingle();
    const botToken = fila?.valor;
    if (!botToken) return;

    const hora = new Date().toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const texto =
      `🔐 *Inicio de sesión con su cédula*\n\n` +
      `Cédula: ${detalle.cedula}\n` +
      `Campamento: *${detalle.nombreCentro}*\n` +
      `Jerarquía declarada: ${detalle.jerarquia}\n` +
      `Hora: ${hora}\n\n` +
      `Si fue usted, ignore este mensaje.`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: vinculo.chat_id,
        text: texto,
        parse_mode: "Markdown",
        reply_markup: {
          // user_id en el callback: un mismo chat puede tener varios usuarios.
          inline_keyboard: [[{ text: "⚠️ No fui yo", callback_data: `nofui:${userId}` }]],
        },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch {
    // La alerta es best-effort; el login sigue.
  }
}

async function magiclink(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data: enlace, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !enlace?.properties?.hashed_token) return null;
  return enlace.properties.hashed_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Body;
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
  const dataCentro = centro.data as {
    nombre?: string;
    cuerpo?: string;
    supervision?: { unidad_sebin?: string };
  };
  const nombreCentro = dataCentro?.nombre?.trim() || centroId;
  const cuerpoCentro = dataCentro?.cuerpo?.trim() || "";
  const unidadCentro = dataCentro?.supervision?.unidad_sebin?.trim() || "";

  // ==========================================================================
  // v3 — identidad por cédula
  // ==========================================================================
  if (body.paso === "consultar" || body.paso === "entrar") {
    const norm = normalizarCedula(
      typeof body.cedula === "string" ? body.cedula : "",
      typeof body.letra === "string" ? body.letra : "V",
    );
    if (!norm) return json({ error: "Cédula inválida" }, 400);
    const { letra, digits } = norm;
    const username = `op-${digits}`;
    const email = `${username}@refugio.app`;

    const { data: perfil } = await adminClient
      .from("perfiles")
      .select("user_id, username, nombre, jerarquia, verificado_nexus, aprobacion, centros_asignados")
      .eq("cedula_norm", digits)
      .eq("rol", "operador")
      .maybeSingle();

    // Identificación rechazada en la bandeja: se bloquea el ingreso.
    if (perfil?.aprobacion === "rechazada") {
      return json(
        { error: "Su identificación fue rechazada por los analistas. Contacte a la coordinación de la red." },
        403,
      );
    }

    if (body.paso === "consultar") {
      if (perfil) {
        return json(
          {
            tipo: "perfil",
            nombre: perfil.nombre,
            jerarquia: perfil.jerarquia ?? null,
            verificado_nexus: perfil.verificado_nexus === true,
            ya_en_centro: (perfil.centros_asignados as string[] | null)?.includes(centroId) ?? false,
            centro: { id: centroId, nombre: nombreCentro, cuerpo: cuerpoCentro, unidad: unidadCentro },
          },
          200,
        );
      }
      const ficha = await fichaNexus(adminClient, letra, digits);
      if (ficha.persona) {
        if (ficha.persona.fallecido === true) {
          return json(
            { error: "Esa cédula figura con acta de defunción. Verifique el número o repórtelo a los analistas SAE." },
            409,
          );
        }
        return json(
          {
            tipo: "nexus",
            origen: ficha.origen,
            nombre: ficha.persona.nombre_completo,
            centro: { id: centroId, nombre: nombreCentro, cuerpo: cuerpoCentro, unidad: unidadCentro },
          },
          200,
        );
      }
      return json(
        {
          tipo: ficha.origen, // "no_encontrada" | "no_disponible"
          centro: { id: centroId, nombre: nombreCentro, cuerpo: cuerpoCentro, unidad: unidadCentro },
        },
        200,
      );
    }

    // paso === "entrar"
    const jerarquia = typeof body.jerarquia === "string" ? body.jerarquia.trim() : "";
    if (!jerarquia) return json({ error: "Falta la jerarquía" }, 400);
    const responsabilidad = [jerarquia, cuerpoCentro || "terreno"].join(" · ");

    if (perfil) {
      // Persona ya registrada: actualizar jerarquía y sumar el campamento.
      const centros = (perfil.centros_asignados as string[] | null) ?? [];
      const centrosNuevos = centros.includes(centroId) ? centros : [...centros, centroId];
      await adminClient
        .from("perfiles")
        .update({ jerarquia, responsabilidad, centros_asignados: centrosNuevos })
        .eq("user_id", perfil.user_id);

      const tokenHash = await magiclink(adminClient, email);
      if (!tokenHash) return json({ error: "No se pudo emitir el acceso" }, 500);

      await adminClient.from("historial").insert({
        ts: Date.now(),
        usuario: username,
        accion: "login_terreno",
        entidad: "centro",
        entidad_id: centroId,
        detalle: {
          origen: "cedula",
          cedula: `${letra}-${digits}`,
          nombre: perfil.nombre,
          centro_agregado: !centros.includes(centroId),
        },
      });
      await notificarLoginTelegram(adminClient, perfil.user_id as string, {
        cedula: `${letra}-${digits}`,
        nombreCentro,
        jerarquia,
      });
      return json(
        {
          token_hash: tokenHash,
          centro_id: centroId,
          username,
          nombre: perfil.nombre,
          verificado_nexus: perfil.verificado_nexus === true,
        },
        200,
      );
    }

    // Usuario nuevo: nombre desde Nexus (verificado) o manual (sin verificar).
    const ficha = await fichaNexus(adminClient, letra, digits);
    let nombre = "";
    let verificado = false;
    if (ficha.persona?.nombre_completo) {
      if (ficha.persona.fallecido === true) {
        return json(
          { error: "Esa cédula figura con acta de defunción. Verifique el número o repórtelo a los analistas SAE." },
          409,
        );
      }
      nombre = ficha.persona.nombre_completo.trim();
      verificado = true;
    } else if (ficha.origen === "no_encontrada") {
      return json({ error: "No se encontró esa cédula en el registro. Verifique el número." }, 404);
    } else {
      // Nexus no disponible: fallback manual, marcado sin verificar.
      nombre = typeof body.nombre_manual === "string" ? body.nombre_manual.trim() : "";
      if (nombre.length < 7 || !/\s/.test(nombre)) {
        return json({ tipo: "requiere_nombre" }, 200);
      }
      verificado = false;
    }

    const { data: nuevo, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        username,
        terreno: true,
        centro_id: centroId,
        cedula: `${letra}-${digits}`,
      },
    });
    if (createErr && !createErr.message.includes("already")) {
      return json({ error: `Error creando operador: ${createErr.message}` }, 500);
    }

    if (nuevo?.user) {
      const { error: perfilErr } = await adminClient.from("perfiles").insert({
        user_id: nuevo.user.id,
        username,
        nombre,
        rol: "operador",
        centros_asignados: [centroId],
        cedula: `${letra}-${digits}`,
        cedula_norm: digits,
        verificado_nexus: verificado,
        aprobacion: "pendiente",
        jerarquia,
        responsabilidad,
        hash_id: await hashIdLibre(adminClient),
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
          origen: "login-terreno-v3",
          cedula: `${letra}-${digits}`,
          nombre,
          verificado_nexus: verificado,
        },
      });
    }

    const tokenHash = await magiclink(adminClient, email);
    if (!tokenHash) return json({ error: "No se pudo emitir el acceso" }, 500);
    return json(
      {
        token_hash: tokenHash,
        centro_id: centroId,
        username,
        nombre,
        verificado_nexus: verificado,
      },
      200,
    );
  }

  // ==========================================================================
  // Legacy v1/v2 — funcionario self-declarado o compartido (transición)
  // ==========================================================================
  const funcionario = normalizarFuncionario(body.funcionario);

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
        hash_id: await hashIdLibre(adminClient),
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

  const tokenHash = await magiclink(adminClient, email);
  if (!tokenHash) return json({ error: "No se pudo emitir el acceso" }, 500);

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
      token_hash: tokenHash,
      centro_id: centroId,
      username,
      funcionario: funcionario ?? null,
    },
    200,
  );
});
