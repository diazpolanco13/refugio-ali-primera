// Punto de entrada único: elige el bootstrap según la ruta ANTES de descargar
// el bundle pesado de la app completa (mapa, login, dashboard…). /censo carga
// solo la planilla de campo (~decenas de KB) en lugar del núcleo de ~190 KB gzip.

const esPlanillaCenso =
  window.location.pathname === "/censo" || window.location.pathname.startsWith("/censo/");

if (esPlanillaCenso) {
  const msg = document.getElementById("app-splash-msg");
  if (msg) msg.textContent = "Cargando planilla…";
  void import("./censo-entry").then((m) => m.mount());
} else {
  void import("./app-entry").then((m) => m.mount());
}
