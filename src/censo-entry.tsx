import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { CensoView } from "./features/censo/CensoView";
import { TerrenoView } from "./features/terreno/TerrenoView";
import { ocultarSplash } from "./lib/splash";

/**
 * Arranque mínimo de las vistas públicas de campo (sin login ni mapa):
 * /terreno (portal con Reporte diario + Censo) y /censo (planilla).
 */
export function mount(): void {
  const root = document.getElementById("root");
  if (!root) return;

  const esTerreno =
    window.location.pathname === "/terreno" || window.location.pathname.startsWith("/terreno/");

  document.title = esTerreno ? "Reportes en el terreno" : "Registro de damnificados";

  createRoot(root).render(<StrictMode>{esTerreno ? <TerrenoView /> : <CensoView />}</StrictMode>);

  // No hay sesión que restaurar: ocultamos el splash en cuanto React monta.
  requestAnimationFrame(() => ocultarSplash());
}
