import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AvisoActualizacionApp } from "./components/AvisoActualizacionApp";
import { BotonBorrarCacheFlotante } from "./components/BotonBorrarCacheFlotante";
import { CensoView } from "./features/censo/CensoView";
import { DenunciaView } from "./features/terreno/DenunciaView";
import { TerrenoView } from "./features/terreno/TerrenoView";
import { ocultarSplash } from "./lib/splash";

/**
 * Arranque mínimo de las vistas públicas de campo (sin login ni mapa):
 * /terreno (portal con Reporte diario + Censo), /censo (planilla) y
 * /denuncia (canal anónimo de los damnificados, QR público).
 */
export function mount(): void {
  const root = document.getElementById("root");
  if (!root) return;

  const ruta = (base: string) =>
    window.location.pathname === base || window.location.pathname.startsWith(`${base}/`);
  const esTerreno = ruta("/terreno");
  const esDenuncia = ruta("/denuncia");

  document.title = esDenuncia
    ? "Denuncias y sugerencias"
    : esTerreno
      ? "Reportes en el terreno"
      : "Registro de damnificados";

  createRoot(root).render(
    <StrictMode>
      <AvisoActualizacionApp />
      <BotonBorrarCacheFlotante />
      {esDenuncia ? <DenunciaView /> : esTerreno ? <TerrenoView /> : <CensoView />}
    </StrictMode>,
  );

  // No hay sesión que restaurar: ocultamos el splash en cuanto React monta.
  requestAnimationFrame(() => ocultarSplash());
}
