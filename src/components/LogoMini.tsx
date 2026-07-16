/**
 * LogoMini — marca animada ambiental para la esquina del mapa.
 *
 * En el splash el logo es el show; aquí es una firma que respira.
 * Animaciones lentas (14–18s), opacidades bajas, sin bloquear el mapa.
 */

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const GREEN = "#10B981";
const CORE = "#0D9488";
const INK = "#ECFDF5";

type Variant = "minimo" | "sonar" | "radar";
type Position = "bottom-left" | "bottom-right" | "top-left" | "top-right";

const POS: Record<Position, CSSProperties> = {
  "bottom-left": { bottom: 14, left: 14 },
  "bottom-right": { bottom: 14, right: 14 },
  "top-left": { top: 14, left: 14 },
  "top-right": { top: 14, right: 14 },
};

interface Props {
  variant?: Variant;
  position?: Position;
  /** Diámetro del marco en px (default 40). */
  size?: number;
  /** Texto CAMPAMENTOS / TRANSITORIOS al lado. */
  showWordmark?: boolean;
  /** Opcional: p.ej. resetear la vista del mapa. */
  onClick?: () => void;
  className?: string;
}

export function LogoMini({
  variant = "minimo",
  position = "bottom-left",
  size = 40,
  showWordmark = true,
  onClick,
  className,
}: Props) {
  const reduced = useReducedMotion();

  return (
    <div
      className={cn("absolute z-[5] flex items-center gap-2 select-none", className)}
      style={{
        ...POS[position],
        pointerEvents: onClick ? "auto" : "none",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? "Restablecer vista del mapa" : undefined}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {variant === "sonar" && !reduced && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${GREEN}80` }}
            animate={{ scale: [0.7, 1.6], opacity: [0.6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid ${GREEN}59` }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{
            duration: variant === "minimo" ? 18 : 14,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <motion.div
            className="absolute rounded-full"
            style={{
              top: -2.5,
              left: "50%",
              marginLeft: -2.5,
              width: 5,
              height: 5,
              background: GREEN,
              boxShadow: `0 0 6px ${GREEN}`,
            }}
            animate={reduced ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {variant === "radar" && !reduced && (
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: 2,
              background: `conic-gradient(from 0deg, transparent 0deg, ${GREEN}38 40deg, transparent 75deg)`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
        )}

        <div
          className="absolute flex items-center justify-center"
          style={{
            inset: size * 0.2,
            borderRadius: size * 0.22,
            background: CORE,
            boxShadow: `0 0 10px ${GREEN}33`,
          }}
        >
          <svg
            width={size * 0.4}
            height={size * 0.4}
            viewBox="0 0 24 24"
            fill="none"
            stroke={INK}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3.5 20 L12 4 L20.5 20 Z" />
            <path d="M9 20 L12 13 L15 20" />
          </svg>
        </div>
      </div>

      {showWordmark && (
        <div
          className="font-mono leading-[1.4]"
          style={{
            fontSize: 10,
            letterSpacing: "0.15em",
            color: `${INK}8C`,
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          <span
            className="block font-medium"
            style={{ color: GREEN, letterSpacing: "0.2em" }}
          >
            CAMPAMENTOS
          </span>
          TRANSITORIOS
        </div>
      )}
    </div>
  );
}
