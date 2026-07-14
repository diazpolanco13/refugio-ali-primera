// Punto de entrada único: elige el bootstrap según la ruta ANTES de descargar
// el bundle pesado de la app completa (mapa, login, dashboard…). /censo y
// /terreno cargan solo las vistas de campo (~decenas de KB) en lugar del
// núcleo de ~190 KB gzip.

import { aplicarTemaTerreno, temaTerrenoGuardado } from "./lib/temaTerreno";

// Tema claro/oscuro guardado (toggle en /terreno). Se aplica aquí, antes de
// descargar cualquier bundle, para que TODAS las vistas (reporte, censo,
// denuncia, app completa) respeten la elección del dispositivo sin parpadeo.
aplicarTemaTerreno(temaTerrenoGuardado());

function rutaEs(base: string): boolean {
  return window.location.pathname === base || window.location.pathname.startsWith(`${base}/`);
}

if (rutaEs("/censo") || rutaEs("/terreno") || rutaEs("/denuncia")) {
  // Mismo splash cinematográfico que el resto de la app (logo + CAMPAMENTOS).
  // Antes se forzaba `modo-campo` (solo barra verde) y /terreno se veía vacío.
  void import("./censo-entry").then((m) => m.mount());
} else {
  // Arranca el chunk del mapa en paralelo al bootstrap (Vite/dev lo transforma
  // mientras montamos React + auth). No espera el resultado aquí.
  const path = window.location.pathname;
  if (
    path === "/" ||
    path === "/centros" ||
    path.startsWith("/centros/")
  ) {
    void import("./features/centros/CentrosView");
  }
  void import("./app-entry").then((m) => m.mount());
}
