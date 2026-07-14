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
import { FunctionsHttpError } from "@supabase/supabase-js";
import { puedeEditarCuentaPropia } from "@/domain/permisos";
import { capHabilitado } from "./capConfig";
import { supabase } from "./supabaseClient";

export type Rol =
  | "admin"
  | "analista_sae"
  | "autoridad"
  | "supervisor"
  | "operador"
  | "censo_rapido";

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

const ROLES_CONOCIDOS: Rol[] = [
  "admin",
  "analista_sae",
  "autoridad",
  "supervisor",
  "operador",
  "censo_rapido",
];

const listeners = new Set<() => void>();
let estado: Sesion | null = null;
// Promesa memoizada de la inicialización: TODOS los llamadores de initAuth()
// esperan a la MISMA carga real de la sesión. Con un booleano, el segundo
// llamador retornaba al instante sin esperar y el login destellaba al recargar.
let initPromise: Promise<void> | null = null;

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

/** Recarga el estado de la app desde la sesión actual de Supabase Auth. */
export async function sincronizarSesion(): Promise<Sesion | null> {
  await initAuth();
  const { data } = await supabase.auth.getSession();
  await aplicarSesion(data.session);
  return estado;
}

/**
 * Inicializa la suscripción a `onAuthStateChange` y carga la sesión inicial.
 * Idempotente. Lo llama `getSesion`/`useSesion`/`login` automáticamente para
 * que los consumidores no tengan que acordarse, pero también se puede invocar
 * al arrancar la app.
 */
export function initAuth(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { data } = await supabase.auth.getSession();
    await aplicarSesion(data.session);
    supabase.auth.onAuthStateChange((_event, session) => {
      void aplicarSesion(session);
    });
  })();
  return initPromise;
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

/** Traduce mensajes típicos de Supabase Auth al español (UI). */
export function mensajeErrorLogin(mensaje: string | null | undefined): string {
  const raw = (mensaje ?? "").trim();
  if (!raw) return "No se pudo iniciar sesión";
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Usuario o contraseña incorrectos";
  }
  if (lower.includes("email not confirmed")) {
    return "La cuenta aún no está confirmada";
  }
  if (lower.includes("user banned") || lower.includes("user is banned")) {
    return "Esta cuenta está deshabilitada";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Sin conexión. Revisa la red e inténtalo de nuevo";
  }
  return raw;
}

/** Campos que el propio usuario puede editar en `/config/perfil`. */
export type DatosPerfilEditable = {
  nombre: string;
  jerarquia: string;
  cedula: string;
  responsabilidad: string;
  whatsapp: string;
  telegram: string;
  brazalete: string;
  marca_agua: boolean;
};

/**
 * Actualiza la ficha del usuario autenticado (sin tocar rol, centros ni hash_id).
 * La RLS de `perfiles` ya limita el UPDATE a la fila propia.
 */
export async function actualizarMiPerfil(
  datos: DatosPerfilEditable,
): Promise<Sesion> {
  await initAuth();
  const sesion = getSesion();
  if (!sesion) throw new Error("No autenticado");
  if (!puedeEditarCuentaPropia(sesion.user)) {
    throw new Error("Las cuentas temporales de terreno no editan su perfil");
  }
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio");

  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre,
      jerarquia: datos.jerarquia.trim() || null,
      cedula: datos.cedula.trim() || null,
      responsabilidad: datos.responsabilidad.trim() || null,
      whatsapp: datos.whatsapp.trim() || null,
      telegram: datos.telegram.trim() || null,
      brazalete: datos.brazalete.trim() || null,
      marca_agua: datos.marca_agua,
    })
    .eq("user_id", sesion.user.sub);

  if (error) throw new Error(error.message);

  const sincronizada = await sincronizarSesion();
  if (!sincronizada) throw new Error("Sesión perdida tras guardar el perfil");
  return sincronizada;
}

/**
 * Cambia la contraseña del usuario autenticado.
 * Exige la actual (re-auth) y aplica la nueva con `auth.updateUser`.
 */
export async function cambiarMiPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<void> {
  await initAuth();
  const sesion = getSesion();
  if (!sesion) throw new Error("No autenticado");
  if (!puedeEditarCuentaPropia(sesion.user)) {
    throw new Error("Las cuentas temporales de terreno no tienen contraseña propia");
  }
  if (!passwordActual) throw new Error("Indica la contraseña actual");
  if (typeof passwordNueva !== "string" || passwordNueva.length < 6) {
    throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
  }
  if (passwordActual === passwordNueva) {
    throw new Error("La nueva contraseña debe ser distinta a la actual");
  }

  const email = `${sesion.user.username}@refugio.app`;
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email,
    password: passwordActual,
  });
  if (reauthErr) throw new Error("Contraseña actual incorrecta");

  const { error } = await supabase.auth.updateUser({ password: passwordNueva });
  if (error) throw new Error(error.message);
}

/**
 * Login con username (se mapea a `<username>@refugio.app`) + password.
 * Supabase Auth gestiona el refresh del token; no hace falta reenviarlo en
 * cada fetch (supabase-js lo adjunta solo). `onAuthStateChange` actualiza el
 * estado de esta capa.
 */
export async function login(
  username: string,
  password: string,
  capToken?: string,
): Promise<Sesion> {
  if (capHabilitado) {
    if (!capToken?.trim()) {
      throw new Error("Completa la verificación de seguridad");
    }
    return loginConCap(username, password, capToken.trim());
  }

  const email = `${username.trim()}@refugio.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(mensajeErrorLogin(error.message));
  if (!data.session) throw new Error("Login sin sesión devuelta");
  const perfil = await cargarPerfil(data.session.user.id);
  estado = { token: data.session.access_token, user: mapearUsuario(data.session, perfil) };
  emitir();
  return estado;
}

/** Login vía Edge Function que verifica Cap antes de autenticar. */
async function loginConCap(
  username: string,
  password: string,
  capToken: string,
): Promise<Sesion> {
  const { data, error } = await supabase.functions.invoke<{
    access_token?: string;
    refresh_token?: string;
    error?: string;
  }>("login-with-cap", {
    body: { username: username.trim(), password, capToken },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalle = (await error.context.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(mensajeErrorLogin(detalle?.error || "No se pudo iniciar sesión"));
    }
    throw new Error(mensajeErrorLogin(error.message || "No se pudo iniciar sesión"));
  }

  if (data?.error) throw new Error(mensajeErrorLogin(data.error));
  if (!data?.access_token || !data.refresh_token) {
    throw new Error("Login sin sesión devuelta");
  }

  const { data: sesionData, error: sesionErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sesionErr) throw new Error(sesionErr.message);
  if (!sesionData.session) throw new Error("Login sin sesión devuelta");

  const perfil = await cargarPerfil(sesionData.session.user.id);
  estado = {
    token: sesionData.session.access_token,
    user: mapearUsuario(sesionData.session, perfil),
  };
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
