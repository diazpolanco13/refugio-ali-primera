import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AvisoActualizacionApp } from "./components/AvisoActualizacionApp";
import { BotonBorrarCacheFlotante } from "./components/BotonBorrarCacheFlotante";
import { CensoView } from "./features/censo/CensoView";
import { DenunciaView } from "./features/terreno/DenunciaView";
import { TerrenoView } from "./features/terreno/TerrenoView";
import { ocultarSplashCuandoListo } from "./lib/splash";

/**
 * Arranque mínimo de las vistas públicas de campo (sin login ni mapa):
 * /terreno (portal con Reporte diario + Registro), /registro (planilla) y
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
      : "Registro y verificación de damnificados";

  createRoot(root).render(
    <StrictMode>
      <AvisoActualizacionApp />
      {/* En /censo el borrar-caché vive en la cabecera; en /terreno, en
          bienvenida y menú. Solo /denuncia conserva el FAB de esquina. */}
      {esDenuncia && <BotonBorrarCacheFlotante />}
      {esDenuncia ? <DenunciaView /> : esTerreno ? <TerrenoView /> : <CensoView />}
    </StrictMode>,
  );

  // Sin sesión que restaurar, pero hay que dejar ver la coreografía del logo
  // (mismo mínimo que SplashIntro en la app completa).
  requestAnimationFrame(() => ocultarSplashCuandoListo());
}
