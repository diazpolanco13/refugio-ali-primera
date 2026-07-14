/**
 * Cierra el splash HTML cinematográfico cuando la app está lista.
 * No monta UI propia — un solo intro (index.html).
 *
 * Con sesión en el mapa: NO cierra al terminar la barra — espera a que el
 * mapa esté en órbita y entonces disuelve encima del fly-in en curso.
 */

import { useEffect, type ReactNode } from "react";
import {
  TIMEOUT_ESPERA_ORBITA_MS,
  onMapaOrbitaLista,
  preferirMenosMovimiento,
} from "@/lib/introMapa";
import { ocultarSplash } from "@/lib/splash";

/** Tiempo mínimo para apreciar la coreografía del logo (ms). */
export const MIN_SPLASH_MS = 2200;

/** Marca de inicio (sobrevive StrictMode remount en dev). */
let splashInicioMs = 0;

interface Props {
  /** true cuando sesión/chunk inicial ya resolvieron. */
  listo: boolean;
  /**
   * true si hay sesión y la ruta es el mapa: el splash se queda hasta que
   * CentrosMap avise órbita, para revelar el zoom en movimiento.
   */
  esperarOrbitaMapa?: boolean;
  children: ReactNode;
}

export function SplashIntro({ listo, esperarOrbitaMapa = false, children }: Props) {
  useEffect(() => {
    if (!splashInicioMs) {
      splashInicioMs = window.__splashInicioMs || Date.now();
    }
  }, []);

  useEffect(() => {
    if (!listo) return;

    if (preferirMenosMovimiento()) {
      ocultarSplash({ inmediato: true });
      return;
    }

    let cerrado = false;
    let unsubOrbita = () => {};
    let timeoutOrbita = 0;

    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      unsubOrbita();
      window.clearTimeout(timeoutOrbita);
      ocultarSplash();
    };

    const trasMinimoCoreografia = () => {
      if (cerrado) return;
      if (!esperarOrbitaMapa) {
        // Login u otra ruta: cerrar ya (el fly lo alinea CapaLogin al autenticar).
        cerrar();
        return;
      }
      // Sesión + mapa: barra puede estar al 100%, pero el splash ESPERA órbita.
      unsubOrbita = onMapaOrbitaLista(cerrar);
      timeoutOrbita = window.setTimeout(cerrar, TIMEOUT_ESPERA_ORBITA_MS);
    };

    const restante = Math.max(0, MIN_SPLASH_MS - (Date.now() - splashInicioMs));
    const timeoutMin = window.setTimeout(trasMinimoCoreografia, restante);

    return () => {
      cerrado = true;
      window.clearTimeout(timeoutMin);
      window.clearTimeout(timeoutOrbita);
      unsubOrbita();
    };
  }, [listo, esperarOrbitaMapa]);

  return <>{children}</>;
}
