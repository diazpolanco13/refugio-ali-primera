// Punto de entrada único: elige el bootstrap según la ruta ANTES de descargar
// el bundle pesado de la app completa (mapa, login, dashboard…). /censo y
// /terreno cargan solo las vistas de campo (~decenas de KB) en lugar del
// núcleo de ~190 KB gzip.

function rutaEs(base: string): boolean {
  return window.location.pathname === base || window.location.pathname.startsWith(`${base}/`);
}

if (rutaEs("/censo") || rutaEs("/terreno")) {
  const msg = document.getElementById("app-splash-msg");
  if (msg) msg.textContent = rutaEs("/censo") ? "Cargando planilla…" : "Cargando…";
  void import("./censo-entry").then((m) => m.mount());
} else {
  void import("./app-entry").then((m) => m.mount());
}
