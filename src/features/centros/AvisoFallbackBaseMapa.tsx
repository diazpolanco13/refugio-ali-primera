import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { etiquetaBaseMapa } from "@/map/disponibilidadCarto";
import type { BaseMapa } from "@/map/estiloMapa";

export interface InfoFallbackBaseMapa {
  preferida: BaseMapa;
  usada: BaseMapa;
  motivo: string;
}

interface Props {
  info: InfoFallbackBaseMapa;
  reintentando?: boolean;
  onReintentar: () => void;
  onCerrar: () => void;
}

/**
 * Aviso no silencioso cuando Carto (u otra base preferida) no carga
 * y el mapa pasa a un proveedor de respaldo.
 */
export function AvisoFallbackBaseMapa({
  info,
  reintentando = false,
  onReintentar,
  onCerrar,
}: Props) {
  const labelPreferida = etiquetaBaseMapa(info.preferida);
  const labelUsada = etiquetaBaseMapa(info.usada);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-2 sm:top-3 sm:px-4"
      role="status"
    >
      <Alert
        variant="destructive"
        className="pointer-events-auto w-full max-w-lg border-amber-500/60 bg-background/95 shadow-lg backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
      >
        <AlertTriangle className="text-amber-600 dark:text-amber-400" />
        <AlertTitle className="pr-8 text-foreground">
          Mapa base no disponible
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          <p>
            No se pudo cargar <span className="font-medium text-foreground">{labelPreferida}</span>
            {" "}({info.motivo}). Usando{" "}
            <span className="font-medium text-foreground">{labelUsada}</span>{" "}
            automáticamente. Carto sigue siendo la preferencia por defecto.
          </p>
        </AlertDescription>
        <AlertAction className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={reintentando}
            onClick={onReintentar}
            className="h-7 gap-1 border-input bg-background"
          >
            <RefreshCw className={`size-3.5 ${reintentando ? "animate-spin" : ""}`} />
            Reintentar Carto
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cerrar aviso"
            onClick={onCerrar}
            className="size-7"
          >
            <X className="size-3.5" />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
