// Login de terreno: canjea el token del QR por una sesión de operador.
// Con `funcionario` crea/reutiliza un usuario temporal por persona
// (`operador-<centro>-<huella>`); sin él, el operador compartido del campamento.

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
