import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { CensoView } from "./features/censo/CensoView";
import { ocultarSplash } from "./lib/splash";

/** Arranque mínimo de la planilla pública /censo (sin login ni mapa). */
export function mount(): void {
  const root = document.getElementById("root");
  if (!root) return;

  document.title = "Registro de refugiados";

  createRoot(root).render(
    <StrictMode>
      <CensoView />
    </StrictMode>,
  );

  // No hay sesión que restaurar: ocultamos el splash en cuanto React monta.
  requestAnimationFrame(() => ocultarSplash());
}
