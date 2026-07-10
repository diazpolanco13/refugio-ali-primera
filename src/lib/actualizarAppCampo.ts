// Limpia la caché de la PWA (service worker + Cache Storage) y recarga
// la página para forzar la descarga de la versión nueva. Pensado para
// /terreno y otras vistas de campo en desarrollo continuo.

export type PasoActualizacionApp =
  | "service_worker"
  | "caches"
  | "recarga";

export interface ProgresoActualizacionApp {
  /** 0–100 */
  porcentaje: number;
  paso: PasoActualizacionApp;
  etiqueta: string;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Borra service workers y cachés del origen; reporta progreso y recarga
 * sin usar el SW viejo.
 */
export async function actualizarAppCampo(
  onProgreso?: (p: ProgresoActualizacionApp) => void,
): Promise<void> {
  const reportar = (p: ProgresoActualizacionApp) => {
    onProgreso?.(p);
  };

  reportar({
    porcentaje: 8,
    paso: "service_worker",
    etiqueta: "Desactivando versión en caché…",
  });
  await esperar(120);

  if ("serviceWorker" in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations();
    const total = Math.max(registros.length, 1);
    for (let i = 0; i < registros.length; i++) {
      await registros[i].unregister();
      reportar({
        porcentaje: 8 + Math.round(((i + 1) / total) * 32),
        paso: "service_worker",
        etiqueta: `Desactivando versión en caché… (${i + 1}/${registros.length || 1})`,
      });
    }
  }

  reportar({
    porcentaje: 45,
    paso: "caches",
    etiqueta: "Borrando archivos guardados…",
  });
  await esperar(80);

  if ("caches" in window) {
    const nombres = await caches.keys();
    const total = Math.max(nombres.length, 1);
    for (let i = 0; i < nombres.length; i++) {
      await caches.delete(nombres[i]);
      reportar({
        porcentaje: 45 + Math.round(((i + 1) / total) * 40),
        paso: "caches",
        etiqueta: `Borrando archivos guardados… (${i + 1}/${nombres.length || 1})`,
      });
    }
  }

  reportar({
    porcentaje: 92,
    paso: "recarga",
    etiqueta: "Descargando versión nueva…",
  });
  await esperar(280);

  reportar({
    porcentaje: 100,
    paso: "recarga",
    etiqueta: "Listo. Recargando…",
  });
  await esperar(180);

  const url = new URL(window.location.href);
  url.searchParams.set("_act", String(Date.now()));
  window.location.replace(url.toString());
}
