import { useSyncExternalStore } from "react";

export type Rol = "admin" | "coordinador" | "campo" | "visor";

export interface Usuario {
  sub: string;
  username: string;
  nombre: string | null;
  rol: Rol;
  /** Sector del que es responsable (solo campo). Puede faltar en sesiones viejas. */
  sector_asignado?: string | null;
}

export interface Sesion {
  token: string;
  user: Usuario;
}

const KEY = "refugio.sesion";

function cargar(): Sesion | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

let estado: Sesion | null = cargar();
const listeners = new Set<() => void>();

function emitir() {
  for (const l of listeners) l();
}

export function getSesion(): Sesion | null {
  return estado;
}
export function getToken(): string | null {
  return estado?.token ?? null;
}
export function getUsuario(): Usuario | null {
  return estado?.user ?? null;
}

export function setSesion(s: Sesion): void {
  estado = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible */
  }
  emitir();
}

export function cerrarSesion(): void {
  estado = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emitir();
}

function suscribir(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Hook de React para la sesión actual. */
export function useSesion(): Sesion | null {
  return useSyncExternalStore(suscribir, getSesion);
}
