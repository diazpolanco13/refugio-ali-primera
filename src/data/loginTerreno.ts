// Login de terreno: canjea el token del QR por una sesión de operador.
//
// v3 (Fase A del plan de identidad): identificación por CÉDULA verificada
// contra Nexus — usuario único `op-<cedula_norm>` por persona, sin importar
// dispositivo o campamento (`consultarIdentidadTerreno` + `entrarPorCedula`).
//
// Legacy (transición, lo usa /censo): con `funcionario` crea/reutiliza un
// usuario temporal por persona (`operador-<centro>-<huella>`); sin él, el
// operador compartido del campamento.

import type { FuncionarioCenso } from "./reposCenso";
import { getUsuario, initAuth, sincronizarSesion } from "./authSupabase";
import { invocarEdgeFunction } from "./edgeFunctions";
import { supabase } from "./supabaseClient";
import { mismaHuellaFuncionario } from "@/lib/terrenoFuncionario";

function emailOperadorCompartido(centroId: string): string {
  return `operador-${centroId}@refugio.app`;
}

/** ¿La sesión pertenece a un operador de terreno (compartido o por persona)? */
function esEmailOperadorTerreno(email: string): boolean {
  return /^operador-centro-.+@refugio\.app$/.test(email);
}

/** ¿Es operador (compartido o personal) de este campamento concreto? */
function esOperadorDeCentro(email: string, centroId: string): boolean {
  const base = `operador-${centroId}`;
  return (
    email === `${base}@refugio.app` ||
    (email.startsWith(`${base}-`) && email.endsWith("@refugio.app"))
  );
}

function usernameDeEmail(email: string): string {
  const i = email.lastIndexOf("@");
  return i > 0 ? email.slice(0, i) : email;
}

export interface SesionTerrenoResultado {
  username: string;
  centro_id?: string;
}

interface RespuestaLoginTerreno {
  token_hash: string;
  centro_id: string;
  username: string;
  funcionario?: FuncionarioCenso | null;
}

/** Canjea el token del QR por una sesión (reemplaza la sesión actual). */
async function loginTerreno(
  token: string,
  funcionario?: FuncionarioCenso,
): Promise<SesionTerrenoResultado> {
  await initAuth();
  const body: { token: string; funcionario?: FuncionarioCenso } = { token };
  if (funcionario) body.funcionario = funcionario;
  const respuesta = await invocarEdgeFunction<RespuestaLoginTerreno>("login-terreno", body);
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: respuesta.token_hash,
  });
  if (error) throw new Error(error.message);
  await sincronizarSesion();
  return { username: respuesta.username, centro_id: respuesta.centro_id };
}

/**
 * Garantiza una sesión capaz de operar en el campamento del token.
 * Con `funcionario`, exige (o crea) la sesión de esa persona.
 * Sin él: conserva cualquier operador ya identificado del centro, o el
 * compartido legado; respeta sesiones personales (admin/supervisor).
 */
export async function asegurarSesionTerreno(
  token: string,
  centroId: string,
  funcionario?: FuncionarioCenso,
): Promise<SesionTerrenoResultado> {
  await initAuth();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user.email ?? "";
  const meta = session?.user.user_metadata as
    | { terreno?: boolean; funcionario?: FuncionarioCenso; centro_id?: string }
    | undefined;

  if (funcionario) {
    if (
      session &&
      esOperadorDeCentro(email, centroId) &&
      mismaHuellaFuncionario(meta?.funcionario, funcionario)
    ) {
      await sincronizarSesion();
      return {
        username: getUsuario()?.username ?? usernameDeEmail(email),
        centro_id: centroId,
      };
    }
    return loginTerreno(token, funcionario);
  }

  if (session && (esOperadorDeCentro(email, centroId) || !esEmailOperadorTerreno(email))) {
    await sincronizarSesion();
    const username =
      getUsuario()?.username ?? (usernameDeEmail(email) || `operador-${centroId}`);
    return { username, centro_id: centroId };
  }

  if (email === emailOperadorCompartido(centroId)) {
    await sincronizarSesion();
    return { username: `operador-${centroId}`, centro_id: centroId };
  }
  return loginTerreno(token);
}

/** Cierra la sesión Auth de terreno (p. ej. «Otra persona»). */
export async function cerrarSesionTerreno(): Promise<void> {
  await initAuth();
  await supabase.auth.signOut();
  await sincronizarSesion();
}

// ============================================================================
// v3 — identidad por cédula (Fase A, docs/plan-identidad-terreno.md)
// ============================================================================

export type LetraCedulaTerreno = "V" | "E";

/** Contexto del campamento que devuelve la Edge Function (para autocompletar). */
export interface CentroIdentidadTerreno {
  id: string;
  nombre: string;
  /** Cuerpo asignado al campamento (institución automática). */
  cuerpo: string;
  /** Unidad SEBIN de revista del campamento. */
  unidad: string;
}

export type ConsultaIdentidadTerreno =
  | {
      /** La cédula ya tiene usuario `op-…`: confirmar y entrar. */
      tipo: "perfil";
      nombre: string;
      jerarquia: string | null;
      verificado_nexus: boolean;
      ya_en_centro: boolean;
      centro: CentroIdentidadTerreno;
    }
  | {
      /** Nexus (o la caché) conoce la cédula: confirmar identidad y entrar. */
      tipo: "nexus";
      origen: "cache" | "nexus";
      nombre: string;
      centro: CentroIdentidadTerreno;
    }
  | { tipo: "no_encontrada"; centro: CentroIdentidadTerreno }
  | {
      /** Nexus caído y cédula nunca vista: pedir nombre manual (sin verificar). */
      tipo: "no_disponible";
      centro: CentroIdentidadTerreno;
    };

/** Resuelve quién es la cédula (perfil → caché → Nexus) sin crear nada. */
export async function consultarIdentidadTerreno(
  token: string,
  cedula: string,
  letra: LetraCedulaTerreno = "V",
): Promise<ConsultaIdentidadTerreno> {
  return invocarEdgeFunction<ConsultaIdentidadTerreno>("login-terreno", {
    token,
    paso: "consultar",
    cedula,
    letra,
  });
}

export interface IdentidadCedulaTerreno {
  cedula: string;
  letra: LetraCedulaTerreno;
  jerarquia: string;
  /** Solo cuando Nexus no está disponible y la cédula es nueva. */
  nombre_manual?: string;
}

export interface SesionCedulaResultado {
  username: string;
  nombre: string;
  centro_id: string;
  verificado_nexus: boolean;
}

interface RespuestaEntrarCedula {
  token_hash?: string;
  centro_id?: string;
  username?: string;
  nombre?: string;
  verificado_nexus?: boolean;
  /** La Edge Function pide nombre manual (Nexus caído, cédula nueva). */
  tipo?: "requiere_nombre";
}

/** Error señal: hay que pedir el nombre manual y reintentar. */
export class RequiereNombreManualError extends Error {
  constructor() {
    super("Nexus no está disponible: indique el nombre completo para continuar.");
    this.name = "RequiereNombreManualError";
  }
}

/** Find-or-create del usuario `op-<cedula>` + canje del magiclink por sesión. */
export async function entrarPorCedula(
  token: string,
  identidad: IdentidadCedulaTerreno,
): Promise<SesionCedulaResultado> {
  await initAuth();
  const respuesta = await invocarEdgeFunction<RespuestaEntrarCedula>("login-terreno", {
    token,
    paso: "entrar",
    cedula: identidad.cedula,
    letra: identidad.letra,
    jerarquia: identidad.jerarquia,
    ...(identidad.nombre_manual ? { nombre_manual: identidad.nombre_manual } : {}),
  });
  if (respuesta.tipo === "requiere_nombre") throw new RequiereNombreManualError();
  if (!respuesta.token_hash) throw new Error("No se pudo emitir el acceso. Intente de nuevo.");
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: respuesta.token_hash,
  });
  if (error) throw new Error(error.message);
  await sincronizarSesion();
  return {
    username: respuesta.username ?? "",
    nombre: respuesta.nombre ?? "",
    centro_id: respuesta.centro_id ?? "",
    verificado_nexus: respuesta.verificado_nexus === true,
  };
}

function emailOperadorCedula(cedula: string): string {
  return `op-${cedula.replace(/\D/g, "")}@refugio.app`;
}

/**
 * Garantiza la sesión del operador identificado por cédula. Si el dispositivo
 * ya tiene la sesión de ESA persona la reutiliza; si no, vuelve a entrar por
 * la Edge Function (que además suma el campamento a sus asignados).
 */
export async function asegurarSesionTerrenoCedula(
  token: string,
  centroId: string,
  identidad: IdentidadCedulaTerreno,
): Promise<SesionTerrenoResultado> {
  await initAuth();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user.email ?? "";
  if (session && email === emailOperadorCedula(identidad.cedula)) {
    await sincronizarSesion();
    return {
      username: getUsuario()?.username ?? usernameDeEmail(email),
      centro_id: centroId,
    };
  }
  const resultado = await entrarPorCedula(token, identidad);
  return { username: resultado.username, centro_id: resultado.centro_id };
}
