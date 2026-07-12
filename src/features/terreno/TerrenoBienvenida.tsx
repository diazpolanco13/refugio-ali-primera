// Pantalla de bienvenida del portal /terreno: tono corporativo e instructivo
// para funcionarios, antes de la identificación personal.

import { useState } from "react";
import { ArrowRight, ClipboardList, Download, MapPin, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  actualizarAppCampo,
  type ProgresoActualizacionApp,
} from "@/lib/actualizarAppCampo";

interface Props {
  nombreCentro: string;
  onContinuar: () => void;
}

/** Bienvenida breve al portal de trabajo en el campamento. */
export function TerrenoBienvenida({ nombreCentro, onContinuar }: Props) {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoActualizacionApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmarActualizacion() {
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
        "No se pudo actualizar. Cierre esta pestaña y ábrala de nuevo desde el enlace.",
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
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
              <p className="truncate text-sm font-semibold text-foreground">
                {nombreCentro}
              </p>
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
        </CardContent>

        <CardFooter className="shrink-0 border-t border-border pt-4">
          <Button type="button" className="h-11 w-full" onClick={onContinuar}>
            Continuar a identificación
            <ArrowRight className="size-4" />
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog
        open={dialogoAbierto}
        onOpenChange={(siguiente) => {
          if (actualizando) return;
          setDialogoAbierto(siguiente);
          if (!siguiente) setError(null);
        }}
      >
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="flex w-full shrink-0 flex-col items-center gap-0.5 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-center transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Descargar nueva versión de la app
            </span>
            <span className="text-[0.6875rem] leading-snug text-muted-foreground">
              Se recomienda ejecutar si detecta alguna falla
            </span>
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descargar nueva versión?</AlertDialogTitle>
            <AlertDialogDescription>
              Borra la caché y descarga la aplicación actualizada. No pierde su
              sesión: la pantalla se recarga en unos segundos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {actualizando && progreso ? (
            <div
              className="space-y-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {progreso.etiqueta}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {progreso.porcentaje}%
                </span>
              </div>
              <Progress
                value={progreso.porcentaje}
                className="h-2"
                aria-label={`Progreso: ${progreso.porcentaje}%`}
              />
            </div>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(ev) => {
                  ev.preventDefault();
                  void confirmarActualizacion();
                }}
              >
                <Download data-icon="inline-start" />
                Descargar y actualizar
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
