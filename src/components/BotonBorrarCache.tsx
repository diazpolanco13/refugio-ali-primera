import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  actualizarAppCampo,
  type ProgresoActualizacionApp,
} from "@/lib/actualizarAppCampo";
import { cn } from "@/lib/utils";

type Variante = "flotante" | "mapa";

/**
 * Confirma y ejecuta borrado de SW + Cache Storage + recarga.
 * `mapa`: estilo de la columna de controles. `flotante`: FAB esquina.
 */
export function BotonBorrarCache({
  variante = "flotante",
  className,
}: {
  variante?: Variante;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoActualizacionApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
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
        "No se pudo borrar la caché. Cierre esta pestaña y ábrala de nuevo, o borre los datos del sitio en el navegador.",
      );
    }
  }

  const dialogo: ReactNode = (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>¿Borrar caché y actualizar?</AlertDialogTitle>
        <AlertDialogDescription>
          Descarga la versión nueva de la aplicación. No pierde su sesión: la
          pantalla se recarga en unos segundos. Úselo si no ve cambios recientes
          o la app se comporta raro.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {actualizando && progreso ? (
        <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
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
            variant="destructive"
            onClick={(ev) => {
              ev.preventDefault();
              void confirmar();
            }}
          >
            <Trash2 data-icon="inline-start" />
            Borrar y actualizar
          </AlertDialogAction>
        </AlertDialogFooter>
      )}
    </AlertDialogContent>
  );

  const triggerClass =
    variante === "mapa"
      ? "h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
      : "pointer-events-auto size-12 rounded-full border-2 border-destructive bg-card text-destructive shadow-lg ring-2 ring-destructive/25 hover:bg-destructive hover:text-destructive-foreground";

  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (actualizando) return;
        setAbierto(siguiente);
        if (!siguiente) setError(null);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(triggerClass, className)}
              aria-label="Borrar caché y actualizar aplicación"
            >
              <Trash2
                className={variante === "mapa" ? "size-4" : "size-5"}
                aria-hidden="true"
              />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          Borrar caché
        </TooltipContent>
      </Tooltip>
      {dialogo}
    </AlertDialog>
  );
}
