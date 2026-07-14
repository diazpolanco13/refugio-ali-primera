// Control del splash de arranque definido en index.html (overlay pre-React).
// La intro cinematográfica vive SOLO en el HTML (CSS). React llama a
// `ocultarSplash()` cuando la app está lista — no monta un segundo splash.

import {
  ADELANTO_FLY_ANTES_FADE_MS,
  avisarInicioSalidaOverlay,
} from "@/lib/introMapa";

declare global {
  interface Window {
    __appSplash?: { detener: () => void };
    __splashInicioMs?: number;
  }
}

const SALIDA_MS = 900;

export function ocultarSplash(opciones?: { inmediato?: boolean }): void {
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  window.__appSplash?.detener();

  try {
    localStorage.setItem("app-instalada", "1");
  } catch {
    /* sin persistencia disponible */
  }

  if (opciones?.inmediato) {
    avisarInicioSalidaOverlay();
    splash.remove();
    return;
  }

  // Completa barra (cine o campo) antes del fade.
  const barraCampo = document.getElementById("app-splash-barra");
  if (barraCampo) barraCampo.style.width = "100%";
  const barraCine = splash.querySelector<HTMLElement>(".splash-cine .barra > div");
  if (barraCine) {
    barraCine.style.animation = "none";
    barraCine.style.width = "100%";
  }

  // 1) Fly YA (mapa debajo, aún tapado por splash opaco).
  avisarInicioSalidaOverlay();
  // 2) Un instante después: fade — al transparentarse, el zoom ya corre.
  window.setTimeout(() => {
    const el = document.getElementById("app-splash");
    if (!el) return;
    el.classList.add("saliendo");
    window.setTimeout(() => {
      el.classList.add("oculto");
      el.remove();
    }, SALIDA_MS);
  }, ADELANTO_FLY_ANTES_FADE_MS);
}
