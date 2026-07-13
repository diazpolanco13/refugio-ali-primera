/**
 * Cierra el splash HTML cinematográfico cuando la app está lista.
 * No monta UI propia — un solo intro (index.html).
 */

import { useEffect, type ReactNode } from "react";
import { ocultarSplash } from "@/lib/splash";

/** Tiempo mínimo para apreciar la coreografía del logo (ms). */
export const MIN_SPLASH_MS = 2200;

/** Marca de inicio (sobrevive StrictMode remount en dev). */
let splashInicioMs = 0;

function preferirMenosMovimiento(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  /** true cuando sesión/chunk inicial ya resolvieron. */
  listo: boolean;
  children: ReactNode;
}

export function SplashIntro({ listo, children }: Props) {
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

    const restante = Math.max(0, MIN_SPLASH_MS - (Date.now() - splashInicioMs));
    const t = window.setTimeout(() => ocultarSplash(), restante);
    return () => window.clearTimeout(t);
  }, [listo]);

  return <>{children}</>;
}
