// Edge Function `registrar-incidente`
//
// Endpoint server-to-server para el vigilante del VPS (vigilante-nexus.sh):
// abre y cierra incidentes en `incidentes_servicios` cuando un servicio
// monitoreado cae o se recupera. Alimenta la vista /estado de la app y el
// banner público de /censo y /terreno (vía RPC estado_servicios_publico).
//
// Auth: verify_jwt FALSE (el vigilante no tiene sesión Supabase); en su lugar
// exige el header `x-vigilante-secret` igual a
// `app_secrets.vigilante_incidentes_secret` (tabla RLS deny-all, mismo patrón
// que telegram-bot). Sin el secret: 401.
//
// Body JSON:
//   { evento: "caida" | "recuperacion",
//     servicio?: string  (default "nexus"),
//     tipo?: "externo" | "plataforma"  (default "externo"),
//     causa?: string, detalle?: object }
//
// Idempotente: una "caida" con incidente ya abierto solo refresca causa y
// detalle (índice único parcial: un abierto por servicio); una "recuperacion"
// sin incidente abierto es no-op. Registra incidente_abierto /
// incidente_resuelto (con duracion_min) en `historial`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const secretHeader = req.headers.get("x-vigilante-secret")?.trim() ?? "";
  const { data: sec } = await admin
    .from("app_secrets")
    .select("valor")
    .eq("clave", "vigilante_incidentes_secret")
    .maybeSingle();
  if (!sec?.valor || !secretHeader || secretHeader !== sec.valor) {
    return json({ error: "no_autorizado" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "json_invalido" }, 400);
  }

  const evento = body.evento;
  if (evento !== "caida" && evento !== "recuperacion") {
    return json({ error: "evento_invalido" }, 400);
  }
  const servicio = String(body.servicio ?? "nexus").slice(0, 40);
  const tipo = body.tipo === "plataforma" ? "plataforma" : "externo";
  const causa = body.causa ? String(body.causa).slice(0, 200) : null;
  const detalle =
    body.detalle && typeof body.detalle === "object" ? body.detalle : {};
  const ahora = Date.now();

  const { data: abierto, error: errSel } = await admin
    .from("incidentes_servicios")
    .select("id, inicio_ts, causa")
    .eq("servicio", servicio)
    .eq("estado", "abierto")
    .maybeSingle();
  if (errSel) return json({ error: errSel.message }, 500);

  if (evento === "caida") {
    if (abierto) {
      // Ya hay incidente abierto: solo refrescar causa/detalle.
      await admin
        .from("incidentes_servicios")
        .update({ causa: causa ?? abierto.causa, detalle, updated_at: ahora })
        .eq("id", abierto.id);
      return json({ ok: true, id: abierto.id, ya_abierto: true }, 200);
    }
    const { data: fila, error: errIns } = await admin
      .from("incidentes_servicios")
      .insert({ servicio, tipo, causa, detalle, inicio_ts: ahora, updated_at: ahora })
      .select("id")
      .single();
    if (errIns) return json({ error: errIns.message }, 500);
    await admin.from("historial").insert({
      ts: ahora,
      usuario: "vigilante-nexus",
      accion: "incidente_abierto",
      entidad: "servicio",
      entidad_id: servicio,
      detalle: { causa, ...detalle },
    });
    return json({ ok: true, id: fila.id }, 200);
  }

  // recuperacion
  if (!abierto) return json({ ok: true, sin_incidente: true }, 200);
  const duracionMin = Math.max(
    1,
    Math.round((ahora - Number(abierto.inicio_ts)) / 60000),
  );
  const { error: errUpd } = await admin
    .from("incidentes_servicios")
    .update({ estado: "resuelto", fin_ts: ahora, updated_at: ahora })
    .eq("id", abierto.id);
  if (errUpd) return json({ error: errUpd.message }, 500);
  await admin.from("historial").insert({
    ts: ahora,
    usuario: "vigilante-nexus",
    accion: "incidente_resuelto",
    entidad: "servicio",
    entidad_id: servicio,
    detalle: { duracion_min: duracionMin, causa: abierto.causa },
  });
  return json({ ok: true, id: abierto.id, duracion_min: duracionMin }, 200);
});
