// Control del splash de arranque definido en index.html (overlay pre-React).
// La intro cinematográfica vive SOLO en el HTML (CSS). React llama a
// `ocultarSplash()` cuando la app está lista — no monta un segundo splash.

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
  // Salida cinematográfica (scale + blur) sobre el MISMO nodo HTML.
  splash.classList.add("saliendo");
  window.setTimeout(() => {
    splash.classList.add("oculto");
    splash.remove();
  }, SALIDA_MS);
}
