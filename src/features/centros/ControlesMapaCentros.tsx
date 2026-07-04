import { useState, type ReactNode } from "react";
import { Camera, Check, Home, Layers, Loader2, Locate, LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BASES_DISPONIBLES, type BaseMapa } from "@/map/estiloMapa";
import { cn } from "@/lib/utils";

interface ControlesProps {
  className?: string;
  gpsActivo: boolean;
  /** Ancho visible aproximado del mapa, p. ej. "3k" o "500m". */
  escalaVista?: string;
  exportando?: boolean;
  baseMapa: BaseMapa;
  onCambiarBase: (base: BaseMapa) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onGps: () => void;
  onCentrarCaracas: () => void;
  onExportar?: () => void;
}

interface CapasProps {
  baseMapa: BaseMapa;
  onCambiarBase: (base: BaseMapa) => void;
}

function BotonMapa({
  etiqueta,
  onClick,
  children,
  activo = false,
  deshabilitado = false,
}: {
  etiqueta: string;
  onClick: () => void;
  children: ReactNode;
  activo?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={activo ? "secondary" : "outline"}
          size="icon"
          disabled={deshabilitado}
          className={cn(
            "h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-foreground shadow-none hover:bg-muted/80",
            activo && "bg-primary/15 text-primary",
          )}
          onClick={onClick}
          aria-label={etiqueta}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        {etiqueta}
      </TooltipContent>
    </Tooltip>
  );
}

/** Botón de capas base, integrado a la columna de controles del mapa. */
function MenuCapas({ baseMapa, onCambiarBase }: CapasProps) {
  const [abierto, setAbierto] = useState(false);
  const baseActiva = BASES_DISPONIBLES.find((b) => b.valor === baseMapa);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-foreground shadow-none hover:bg-muted/80",
                abierto && "bg-primary/15 text-primary",
              )}
              aria-label={`Vista del mapa: ${baseActiva?.label ?? baseMapa}`}
            >
              <Layers className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          Vista del mapa
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="max-h-[min(24rem,70dvh)] w-52 overflow-y-auto p-1.5"
      >
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Vista del mapa
        </p>
        <div className="flex flex-col gap-0.5">
          {BASES_DISPONIBLES.map((b) => {
            const activa = baseMapa === b.valor;
            return (
              <button
                key={b.valor}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/80",
                  activa && "bg-primary/15 font-medium text-primary",
                )}
                onClick={() => {
                  onCambiarBase(b.valor);
                  setAbierto(false);
                }}
              >
                <span>{b.label}</span>
                {activa && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Controles laterales: zoom, GPS, Caracas y captura (cámara). */
export function ControlesMapaCentros({
  className,
  gpsActivo,
  escalaVista,
  exportando = false,
  baseMapa,
  onCambiarBase,
  onZoomIn,
  onZoomOut,
  onGps,
  onCentrarCaracas,
  onExportar,
}: ControlesProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "map-controls-overlay pointer-events-none absolute right-3 top-3 z-10 flex flex-col gap-2",
          className,
        )}
      >
        <ButtonGroup
          orientation="vertical"
          className="pointer-events-auto w-10 min-w-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <BotonMapa etiqueta="Acercar" onClick={onZoomIn}>
            <Plus className="size-4" />
          </BotonMapa>
          {escalaVista && (
            <div
              className="flex h-8 shrink-0 items-center justify-center border-y border-border/60 bg-muted/40 px-0.5"
              aria-hidden="true"
              title={`Vista ~${escalaVista} de ancho`}
            >
              <span className="text-[10px] font-semibold tabular-nums leading-none text-muted-foreground">
                {escalaVista}
              </span>
            </div>
          )}
          <BotonMapa etiqueta="Alejar" onClick={onZoomOut}>
            <Minus className="size-4" />
          </BotonMapa>
        </ButtonGroup>

        <ButtonGroup
          orientation="vertical"
          className="pointer-events-auto w-10 min-w-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <BotonMapa
            etiqueta={gpsActivo ? "Desactivar GPS" : "Mi ubicación (GPS)"}
            onClick={onGps}
            activo={gpsActivo}
          >
            {gpsActivo ? (
              <LocateFixed className="size-4 text-primary" />
            ) : (
              <Locate className="size-4" />
            )}
          </BotonMapa>
          <BotonMapa etiqueta="Centrar en Caracas" onClick={onCentrarCaracas}>
            <Home className="size-4" />
          </BotonMapa>
        </ButtonGroup>

        <ButtonGroup
          orientation="vertical"
          className="pointer-events-auto w-10 min-w-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {onExportar && (
            <BotonMapa
              etiqueta="Capturar mapa (PNG)"
              onClick={onExportar}
              deshabilitado={exportando}
            >
              {exportando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </BotonMapa>
          )}
          <MenuCapas baseMapa={baseMapa} onCambiarBase={onCambiarBase} />
        </ButtonGroup>
      </div>
    </TooltipProvider>
  );
}
