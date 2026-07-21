// Edge Function `create-user` (v5 — alta scoped de operadores, plan
// migración operadores §5.1/§5.3).
//
// Crea un usuario completo: `auth.users` (email sintético <username>@refugio.app)
// + fila en `perfiles`, con rol de los 5 nuevos y centros asignados (array).
// El `hash_id` de la marca de agua se genera AQUÍ (servidor), formato
// XXXX-XXXX hex, único e inmutable. Registra la acción en `historial`.
//
// Autorización:
//   - admin: cualquier rol, como siempre.
//   - analista_sae / supervisor: SOLO rol operador, con cédula obligatoria,
//     username forzado a `op-<cédula>`, ámbito 'centros' y centros ⊆ su
//     alcance (analista de red: cualquier centro; el resto vía RPC
//     `centros_de_usuario`). Anti-duplicados por `cedula_norm`.
//   - La contraseña de un operador nunca puede ser su cédula (§2 del plan).
//
// Desplegada vía MCP `deploy_edge_function` (verify_jwt: true). Este archivo
// es la referencia versionada del código que corre en producción.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES_VALIDOS = [
  "admin",
  "analista_sae",
  "autoridad",
  "supervisor",
  "operador",
  "censo_rapido",
];

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

  // 1) JWT del caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 2) El caller debe ser admin
  const {
    data: { user: caller },
    error: callerErr,
  } = await adminClient.auth.getUser(token);
  if (callerErr || !caller) return json({ error: "Token inválido" }, 401);

  const { data: perfilCaller } = await adminClient
    .from("perfiles")
    .select("rol, username, ambito_analista")
    .eq("user_id", caller.id)
    .single();
  const esAdmin = perfilCaller?.rol === "admin";
  const esCallerScoped =
    perfilCaller?.rol === "analista_sae" || perfilCaller?.rol === "supervisor";
  if (!perfilCaller || (!esAdmin && !esCallerScoped)) {
    return json({ error: "Su rol no puede crear usuarios" }, 403);
  }

  // 3) Body
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  let {
    username,
    password,
    nombre,
    rol,
    ambito_analista,
    cuerpo_asignado,
    centros_asignados,
    jerarquia,
    cedula,
    responsabilidad,
    whatsapp,
    telegram,
    brazalete,
    marca_agua,
  } = body || {};

  if (!username || !password || !nombre || !rol) {
    return json({ error: "Faltan campos requeridos: username, password, nombre, rol" }, 400);
  }
  if (typeof password !== "string" || password.length < 6) {
    return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return json({ error: "Rol inválido" }, 400);
  }

  // Cédula normalizada (solo dígitos), misma convención que el flujo v3 de
  // terreno (`op-<cedula_norm>` / cedula_norm sin letra).
  const cedulaNorm =
    typeof cedula === "string" ? cedula.replace(/\D/g, "") : "";

  // 3.b) Reglas del caller scoped (analista/supervisor): solo operadores,
  //      con cédula, username canónico y ámbito por lista de centros.
  if (!esAdmin) {
    if (rol !== "operador") {
      return json({ error: "Su rol solo puede crear cuentas de operador" }, 403);
    }
    if (!cedulaNorm) {
      return json({ error: "La cédula es obligatoria para crear un operador" }, 400);
    }
    if (username !== `op-${cedulaNorm}`) {
      return json({ error: `El usuario del operador debe ser op-${cedulaNorm}` }, 400);
    }
    ambito_analista = "centros";
    cuerpo_asignado = null;
    if (!Array.isArray(centros_asignados) || centros_asignados.length === 0) {
      return json({ error: "Asigne al menos un campamento al operador" }, 400);
    }
  }

  // 3.c) Nunca contraseña = cédula para operadores (reabriría el hueco de
  //      suplantación durante la coexistencia, plan §2).
  if (rol === "operador" && cedulaNorm && password.replace(/\D/g, "") === cedulaNorm) {
    return json({ error: "La contraseña no puede ser la cédula del operador" }, 400);
  }

  // 3.d) Anti-duplicados: una sola cuenta de operador por cédula.
  if (rol === "operador" && cedulaNorm) {
    const { data: dupe } = await adminClient
      .from("perfiles")
      .select("username")
      .eq("rol", "operador")
      .eq("cedula_norm", cedulaNorm)
      .maybeSingle();
    if (dupe) {
      return json(
        { error: `Ya existe un operador con esa cédula (${dupe.username}). Asígnele el campamento en vez de crearlo de nuevo.` },
        409,
      );
    }
  }

  // Alcance de los roles limitados: el analista acepta 'red' | 'cuerpo' |
  // 'centros'; supervisor y operador solo 'cuerpo' | 'centros' ('red' se
  // corrige a 'centros'). 'cuerpo' exige un cuerpo policial existente.
  // Para el resto de roles se ignora y se guarda 'red'.
  const ROLES_CON_AMBITO = ["analista_sae", "supervisor", "operador"];
  let ambito = "red";
  let cuerpo: string | null = null;
  if (ROLES_CON_AMBITO.includes(rol)) {
    if (rol !== "analista_sae") ambito = "centros";
    if (ambito_analista != null) {
      if (!["red", "cuerpo", "centros"].includes(ambito_analista)) {
        return json({ error: "ambito_analista inválido (red | cuerpo | centros)" }, 400);
      }
      ambito =
        rol !== "analista_sae" && ambito_analista === "red" ? "centros" : ambito_analista;
    }
    if (ambito === "cuerpo") {
      if (typeof cuerpo_asignado !== "string" || !cuerpo_asignado.trim()) {
        return json({ error: "Falta cuerpo_asignado para el ámbito 'cuerpo'" }, 400);
      }
      const { data: filaCuerpo } = await adminClient
        .from("cuerpos_policiales")
        .select("clave")
        .eq("clave", cuerpo_asignado.trim())
        .maybeSingle();
      if (!filaCuerpo) {
        return json({ error: `Cuerpo policial inexistente: ${cuerpo_asignado}` }, 400);
      }
      cuerpo = cuerpo_asignado.trim();
    }
  }

  // 4) Centros asignados: deben existir y no estar borrados
  let centros: string[] = [];
  if (centros_asignados != null) {
    if (
      !Array.isArray(centros_asignados) ||
      centros_asignados.some((c) => typeof c !== "string" || !c)
    ) {
      return json({ error: "centros_asignados debe ser un array de IDs de centro" }, 400);
    }
    centros = [...new Set(centros_asignados as string[])];
    if (centros.length > 0) {
      const { data: filas, error: centrosErr } = await adminClient
        .from("centros")
        .select("id")
        .in("id", centros)
        .eq("deleted", false);
      if (centrosErr) return json({ error: `Error validando centros: ${centrosErr.message}` }, 500);
      const validos = new Set((filas ?? []).map((f: { id: string }) => f.id));
      const invalidos = centros.filter((c) => !validos.has(c));
      if (invalidos.length > 0) {
        return json({ error: `Centros inexistentes o eliminados: ${invalidos.join(", ")}` }, 400);
      }
    }
  }

  // 4.b) Caller scoped: los centros del nuevo operador deben estar dentro de
  //      su alcance (analista de red: cualquier centro).
  if (!esAdmin && !(perfilCaller.rol === "analista_sae" && perfilCaller.ambito_analista === "red")) {
    const { data: alcance, error: alcanceErr } = await adminClient.rpc(
      "centros_de_usuario",
      { p_user_id: caller.id },
    );
    if (alcanceErr) {
      return json({ error: `No se pudo validar el alcance: ${alcanceErr.message}` }, 500);
    }
    const propios = new Set((alcance ?? []) as string[]);
    const fuera = centros.filter((c) => !propios.has(c));
    if (fuera.length > 0) {
      return json({ error: `Solo puede asignar campamentos de su alcance. Fuera de alcance: ${fuera.join(", ")}` }, 403);
    }
  }

  // 5) hash_id único generado en el servidor (inmutable de por vida)
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

  // 6) Crear auth.users
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: `${username}@refugio.app`,
    password,
    email_confirm: true,
    user_metadata: { username, nombre },
  });
  if (createErr) {
    const status = createErr.message.includes("already") ? 409 : 400;
    return json({ error: createErr.message }, status);
  }

  // 7) Insertar perfil; si falla, rollback del auth.user
  const { error: perfilErr } = await adminClient.from("perfiles").insert({
    user_id: newUser.user.id,
    username,
    nombre,
    rol,
    ambito_analista: ambito,
    cuerpo_asignado: cuerpo,
    centros_asignados: centros,
    jerarquia,
    cedula,
    cedula_norm: cedulaNorm || null,
    responsabilidad,
    whatsapp,
    telegram,
    brazalete,
    hash_id: hashId,
    marca_agua: marca_agua ?? true,
  });
  if (perfilErr) {
    await adminClient.auth.admin.deleteUser(newUser.user.id);
    return json({ error: `Error creando perfil: ${perfilErr.message}` }, 500);
  }

  // 8) Bitácora
  await adminClient.from("historial").insert({
    ts: Date.now(),
    usuario: perfilCaller.username,
    accion: "crear_usuario",
    entidad: "usuario",
    entidad_id: newUser.user.id,
    detalle: {
      username,
      nombre,
      rol,
      ambito_analista: ambito,
      cuerpo_asignado: cuerpo,
      centros_asignados: centros,
    },
  });

  return json(
    {
      user_id: newUser.user.id,
      username,
      nombre,
      rol,
      centros_asignados: centros,
      hash_id: hashId,
    },
    201,
  );
});
