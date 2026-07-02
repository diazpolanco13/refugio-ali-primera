import { useEffect, useState } from "react";
import type { Usuario } from "@/data/auth";

/** Escapa los caracteres reservados de XML para inyectar texto en el SVG. */
function escaparXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Marca de agua de seguridad (disuasión anti-foto). Superpone en diagonal la
 * identidad del usuario logueado + hash de sistema + fecha/hora en vivo, de
 * modo que cualquier captura o fotografía de pantalla quede "firmada" con quién
 * y cuándo la tomó.
 *
 * No interfiere con el funcionamiento: es puramente visual
 * (`pointer-events: none`) y deja pasar todos los clics/gestos al mapa y a la UI.
 */
export function MarcaAgua({ usuario }: { usuario: Usuario }) {
  // Fecha/hora que se refresca cada minuto (traza el momento de la captura).
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nombre = usuario.nombre || usuario.username;
  const hash = usuario.hash_id ?? "";
  const marca = ahora.toLocaleString("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const linea1 = escaparXml(`${nombre}${hash ? ` · ${hash}` : ""}`);
  const linea2 = escaparXml(marca);

  // Baldosa SVG con el texto rotado; se repite por todo el viewport.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='170'>
    <g transform='rotate(-28 150 85)' fill='rgb(148,163,184)' font-family='ui-sans-serif,system-ui,sans-serif' font-weight='600'>
      <text x='150' y='80' text-anchor='middle' font-size='13'>${linea1}</text>
      <text x='150' y='100' text-anchor='middle' font-size='11' opacity='0.85'>${linea2}</text>
    </g>
  </svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2147483647] select-none opacity-[0.13] mix-blend-difference"
      style={{
        backgroundImage: `url("${url}")`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}
