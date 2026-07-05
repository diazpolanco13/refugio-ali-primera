// Control del splash de arranque definido en index.html (overlay pre-React).
// El HTML lo pinta al instante (antes de descargar el bundle) con una barra de
// progreso pseudo-real; React llama a `ocultarSplash()` cuando la app está
// realmente lista (sesión restaurada + chunk de la ruta precargado).

declare global {
  interface Window {
    __appSplash?: { detener: () => void };
  }
}

export function ocultarSplash(): void {
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  window.__appSplash?.detener();

  // Completa la barra al 100% antes de desvanecer, para cerrar la narrativa
  // visual de "descarga terminada" en vez de cortar a mitad de camino.
  const barra = document.getElementById("app-splash-barra");
  if (barra) barra.style.width = "100%";

  // Recuerda que la app ya se instaló: las próximas cargas no muestran el
  // mensaje de "primera vez" (modo privado sin localStorage → se ignora).
  try {
    localStorage.setItem("app-instalada", "1");
  } catch {
    /* sin persistencia disponible */
  }

  window.setTimeout(() => {
    splash.classList.add("oculto");
    // Retira el nodo tras el fade (0.4s en CSS) para no dejar un overlay
    // invisible interceptable por lectores de pantalla.
    window.setTimeout(() => splash.remove(), 450);
  }, 200);
}
