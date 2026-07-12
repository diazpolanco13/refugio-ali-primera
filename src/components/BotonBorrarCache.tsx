import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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

type Variante = "flotante" | "mapa" | "header" | "descriptivo";

interface DialogoActualizarAppProps {
  abierto: boolean;
  actualizando: boolean;
  progreso: ProgresoActualizacionApp | null;
  error: string | null;
  onOpenChange: (abierto: boolean) => void;
  onConfirmar: () => void;
  titulo?: string;
  etiquetaConfirmar?: string;
}

/** Diálogo compartido: borrar caché SW + recargar la PWA. */
function DialogoActualizarApp({
  abierto,
  actualizando,
  progreso,
  error,
  onOpenChange,
  onConfirmar,
  titulo = "¿Descargar nueva versión?",
  etiquetaConfirmar = "Descargar y actualizar",
}: DialogoActualizarAppProps) {
  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (actualizando) return;
        onOpenChange(siguiente);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>
            Borra la caché y descarga la aplicación actualizada. No pierde su
            sesión: la pantalla se recarga en unos segundos. Úselo si no ve
            cambios recientes o la app se comporta raro.
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
              onClick={(ev) => {
                ev.preventDefault();
                onConfirmar();
              }}
            >
              <Download data-icon="inline-start" />
              {etiquetaConfirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function useActualizarAppCampo() {
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

  function cerrar(siguiente: boolean) {
    if (actualizando) return;
    setAbierto(siguiente);
    if (!siguiente) setError(null);
  }

  return {
    abierto,
    setAbierto,
    actualizando,
    progreso,
    error,
    confirmar,
    cerrar,
  };
}

/**
 * Confirma y ejecuta borrado de SW + Cache Storage + recarga.
 * `mapa`: columna de controles del mapa. `flotante`: FAB esquina.
 * `header`: icono compacto (legacy). `descriptivo`: bloque con texto.
 */
export function BotonBorrarCache({
  variante = "flotante",
  className,
}: {
  variante?: Variante;
  className?: string;
}) {
  const { abierto, setAbierto, actualizando, progreso, error, confirmar, cerrar } =
    useActualizarAppCampo();

  if (variante === "descriptivo") {
    return (
      <>
        <button
          type="button"
          className={cn(
            "flex w-full shrink-0 flex-col items-center gap-0.5 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-center transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary",
            className,
          )}
          onClick={() => setAbierto(true)}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Descargar nueva versión de la app
          </span>
          <span className="text-[0.6875rem] leading-snug text-muted-foreground">
            Se recomienda ejecutar si detecta alguna falla
          </span>
        </button>
        <DialogoActualizarApp
          abierto={abierto}
          actualizando={actualizando}
          progreso={progreso}
          error={error}
          onOpenChange={cerrar}
          onConfirmar={() => void confirmar()}
        />
      </>
    );
  }

  const triggerClass =
    variante === "mapa"
      ? "h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
      : variante === "header"
        ? "size-10 shrink-0 rounded-xl border-0 bg-primary-foreground/15 text-primary-foreground shadow-none hover:bg-destructive/25 hover:text-primary-foreground"
        : "pointer-events-auto size-12 rounded-full border-2 border-destructive bg-card text-destructive shadow-lg ring-2 ring-destructive/25 hover:bg-destructive hover:text-destructive-foreground";

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(triggerClass, className)}
            aria-label="Borrar caché y actualizar aplicación"
            onClick={() => setAbierto(true)}
          >
            <Trash2
              className={variante === "flotante" ? "size-5" : "size-4"}
              aria-hidden="true"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={variante === "header" ? "bottom" : "left"} sideOffset={8}>
          Borrar caché
        </TooltipContent>
      </Tooltip>
      <DialogoActualizarApp
        abierto={abierto}
        actualizando={actualizando}
        progreso={progreso}
        error={error}
        onOpenChange={cerrar}
        onConfirmar={() => void confirmar()}
        titulo="¿Borrar caché y actualizar?"
        etiquetaConfirmar="Borrar y actualizar"
      />
    </>
  );
}

/** Ítem del menú «Más» en cabeceras de campo (/censo). */
export function MenuItemActualizarApp() {
  const { abierto, setAbierto, actualizando, progreso, error, confirmar, cerrar } =
    useActualizarAppCampo();

  return (
    <>
      <DropdownMenuItem
        onSelect={(ev) => {
          ev.preventDefault();
          setAbierto(true);
        }}
      >
        <Download />
        Descargar nueva versión de la app
      </DropdownMenuItem>
      <DialogoActualizarApp
        abierto={abierto}
        actualizando={actualizando}
        progreso={progreso}
        error={error}
        onOpenChange={cerrar}
        onConfirmar={() => void confirmar()}
      />
    </>
  );
}
