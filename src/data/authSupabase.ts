// Nueva capa de autenticación basada en Supabase Auth (Fase 3 de la migración).
// Reemplaza a `src/data/auth.ts` (legacy) conservando la MISMA interfaz pública
// para no romper a los consumidores durante la Fase 4 (adaptación de UI).
//
// Modelo: Supabase Auth gestiona el par email/password. Los usuarios de campo
// no tienen email real → usamos el sintético `<username>@refugio.app`. La
// metadata ampliada (rol, centros_asignados, hash_id, marca_agua, jerarquia,
// cedula, etc.) vive en la tabla `perfiles`, vinculada a `auth.users` por
// `user_id`. Tras login exitoso hacemos un select a `perfiles` y lo mergeamos
// en el `Usuario` expuesto.

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type Rol = "admin" | "analista_sae" | "autoridad" | "supervisor" | "operador";

export interface Usuario {
  /** Mantiene compatibilidad con la sesión legacy (sub = auth.uid). */
  sub: string;
  username: string;
  nombre: string | null;
  rol: Rol;
  /** Centros asignados (supervisor/operador operan solo en ellos; para el
   *  analista SAE son su ámbito de monitoreo). */
  centros_asignados: string[];
  /** Identificador de sistema para la marca de agua anti-foto. */
  hash_id?: string | null;
  /** Mostrar la marca de agua de seguridad en la pantalla de este usuario. */
  marca_agua?: boolean;
  /** Campos del perfil ampliado (opcionales para tolerar sesiones viejas). */
  jerarquia?: string | null;
  cedula?: string | null;
  responsabilidad?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  brazalete?: string | null;
}

export interface Sesion {
  token: string;
  user: Usuario;
}

/** Fila de la tabla `perfiles` (subset de los campos que guardamos). */
interface Perfil {
  user_id: string;
  username: string | null;
  nombre: string | null;
  rol: Rol;
  centros_asignados: string[] | null;
  hash_id: string | null;
  marca_agua: boolean;
  jerarquia: string | null;
  cedula: string | null;
  responsabilidad: string | null;
  whatsapp: string | null;
  telegram: string | null;
  brazalete: string | null;
}

const ROLES_CONOCIDOS: Rol[] = ["admin", "analista_sae", "autoridad", "supervisor", "operador"];

const listeners = new Set<() => void>();
let estado: Sesion | null = null;
let initialized = false;

function emitir(): void {
  for (const l of listeners) l();
}

/** Construye un `Usuario` de la app desde la sesión de Supabase + perfil. */
function mapearUsuario(session: Session, perfil: Perfil | null): Usuario {
  const username = perfil?.username ?? extraerUsernameDeEmail(session.user.email ?? "");
  return {
    sub: session.user.id,
    username,
    nombre: perfil?.nombre ?? null,
    // Rol desconocido o perfil ausente → autoridad (solo lectura, seguro).
    rol: perfil?.rol && ROLES_CONOCIDOS.includes(perfil.rol) ? perfil.rol : "autoridad",
    centros_asignados: perfil?.centros_asignados ?? [],
    hash_id: perfil?.hash_id ?? null,
    marca_agua: perfil?.marca_agua ?? true,
    jerarquia: perfil?.jerarquia ?? null,
    cedula: perfil?.cedula ?? null,
    responsabilidad: perfil?.responsabilidad ?? null,
    whatsapp: perfil?.whatsapp ?? null,
    telegram: perfil?.telegram ?? null,
    brazalete: perfil?.brazalete ?? null,
  };
}

/** Invierte el email sintético `<username>@refugio.app` → `username`. */
function extraerUsernameDeEmail(email: string): string {
  const i = email.lastIndexOf("@");
  return i > 0 ? email.slice(0, i) : email;
}

/** Carga el perfil desde `perfiles` para un `user_id` dado. */
async function cargarPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[authSupabase] error cargando perfil:", error.message);
    return null;
  }
  return (data as Perfil | null) ?? null;
}

/**
 * Construye y publica el estado de sesión a partir de la sesión de Supabase.
 * Si no hay sesión de Auth, limpia el estado. Si la hay, carga el perfil y
 * arma el `Sesion` de la app.
 */
async function aplicarSesion(session: Session | null): Promise<void> {
  if (!session) {
    estado = null;
    emitir();
    return;
  }
  const perfil = await cargarPerfil(session.user.id);
  estado = { token: session.access_token, user: mapearUsuario(session, perfil) };
  emitir();
}

/**
 * Inicializa la suscripción a `onAuthStateChange` y carga la sesión inicial.
 * Idempotente. Lo llama `getSesion`/`useSesion`/`login` automáticamente para
 * que los consumidores no tengan que acordarse, pero también se puede invocar
 * al arrancar la app.
 */
export async function initAuth(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const { data } = await supabase.auth.getSession();
  await aplicarSesion(data.session);
  supabase.auth.onAuthStateChange((_event, session) => {
    void aplicarSesion(session);
  });
}

export function getSesion(): Sesion | null {
  // Inicializa perezosamente en la primera lectura (no bloquea: la sesión
  // inicial se carga async y se refleja vía listeners cuando llegue).
  void initAuth();
  return estado;
}

export function getToken(): string | null {
  return getSesion()?.token ?? null;
}

export function getUsuario(): Usuario | null {
  return getSesion()?.user ?? null;
}

/** Alias pedido por la tarea (mismo significado que `getUsuario`). */
export function usuarioActual(): Usuario | null {
  return getUsuario();
}

/**
 * Login con username (se mapea a `<username>@refugio.app`) + password.
 * Supabase Auth gestiona el refresh del token; no hace falta reenviarlo en
 * cada fetch (supabase-js lo adjunta solo). `onAuthStateChange` actualiza el
 * estado de esta capa.
 */
export async function login(username: string, password: string): Promise<Sesion> {
  const email = `${username.trim()}@refugio.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Login sin sesión devuelta");
  const perfil = await cargarPerfil(data.session.user.id);
  estado = { token: data.session.access_token, user: mapearUsuario(data.session, perfil) };
  emitir();
  return estado;
}

/**
 * Permite setear una sesión externa (p. ej. al migrar de un token propio).
 * Hoy no se usa porque Supabase Auth gestiona la sesión, pero se conserva por
 * compatibilidad con la interfaz legacy.
 */
export function setSesion(s: Sesion | null): void {
  estado = s;
  emitir();
}

export async function cerrarSesion(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[authSupabase] error en signOut:", e);
  }
  estado = null;
  emitir();
}

function suscribir(l: () => void): () => void {
  listeners.add(l);
  // Asegura que la sesión inicial ya esté cargando.
  void initAuth();
  return () => listeners.delete(l);
}

/** Hook de React para la sesión actual (reemplaza al de `auth.ts`). */
export function useSesion(): Sesion | null {
  return useSyncExternalStore(suscribir, getSesion);
}
