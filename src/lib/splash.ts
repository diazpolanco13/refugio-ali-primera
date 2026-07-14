// Control del splash de arranque definido en index.html (overlay pre-React).
// La intro cinematográfica vive SOLO en el HTML (CSS). React llama a
// `ocultarSplash()` cuando la app está lista — no monta un segundo splash.

import {
  ADELANTO_FLY_ANTES_FADE_MS,
  avisarInicioSalidaOverlay,
  preferirMenosMovimiento,
} from "@/lib/introMapa";

declare global {
  interface Window {
    __appSplash?: { detener: () => void };
    __splashInicioMs?: number;
  }
}

const SALIDA_MS = 900;

/** Tiempo mínimo para apreciar la coreografía del logo (ms). */
export const MIN_SPLASH_MS = 2200;

/**
 * Oculta el splash respetando el mínimo de coreografía (rutas de campo sin
 * SplashIntro: /terreno, /censo, /denuncia).
 */
export function ocultarSplashCuandoListo(opciones?: {
  inmediato?: boolean;
  dispararIntroMapa?: boolean;
}): void {
  if (opciones?.inmediato || preferirMenosMovimiento()) {
    ocultarSplash({ ...opciones, inmediato: true });
    return;
  }
  const inicio = window.__splashInicioMs || Date.now();
  const restante = Math.max(0, MIN_SPLASH_MS - (Date.now() - inicio));
  window.setTimeout(() => ocultarSplash(opciones), restante);
}

export function ocultarSplash(opciones?: {
  inmediato?: boolean;
  /**
   * true solo si hay mapa debajo listo para el fly-in (sesión + ruta mapa).
   * En pantalla de login debe ser false: si no, envenena la señal y el login
   * no puede sincronizar el acercamiento.
   */
  dispararIntroMapa?: boolean;
}): void {
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  window.__appSplash?.detener();

  try {
    localStorage.setItem("app-instalada", "1");
  } catch {
    /* sin persistencia disponible */
  }

  const dispararIntro = opciones?.dispararIntroMapa === true;

  if (opciones?.inmediato) {
    if (dispararIntro) avisarInicioSalidaOverlay();
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

  const empezarFade = () => {
    const el = document.getElementById("app-splash");
    if (!el) return;
    el.classList.add("saliendo");
    window.setTimeout(() => {
      el.classList.add("oculto");
      el.remove();
    }, SALIDA_MS);
  };

  if (dispararIntro) {
    // Fly YA (mapa debajo); fade un instante después → revelar en movimiento.
    avisarInicioSalidaOverlay();
    window.setTimeout(empezarFade, ADELANTO_FLY_ANTES_FADE_MS);
  } else {
    // Login u otra ruta sin mapa: solo disolver, sin tocar señales del intro.
    empezarFade();
  }
}
