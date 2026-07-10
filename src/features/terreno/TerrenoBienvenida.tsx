// Pantalla de bienvenida del portal /terreno: tono corporativo e instructivo
// para funcionarios, antes de la identificación personal.

import { useState } from "react";
import { ArrowRight, ClipboardList, Loader2, MapPin, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { actualizarAppCampo } from "@/lib/actualizarAppCampo";
import { cn } from "@/lib/utils";

interface Props {
  nombreCentro: string;
  onContinuar: () => void;
}

/** Bienvenida breve al portal de trabajo en el campamento. */
export function TerrenoBienvenida({ nombreCentro, onContinuar }: Props) {
  const [actualizandoApp, setActualizandoApp] = useState(false);
  const [errorActualizar, setErrorActualizar] = useState<string | null>(null);

  async function forzarActualizacionApp() {
    if (actualizandoApp) return;
    setErrorActualizar(null);
    setActualizandoApp(true);
    try {
      await actualizarAppCampo();
    } catch {
      setActualizandoApp(false);
      setErrorActualizar(
        "No se pudo limpiar la caché. Cierre la app y ábrala de nuevo desde el enlace.",
      );
    }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 space-y-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4 text-primary" />
          Portal de terreno
        </CardTitle>
        <CardDescription>
          Acceso operativo para el personal asignado al campamento.
        </CardDescription>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Campamento / refugio
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{nombreCentro}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <div className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium leading-snug">Instrucciones</p>
            <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
              <li>
                Identifíquese con sus datos. Cada funcionario genera un acceso
                temporal propio.
              </li>
              <li>
                Use las tareas del menú (reporte, ubicación, autoridades,
                capacidad) según lo indique la coordinación.
              </li>
              <li>
                Registre información veraz. Quedará asociada a su identificación.
              </li>
            </ul>
          </div>
        </div>

        <section
          aria-label="Actualizar aplicación"
          className="w-full space-y-2 rounded-xl border border-border bg-card/60 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">Actualizar aplicación</p>
            <p className="text-xs leading-snug text-muted-foreground">
              Si no ve los cambios recientes, borre la caché de esta página y descargue la
              versión nueva.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void forzarActualizacionApp()}
            disabled={actualizandoApp}
            className={cn(
              "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors",
              "hover:bg-accent disabled:opacity-60",
            )}
          >
            {actualizandoApp ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Actualizando…
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Borrar caché y actualizar
              </>
            )}
          </button>
          {errorActualizar && (
            <p className="text-xs text-destructive" role="alert">
              {errorActualizar}
            </p>
          )}
        </section>
      </CardContent>

      <CardFooter className="shrink-0 border-t border-border pt-4">
        <Button type="button" className="h-11 w-full" onClick={onContinuar}>
          Continuar a identificación
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
