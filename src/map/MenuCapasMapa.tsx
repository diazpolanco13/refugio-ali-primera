// Selector de capas base del mapa (reutilizable en centros y residencia).

import { useState } from "react";
import { Check, Layers } from "lucide-react";
import { BASES_DISPONIBLES, type BaseMapa } from "@/map/estiloMapa";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  baseMapa: BaseMapa;
  onCambiarBase: (base: BaseMapa) => void;
  /** Bases visibles en el menú (default: calles, osm, satélite, híbrido, topo). */
  bases?: BaseMapa[];
  className?: string;
  size?: "sm" | "default";
}

const BASES_RESIDENCIA: BaseMapa[] = ["calles", "calles-claro", "osm", "satelite", "hibrido", "topo"];

export function MenuCapasMapa({
  baseMapa,
  onCambiarBase,
  bases = BASES_RESIDENCIA,
  className,
  size = "sm",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const baseActiva = BASES_DISPONIBLES.find((b) => b.valor === baseMapa);
  const opciones = BASES_DISPONIBLES.filter((b) => bases.includes(b.valor));
  const btnSize = size === "sm" ? "size-8" : "size-10";

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
                "shrink-0 border-border/60 bg-card/95 shadow-sm backdrop-blur-sm hover:bg-muted/80",
                btnSize,
                abierto && "bg-primary/15 text-primary",
                className,
              )}
              aria-label={`Vista del mapa: ${baseActiva?.label ?? baseMapa}`}
            >
              <Layers className="size-3.5" />
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
        className="max-h-[min(20rem,60dvh)] w-48 overflow-y-auto p-1.5"
      >
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Vista del mapa
        </p>
        <div className="flex flex-col gap-0.5">
          {opciones.map((b) => {
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
