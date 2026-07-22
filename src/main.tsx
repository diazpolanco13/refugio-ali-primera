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

// PWA instalada (start_url "/"): un dispositivo de campo —tiene token de
// terreno recordado y ninguna sesión de operador— aterriza directo en el
// portal de terreno. Un operador con sesión Supabase entra por la app normal.
// Se decide aquí, antes de descargar cualquier bundle, para no pagar el
// núcleo completo solo para redirigir.
function debeIrATerreno(): boolean {
  if (window.location.pathname !== "/") return false;
  try {
    const tieneTokenTerreno = !!localStorage
      .getItem("refugio.token_terreno")
      ?.trim();
    if (!tieneTokenTerreno) return false;
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i) ?? "";
      if (clave.startsWith("sb-") && clave.endsWith("-auth-token")) {
        return false; // Sesión de operador: app normal.
      }
    }
    return true;
  } catch {
    // Modo privado: sin persistencia, arranque normal.
    return false;
  }
}

if (debeIrATerreno()) {
  window.location.replace("/terreno");
} else if (rutaEs("/censo")) {
  // Legacy: planilla pública renombrada a /registro.
  window.location.replace(
    `${window.location.pathname.replace(/^\/censo/, "/registro")}${window.location.search}${window.location.hash}`,
  );
} else if (rutaEs("/registro") || rutaEs("/terreno") || rutaEs("/denuncia")) {
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
