import { useSyncExternalStore } from "react";
import type { EntityTable } from "dexie";
import { db } from "./db";
import { api, type FilaSync } from "./api";
import { getToken } from "./auth";
import type { LineaReferencia, PuntoServicio, Sector } from "../domain/tipos";

// ---- Estado observable para la UI ----
export type EstadoSync = "idle" | "sincronizando" | "ok" | "error" | "offline";
let estadoSync: EstadoSync = "idle";
const subs = new Set<() => void>();
function setEstado(e: EstadoSync) {
  estadoSync = e;
  for (const s of subs) s();
}
export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => estadoSync,
  );
}

// ---- lastSync (marca de tiempo del último pull) ----
const LAST_KEY = "refugio.lastSync";
function getLastSync(): number {
  return Number(localStorage.getItem(LAST_KEY) ?? 0) || 0;
}
function setLastSync(ts: number): void {
  try {
    localStorage.setItem(LAST_KEY, String(ts));
  } catch {
    /* ignore */
  }
}
/** Fuerza una descarga completa en el próximo sync (usar al iniciar sesión). */
export function reiniciarLastSync(): void {
  setLastSync(0);
}

// ---- Aplicar filas entrantes a Dexie (last-write-wins) ----
type Tabla =
  | EntityTable<Sector, "id">
  | EntityTable<PuntoServicio, "id">
  | EntityTable<LineaReferencia, "id">;

/** Filas antiguas del servidor pueden traer `data` como string JSON. */
function normalizarData(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

async function aplicarFila(tabla: Tabla, fila: FilaSync): Promise<void> {
  const local = await tabla.get(fila.id);
  if (local && local.updated_at > fila.updated_at) return; // lo local es más nuevo
  if (fila.deleted) {
    await tabla.delete(fila.id);
  } else {
    // Los metadatos de la fila mandan sobre el blob (garantiza id/updated_at).
    const base = normalizarData(fila.data);
    const obj = {
      ...(base as Record<string, unknown>),
      id: fila.id,
      updated_at: fila.updated_at,
      updated_by: fila.updated_by ?? null,
    };
    await tabla.put(obj as never);
  }
}

async function aplicarLote(
  entidad: "sectores" | "puntos" | "lineas",
  filas: FilaSync[],
): Promise<void> {
  if (!filas.length) return;
  const tabla = (
    entidad === "sectores" ? db.sectores : entidad === "puntos" ? db.puntos : db.lineas
  ) as Tabla;
  await db.transaction("rw", tabla, async () => {
    for (const f of filas) await aplicarFila(tabla, f);
  });
}

// ---- Push / Pull ----
async function push(): Promise<void> {
  const items = await db.outbox.toArray();
  if (!items.length) return;
  const body: { sectores: FilaSync[]; puntos: FilaSync[]; lineas: FilaSync[] } = {
    sectores: [],
    puntos: [],
    lineas: [],
  };
  for (const it of items) {
    const fila: FilaSync = {
      id: it.id,
      updated_at: it.updated_at,
      deleted: it.deleted,
      data: it.data,
    };
    body[it.entidad].push(fila);
  }
  await api.push(body);
  // Borrar de la cola lo enviado, salvo que haya cambiado mientras tanto.
  await db.transaction("rw", db.outbox, async () => {
    for (const it of items) {
      const actual = await db.outbox.get(it.clave);
      if (actual && actual.updated_at <= it.updated_at) {
        await db.outbox.delete(it.clave);
      }
    }
  });
}

async function pull(): Promise<void> {
  const r = await api.pull(getLastSync());
  await aplicarLote("sectores", r.sectores);
  await aplicarLote("puntos", r.puntos);
  await aplicarLote("lineas", r.lineas);
  setLastSync(r.serverTime);
}

let sincronizando = false;
export async function sincronizar(): Promise<void> {
  if (!getToken() || !navigator.onLine || sincronizando) return;
  sincronizando = true;
  setEstado("sincronizando");
  try {
    await push();
    await pull();
    setEstado("ok");
  } catch (e) {
    setEstado("error");
    console.warn("[sync]", e);
  } finally {
    sincronizando = false;
  }
}

// ---- WebSocket de tiempo real ----
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function conectarWs(): void {
  const token = getToken();
  if (!token || ws) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
  ws = socket;
  socket.onmessage = async (ev) => {
    try {
      const msg = JSON.parse(ev.data) as {
        type: string;
        entidad?: "sectores" | "puntos" | "lineas";
        filas?: FilaSync[];
      };
      if (msg.type === "cambio" && msg.entidad && msg.filas) {
        await aplicarLote(msg.entidad, msg.filas);
      }
    } catch {
      /* mensaje inválido */
    }
  };
  socket.onclose = () => {
    if (ws === socket) ws = null;
    programarReconexion();
  };
  socket.onerror = () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  };
}

function programarReconexion(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (getToken() && navigator.onLine) conectarWs();
  }, 4000);
}

// ---- Ciclo de vida ----
let intervalo: ReturnType<typeof setInterval> | null = null;
let iniciado = false;
let debounce: ReturnType<typeof setTimeout> | null = null;

function alConectar() {
  sincronizar();
  if (!ws) conectarWs();
}
function alDesconectar() {
  setEstado("offline");
}

export function iniciarSync(): void {
  if (iniciado) return;
  iniciado = true;
  window.addEventListener("online", alConectar);
  window.addEventListener("offline", alDesconectar);
  intervalo = setInterval(sincronizar, 20_000);
  sincronizar();
  conectarWs();
}

export function detenerSync(): void {
  iniciado = false;
  window.removeEventListener("online", alConectar);
  window.removeEventListener("offline", alDesconectar);
  if (intervalo) clearInterval(intervalo);
  intervalo = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  ws = null;
  setEstado("idle");
}

/** Llamado por repos.ts tras cada cambio local (con rebote). */
export function notificarCambioLocal(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    sincronizar();
  }, 400);
}
