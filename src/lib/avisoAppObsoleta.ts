// Señales de “app obsoleta”: chunks/PWA en caché que ya no existen en el
// servidor tras un deploy. El banner de emergencia vive en index.html; React
// puede reutilizar la misma señal para mostrar su propio aviso.

export const EVENTO_APP_OBSOLETA = "app:obsoleta";

/** Query param que deja la recuperación al recargar (ver actualizarAppCampo). */
export const PARAM_ACTUALIZACION = "_act";

declare global {
  interface Window {
    __avisoAppObsoleta?: {
      mostrar: () => void;
      recuperar: () => Promise<void> | void;
    };
  }
}

/**
 * ¿El error parece un módulo ES / lazy chunk fallido porque el servidor
 * devolvió HTML (SPA fallback) u otro fallo típico de chunk obsoleto?
 *
 * Importante: NO tratar cualquier fallo de <script> ni la subcadena suelta
 * "mime type" — en localhost Cap/Vite/extensiones disparaban falsos positivos
 * y el banner reaparecía tras “Actualizar ahora”.
 */
export function esErrorModuloObsoleto(error: unknown): boolean {
  const texto =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "";
  const t = texto.toLowerCase();
  if (!t) return false;

  return (
    t.includes("failed to load module script") ||
    t.includes("failed to fetch dynamically imported module") ||
    t.includes("error loading dynamically imported module") ||
    t.includes("importing a module script failed") ||
    // Chrome: MIME type of "text/html" en module scripts
    (t.includes("module script") && t.includes("mime type")) ||
    (t.includes("module") && t.includes('mime type of "text/html"'))
  );
}

/** Quita `?_act=` de la URL tras una recuperación exitosa (sin recargar). */
export function limpiarParamActualizacion(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM_ACTUALIZACION)) return;
    url.searchParams.delete(PARAM_ACTUALIZACION);
    const limpia = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", limpia);
  } catch {
    /* ignore */
  }
}

/** Dispara el aviso global (HTML de emergencia y/o banner React). */
export function señalarAppObsoleta(): void {
  window.__avisoAppObsoleta?.mostrar();
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_APP_OBSOLETA));
  } catch {
    /* CustomEvent no disponible */
  }
}

/** Suscripción a la señal de app obsoleta (solo fallos de módulo reales). */
export function suscribirAppObsoleta(onAviso: () => void): () => void {
  const handler = () => onAviso();
  window.addEventListener(EVENTO_APP_OBSOLETA, handler);

  const onError = (ev: ErrorEvent) => {
    if (esErrorModuloObsoleto(ev.message)) onAviso();
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    if (esErrorModuloObsoleto(ev.reason)) onAviso();
  };

  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener(EVENTO_APP_OBSOLETA, handler);
    window.removeEventListener("error", onError, true);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
