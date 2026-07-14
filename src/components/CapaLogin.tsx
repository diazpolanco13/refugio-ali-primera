/**
 * Capa fija del login con salida cinematográfica (mismo gesto que el splash:
 * opacity + scale + blur). El mapa monta DEBAJO mientras esta capa se disuelve
 * → no hay corte seco login → shell.
 *
 * Tras autenticar espera a que el mapa esté en órbita (intro Google Earth) y
 * entonces disuelve en paralelo al fly-in.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Login } from "@/features/auth/Login";
import type { Sesion } from "@/data/authSupabase";
import {
  ADELANTO_FLY_ANTES_FADE_MS,
  TIMEOUT_ESPERA_ORBITA_MS,
  avisarInicioSalidaOverlay,
  invalidarSalidaOverlay,
  onMapaOrbitaLista,
} from "@/lib/introMapa";

const VOID = "#05100C";
const SALIDA_MS = 900;
const EXIT = { opacity: 0, scale: 1.06, filter: "blur(6px)" };
const IDLE = { opacity: 1, scale: 1, filter: "blur(0px)" };
const EASE = [0.4, 0, 0.2, 1] as const;

interface Props {
  /** false mientras el splash de arranque aún bloquea el árbol. */
  listo: boolean;
  sesion: Sesion | null;
}

export function CapaLogin({ listo, sesion }: Props) {
  const reduced = useReducedMotion();
  /** Mantener capa montada tras emitir sesión hasta terminar el fade. */
  const puente = useRef(false);
  const [saliendo, setSaliendo] = useState(false);
  const [, forzar] = useState(0);

  if (listo && !sesion) {
    puente.current = true;
  }

  const visible = listo && (!sesion || puente.current);

  // El splash pudo avisar salida al cerrar sobre el login (sin mapa). Invalidar
  // para que el fly-in espere al fade real de esta capa.
  useEffect(() => {
    if (listo && !sesion) {
      invalidarSalidaOverlay();
    }
  }, [listo, sesion]);

  useEffect(() => {
    if (!listo || !sesion || !puente.current || saliendo) return;

    let timeoutAdelanto = 0;
    let timeoutSalida = 0;
    let timeoutOrbita = 0;
    let cancelado = false;
    let iniciada = false;

    const empezarSalida = () => {
      if (cancelado || iniciada || !puente.current) return;
      iniciada = true;
      window.clearTimeout(timeoutOrbita);
      // Fly primero (mapa tapado); fade un instante después → revelar en movimiento.
      avisarInicioSalidaOverlay();
      const arrancarFade = () => {
        if (cancelado) return;
        setSaliendo(true);
        const ms = reduced ? 0 : SALIDA_MS;
        timeoutSalida = window.setTimeout(() => {
          puente.current = false;
          setSaliendo(false);
          forzar((n) => n + 1);
        }, ms);
      };
      if (reduced) {
        arrancarFade();
      } else {
        timeoutAdelanto = window.setTimeout(arrancarFade, ADELANTO_FLY_ANTES_FADE_MS);
      }
    };

    // Esperar órbita del mapa para alinear fade + fly-in. Si la ruta no monta
    // mapa (p. ej. rol que cae en otra vista), timeout y salir igual.
    const unsubOrbita = onMapaOrbitaLista(empezarSalida);
    timeoutOrbita = window.setTimeout(empezarSalida, TIMEOUT_ESPERA_ORBITA_MS);

    return () => {
      cancelado = true;
      unsubOrbita();
      window.clearTimeout(timeoutOrbita);
      window.clearTimeout(timeoutAdelanto);
      window.clearTimeout(timeoutSalida);
    };
  }, [listo, sesion, saliendo, reduced]);

  if (!visible) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9998] overflow-y-auto"
      style={{
        background: VOID,
        willChange: "opacity, transform, filter",
        pointerEvents: saliendo ? "none" : undefined,
      }}
      initial={false}
      animate={saliendo && !reduced ? EXIT : IDLE}
      transition={
        reduced ? { duration: 0 } : { duration: SALIDA_MS / 1000, ease: EASE }
      }
      aria-hidden={saliendo || undefined}
    >
      <Login />
    </motion.div>
  );
}
