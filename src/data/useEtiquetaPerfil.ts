// Resuelve usernames a «jerarquía · nombre» vía `perfiles` (terreno y resto).
// Cache + batch en el módulo para que varios consumidores compartan un solo SELECT.
// La RLS de `perfiles` limita qué filas ve cada rol; si no hay fila, queda el username.

import { useEffect, useSyncExternalStore } from "react";
import { esUsuarioTemporalTerreno } from "@/domain/permisos";
import { supabase } from "./supabaseClient";

export type AtribucionPerfil = {
  etiqueta: string;
  telefono: string | null;
};

function formatearEtiqueta(row: {
  username: string;
  nombre: string | null;
  jerarquia: string | null;
}): string {
  const nombre = row.nombre?.trim() || "";
  const jerarquia = row.jerarquia?.trim() || "";
  if (nombre && jerarquia) return `${jerarquia} · ${nombre}`;
  if (nombre) return nombre;
  return row.username;
}

/** ¿Username temporal de terreno (compartido o por persona)? */
export function esUsernameOperadorTerreno(username: string): boolean {
  return esUsuarioTemporalTerreno(username);
}

const atribuciones = new Map<string, AtribucionPerfil>();
const listeners = new Set<() => void>();
const enVuelo = new Set<string>();
let cola = new Set<string>();
let timerFlush: ReturnType<typeof setTimeout> | null = null;

function emitir(): void {
  for (const l of listeners) l();
}

function suscribir(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function atribucionFallback(username: string): AtribucionPerfil {
  return { etiqueta: username, telefono: null };
}

async function flushCola(): Promise<void> {
  const usernames = [...cola].filter((u) => !atribuciones.has(u) && !enVuelo.has(u));
  cola = new Set();
  if (usernames.length === 0) return;

  for (const u of usernames) enVuelo.add(u);

  const { data, error } = await supabase
    .from("perfiles")
    .select("username, nombre, jerarquia, whatsapp")
    .in("username", usernames);

  if (error) {
    console.warn("[useEtiquetaPerfil]", error.message);
    for (const u of usernames) {
      enVuelo.delete(u);
      if (!atribuciones.has(u)) atribuciones.set(u, atribucionFallback(u));
    }
    emitir();
    return;
  }

  const hallados = new Set<string>();
  for (const row of data ?? []) {
    if (!row.username) continue;
    hallados.add(row.username);
    const telefono = typeof row.whatsapp === "string" ? row.whatsapp.trim() || null : null;
    atribuciones.set(row.username, {
      etiqueta: formatearEtiqueta({
        username: row.username,
        nombre: row.nombre,
        jerarquia: row.jerarquia,
      }),
      telefono,
    });
    enVuelo.delete(row.username);
  }
  for (const u of usernames) {
    enVuelo.delete(u);
    if (!hallados.has(u) && !atribuciones.has(u)) {
      atribuciones.set(u, atribucionFallback(u));
    }
  }
  emitir();
}

function solicitar(username: string): void {
  const u = username.trim();
  if (!u) return;
  if (atribuciones.has(u) || enVuelo.has(u) || cola.has(u)) return;
  cola.add(u);
  if (timerFlush != null) return;
  timerFlush = setTimeout(() => {
    timerFlush = null;
    void flushCola();
  }, 0);
}

function leerAtribucion(quien: string): AtribucionPerfil {
  if (!quien) return { etiqueta: "", telefono: null };
  return atribuciones.get(quien) ?? atribucionFallback(quien);
}

/**
 * Etiqueta legible para atribución en UI.
 * Con perfil visible → «JERARQUÍA · NOMBRE» (o solo nombre); si no, el username.
 */
export function useEtiquetaPerfil(username: string | null | undefined): string {
  const quien = (username ?? "").trim();

  useEffect(() => {
    if (quien) solicitar(quien);
  }, [quien]);

  return useSyncExternalStore(
    suscribir,
    () => leerAtribucion(quien).etiqueta,
    () => quien,
  );
}

/** Teléfono (WhatsApp) del perfil de terreno, si está cargado. */
export function useTelefonoPerfil(username: string | null | undefined): string | null {
  const quien = (username ?? "").trim();

  useEffect(() => {
    if (quien) solicitar(quien);
  }, [quien]);

  return useSyncExternalStore(
    suscribir,
    () => leerAtribucion(quien).telefono,
    () => null,
  );
}
