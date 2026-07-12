/** Mensaje orientado a censistas en campo cuando falla el fetch (Safari/Chrome). */
export const MENSAJE_SIN_CONEXION =
  "No hay conexión estable con el servidor. Busque una mejor señal de internet y reintente.";

/**
 * Detecta fallos de red del navegador (Safari: "Load failed",
 * Chrome: "Failed to fetch", etc.), también cuando ya vienen envueltos
 * en un Error de repositorio (`[repos…] …: TypeError: Load failed`).
 */
export function esFalloDeRed(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  const msg = (
    err instanceof Error ? err.message : err != null ? String(err) : ""
  ).toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("internet connection appears to be offline") ||
    msg.includes("err_internet_disconnected") ||
    msg.includes("err_network")
  );
}

/** Mensaje para mostrar en UI: si es red, guía al usuario; si no, el error o el fallback. */
export function mensajeErrorParaUsuario(err: unknown, fallback: string): string {
  if (esFalloDeRed(err)) return MENSAJE_SIN_CONEXION;
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
