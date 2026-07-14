// Resuelve usernames de terreno (`operador-…`) a «jerarquía · nombre» vía `perfiles`.
// Cache + batch en el módulo para que varios MetaActualizacionBloque compartan un solo SELECT.

import { useEffect, useSyncExternalStore } from "react";
import { esUsuarioTemporalTerreno } from "@/domain/permisos";
import { supabase } from "./supabaseClient";

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

const etiquetas = new Map<string, string>();
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

async function flushCola(): Promise<void> {
  const usernames = [...cola].filter((u) => !etiquetas.has(u) && !enVuelo.has(u));
  cola = new Set();
  if (usernames.length === 0) return;

  for (const u of usernames) enVuelo.add(u);

  const { data, error } = await supabase
    .from("perfiles")
    .select("username, nombre, jerarquia")
    .in("username", usernames);

  if (error) {
    console.warn("[useEtiquetaPerfil]", error.message);
    for (const u of usernames) {
      enVuelo.delete(u);
      if (!etiquetas.has(u)) etiquetas.set(u, u);
    }
    emitir();
    return;
  }

  const hallados = new Set<string>();
  for (const row of data ?? []) {
    if (!row.username) continue;
    hallados.add(row.username);
    etiquetas.set(
      row.username,
      formatearEtiqueta({
        username: row.username,
        nombre: row.nombre,
        jerarquia: row.jerarquia,
      }),
    );
    enVuelo.delete(row.username);
  }
  for (const u of usernames) {
    enVuelo.delete(u);
    if (!hallados.has(u) && !etiquetas.has(u)) etiquetas.set(u, u);
  }
  emitir();
}

function solicitar(username: string): void {
  const u = username.trim();
  if (!u || !esUsernameOperadorTerreno(u)) return;
  if (etiquetas.has(u) || enVuelo.has(u) || cola.has(u)) return;
  cola.add(u);
  if (timerFlush != null) return;
  timerFlush = setTimeout(() => {
    timerFlush = null;
    void flushCola();
  }, 0);
}

/**
 * Etiqueta legible para atribución en UI.
 * Usuarios de terreno → «JERARQUÍA · NOMBRE»; resto → el username tal cual.
 */
export function useEtiquetaPerfil(username: string | null | undefined): string {
  const quien = (username ?? "").trim();

  useEffect(() => {
    if (quien) solicitar(quien);
  }, [quien]);

  return useSyncExternalStore(
    suscribir,
    () => (quien ? (etiquetas.get(quien) ?? quien) : ""),
    () => quien,
  );
}
