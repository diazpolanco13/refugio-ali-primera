// Login de terreno (Fase 2): canjea el token del QR por una sesión del
// operador compartido del campamento (`operador-<centro_id>`), creado en el
// servidor por la Edge Function `login-terreno` la primera vez. El operador
// no tiene contraseña: el QR es la única credencial, y es revocable.

import { invocarEdgeFunction } from "./edgeFunctions";
import { supabase } from "./supabaseClient";

function emailOperadorTerreno(centroId: string): string {
  return `operador-${centroId}@refugio.app`;
}

/** ¿La sesión pertenece a un operador compartido de terreno (de cualquier campamento)? */
function esEmailOperadorTerreno(email: string): boolean {
  return /^operador-centro-[^@]+@refugio\.app$/.test(email);
}

interface RespuestaLoginTerreno {
  token_hash: string;
  centro_id: string;
  username: string;
}

/** Canjea el token del QR por una sesión (reemplaza la sesión actual). */
async function loginTerreno(token: string): Promise<void> {
  const { token_hash } = await invocarEdgeFunction<RespuestaLoginTerreno>("login-terreno", {
    token,
  });
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
  if (error) throw new Error(error.message);
}

/**
 * Garantiza una sesión capaz de reportar en el campamento del token:
 * - Sin sesión → login de terreno.
 * - Sesión de un operador de terreno de OTRO campamento → re-login (el
 *   dispositivo cambió de centro).
 * - Sesión personal (admin, analista, supervisor…) → se respeta tal cual;
 *   sus propios permisos deciden dentro de la app.
 */
export async function asegurarSesionTerreno(token: string, centroId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user.email ?? "";
  const sesionSirve =
    session != null && (email === emailOperadorTerreno(centroId) || !esEmailOperadorTerreno(email));
  if (sesionSirve) return;
  await loginTerreno(token);
}
