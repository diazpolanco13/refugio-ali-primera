/**
 * Capa fija del login con salida cinematográfica (mismo gesto que el splash:
 * opacity + scale + blur). El mapa monta DEBAJO mientras esta capa se disuelve
 * → no hay corte seco login → shell.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Login } from "@/features/auth/Login";
import type { Sesion } from "@/data/authSupabase";

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

  useEffect(() => {
    if (!listo || !sesion || !puente.current || saliendo) return;

    setSaliendo(true);
    const ms = reduced ? 0 : SALIDA_MS;
    const t = window.setTimeout(() => {
      puente.current = false;
      setSaliendo(false);
      forzar((n) => n + 1);
    }, ms);
    return () => window.clearTimeout(t);
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
