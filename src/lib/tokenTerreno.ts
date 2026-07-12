// Token de acceso de terreno (?t=<token> en /terreno y /censo): identifica y
// autoriza el campamento del QR sin crear usuarios individuales. Las RPC
// públicas del censo lo exigen cuando no hay sesión (ver
// supabase/tokens_terreno.sql). Se recuerda en localStorage para que la
// página guardada en la pantalla de inicio siga funcionando aunque el enlace
// pierda la query.

const STORAGE_KEY = "refugio.token_terreno";

/**
 * Dominio público donde se sirve el portal de terreno. Los QR impresos y los
 * enlaces compartidos SIEMPRE apuntan a producción (nunca al dev server ni a
 * la IP del VPS): un QR pegado en un campamento debe sobrevivir a cualquier
 * cambio de entorno local.
 */
export const URL_PORTAL_TERRENO = "https://m0n1t0r-d3-3v3nt0s.net";

/** Enlace de terreno (personal: reporte + censo) a partir de su token. */
export function enlaceTerreno(token: string): string {
  return `${URL_PORTAL_TERRENO}/terreno?t=${encodeURIComponent(token)}`;
}

/** Enlace público de denuncias de un campamento a partir de su token 'publico'. */
export function enlaceDenuncia(token: string): string {
  return `${URL_PORTAL_TERRENO}/denuncia?t=${encodeURIComponent(token)}`;
}

/**
 * Tareas del menú de /terreno. Sirven como deep-link (`?tarea=`) desde el
 * sidebar de la sesión de operador para volver al portal ya apuntado.
 */
export type TareaTerreno =
  | "reporte"
  | "geo"
  | "autoridades"
  | "capacidad"
  | "censo";

/** Ruta relativa al portal de terreno (misma origen; conserva el token). */
export function urlPortalTerreno(opts?: {
  token?: string;
  tarea?: TareaTerreno;
}): string {
  const token = (opts?.token ?? tokenTerrenoActual()).trim();
  const params = new URLSearchParams();
  if (token) params.set("t", token);
  if (opts?.tarea) params.set("tarea", opts.tarea);
  const q = params.toString();
  return q ? `/terreno?${q}` : "/terreno";
}

/**
 * Navega al portal de terreno con recarga completa: `/terreno` vive en el
 * bootstrap ligero (`censo-entry`), no en el AppShell de React Router.
 */
export function irAlPortalTerreno(opts?: {
  token?: string;
  tarea?: TareaTerreno;
}): void {
  window.location.assign(urlPortalTerreno(opts));
}

/** Lee y valida `?tarea=` del portal (o null si no viene / no es válida). */
export function tareaTerrenoDeUrl(search = window.location.search): TareaTerreno | null {
  const raw = new URLSearchParams(search).get("tarea")?.trim() ?? "";
  if (
    raw === "reporte" ||
    raw === "geo" ||
    raw === "autoridades" ||
    raw === "capacidad" ||
    raw === "censo"
  ) {
    return raw;
  }
  return null;
}

/** Token vigente del dispositivo: el de la URL gana y se recuerda. */
export function tokenTerrenoActual(): string {
  const deUrl = new URLSearchParams(window.location.search).get("t")?.trim() ?? "";
  if (deUrl) {
    try {
      localStorage.setItem(STORAGE_KEY, deUrl);
    } catch {
      // Modo privado: sin persistencia, el token vive solo en la URL.
    }
    return deUrl;
  }
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Borra el token recordado (p. ej. si el servidor lo rechaza como revocado). */
export function olvidarTokenTerreno(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Modo privado: nada que borrar.
  }
}
