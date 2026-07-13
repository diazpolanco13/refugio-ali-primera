/**
 * LoginBackground + LoginHero — pantalla de acceso Campamentos Transitorios.
 *
 * Mismo lenguaje visual del splash y LogoMini, dosificado para una
 * pantalla donde el usuario se detiene a escribir.
 */

import { motion, useReducedMotion } from "framer-motion";

const GREEN = "#10B981";
const TEAL = "#2DD4BF";
const CORE = "#0D9488";
const INK = "#ECFDF5";
const SUB = "#6B8F80";

/** Atmósfera detrás del formulario (pointer-events: none). */
export function LoginBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 30%, rgba(13,148,136,0.16) 0%, transparent 65%)",
        }}
      />

      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 25% at 50% 24%, rgba(16,185,129,0.12) 0%, transparent 70%)",
        }}
        animate={reduced ? undefined : { opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0"
        style={{
          opacity: 0.05,
          backgroundImage: `linear-gradient(${GREEN}CC 1px, transparent 1px), linear-gradient(90deg, ${GREEN}CC 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          animation: reduced ? undefined : "gridFloat 30s linear infinite",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 35%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 35%, black 30%, transparent 80%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${GREEN}05 2px, ${GREEN}05 4px)`,
          animation: reduced
            ? undefined
            : "splashScanDrift 10s linear infinite",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background: "linear-gradient(to top, rgba(4,16,12,0.8), transparent)",
        }}
      />
    </div>
  );
}

/** Marca animada + título (reemplaza el bloque estático del login). */
export function LoginHero({
  title = "Campamentos Transitorios",
  subtitle = "Área Metropolitana de Caracas",
}: {
  title?: string;
  subtitle?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="relative z-10 mb-8 flex flex-col items-center">
      <div className="relative mb-4" style={{ width: 84, height: 84 }}>
        {!reduced && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${GREEN}73` }}
            animate={{ scale: [0.75, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid ${GREEN}4D` }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        >
          <motion.div
            className="absolute rounded-full"
            style={{
              top: -3,
              left: "50%",
              marginLeft: -3,
              width: 6,
              height: 6,
              background: GREEN,
              boxShadow: `0 0 8px ${GREEN}`,
            }}
            animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.div
          className="absolute rounded-full"
          style={{ inset: 9, border: `1px dashed ${TEAL}33` }}
          animate={reduced ? undefined : { rotate: -360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        />

        <motion.div
          className="absolute flex items-center justify-center"
          style={{
            inset: 20,
            borderRadius: 14,
            background: CORE,
            boxShadow: `0 0 30px ${GREEN}4D`,
          }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={INK}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <motion.path
              d="M3.5 20 L12 4 L20.5 20 Z"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            />
            <motion.path
              d="M9 20 L12 13 L15 20"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.p
        className="m-0 text-lg font-medium"
        style={{ color: INK }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
      >
        {title}
      </motion.p>
      <motion.p
        className="m-0 mt-0.5 text-sm"
        style={{ color: SUB }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.6, ease: "easeOut" }}
      >
        {subtitle}
      </motion.p>

      <motion.div
        className="mt-3 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
          opacity: 0.5,
        }}
        initial={{ width: 0 }}
        animate={{ width: 140 }}
        transition={{ delay: 0.7, duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}
