import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  actualizarAppCampo,
  type ProgresoActualizacionApp,
} from "@/lib/actualizarAppCampo";
import {
  limpiarParamActualizacion,
  suscribirAppObsoleta,
} from "@/lib/avisoAppObsoleta";

/**
 * Banner fijo (estilo aviso de cookies) cuando la PWA/caché apunta a chunks
 * viejos tras un deploy. El botón no simula Ctrl+Shift+R: limpia service
 * worker + Cache Storage y recarga (misma recuperación que en /terreno).
 */
export function AvisoActualizacionApp() {
  const [visible, setVisible] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoActualizacionApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Tras “Actualizar ahora” la URL trae ?_act=…: la recuperación ya corrió.
    const veniaDeActualizar = new URLSearchParams(window.location.search).has(
      "_act",
    );
    limpiarParamActualizacion();

    const html = document.getElementById("aviso-app-obsoleta");
    const tomarControl = () => {
      if (html) {
        html.hidden = true;
        html.classList.remove("visible");
      }
      setVisible(true);
    };

    if (veniaDeActualizar) {
      // No reabrir el banner solo por estado residual del HTML.
      if (html) {
        html.hidden = true;
        html.classList.remove("visible");
      }
    } else if (html?.classList.contains("visible")) {
      tomarControl();
    }

    return suscribirAppObsoleta(tomarControl);
  }, []);

  async function actualizar() {
    if (actualizando) return;
    setActualizando(true);
    setError(null);
    setProgreso({
      porcentaje: 0,
      paso: "service_worker",
      etiqueta: "Preparando…",
    });
    try {
      await actualizarAppCampo(setProgreso);
    } catch {
      setActualizando(false);
      setProgreso(null);
      setError(
        "No se pudo actualizar. Cierre esta pestaña, ábrala de nuevo o borre los datos del sitio en el navegador.",
      );
    }
  }

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[10000] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="presentation"
    >
      <Alert
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aviso-act-titulo"
        aria-describedby="aviso-act-desc"
        className="pointer-events-auto mx-auto max-w-md border-border bg-card shadow-lg"
      >
        <RefreshCw className="text-primary" aria-hidden="true" />
        <AlertTitle id="aviso-act-titulo">Hay que actualizar la aplicación</AlertTitle>
        <AlertDescription id="aviso-act-desc" className="space-y-3">
          <p>
            Este dispositivo tiene una versión antigua guardada y la pantalla no
            puede cargar. No pierde su sesión: pulse el botón, espere unos
            segundos y entrará de nuevo.
          </p>
          {error ? <p className="text-destructive">{error}</p> : null}
          {actualizando && progreso ? (
            <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">{progreso.etiqueta}</span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {progreso.porcentaje}%
                </span>
              </div>
              <Progress
                value={progreso.porcentaje}
                className="h-2"
                aria-label={`Progreso de actualización: ${progreso.porcentaje}%`}
              />
            </div>
          ) : (
            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={() => void actualizar()}
              disabled={actualizando}
            >
              <RefreshCw data-icon="inline-start" />
              Actualizar ahora
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
