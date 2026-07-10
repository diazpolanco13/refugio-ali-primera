// Limpia la caché de la PWA (service worker + Cache Storage) y recarga
// la página para forzar la descarga de la versión nueva. Pensado para
// /terreno y otras vistas de campo en desarrollo continuo.

/** Borra service workers y cachés del origen; luego recarga sin usar el SW viejo. */
export async function actualizarAppCampo(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.map((r) => r.unregister()));
  }

  if ("caches" in window) {
    const nombres = await caches.keys();
    await Promise.all(nombres.map((n) => caches.delete(n)));
  }

  // Cache-bust en la URL para que el navegador no reutilice el HTML viejo.
  const url = new URL(window.location.href);
  url.searchParams.set("_act", String(Date.now()));
  window.location.replace(url.toString());
}
