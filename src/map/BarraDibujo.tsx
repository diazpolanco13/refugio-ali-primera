import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ModoDibujo } from "@/map/MapView";
import {
  BoxSelect,
  MapPin,
  Minus,
  Pencil,
  Pentagon,
  PenLine,
  Route,
  type LucideIcon,
} from "lucide-react";

const HERRAMIENTAS: {
  modo: ModoDibujo;
  icon: LucideIcon;
  label: string;
}[] = [
  { modo: "rectangulo", icon: BoxSelect, label: "Sector" },
  { modo: "poligono", icon: Pentagon, label: "Libre" },
  { modo: "punto", icon: MapPin, label: "Punto" },
  { modo: "linea_limite", icon: PenLine, label: "Límite" },
  { modo: "linea_calle", icon: Minus, label: "Calle" },
  { modo: "linea_camineria", icon: Route, label: "Camino" },
];

interface BarraDibujoProps {
  modoDibujo: ModoDibujo;
  modoEdicion: boolean;
  onDibujar: (modo: ModoDibujo) => void;
  onEditar: () => void;
}

export function BarraDibujo({
  modoDibujo,
  modoEdicion,
  onDibujar,
  onEditar,
}: BarraDibujoProps) {
  const [abierto, setAbierto] = useState(false);
  const activo = modoDibujo !== "none" || modoEdicion;

  const herramientaActiva = HERRAMIENTAS.find((h) => h.modo === modoDibujo);
  const IconoFab =
    modoEdicion ? Pencil : herramientaActiva?.icon ?? Pencil;

  function elegir(modo: ModoDibujo) {
    onDibujar(modo);
    setAbierto(false);
  }

  function toggleEditar() {
    onEditar();
    setAbierto(false);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            size="icon-lg"
            variant={activo ? "default" : "outline"}
            className={cn(
              "pointer-events-auto size-11 rounded-full border-border/60 bg-popover/95 shadow-lg backdrop-blur-sm",
              activo &&
                !modoEdicion &&
                "border-teal-500/50 bg-teal-600 text-white hover:bg-teal-500",
              modoEdicion &&
                "border-amber-500/50 bg-amber-600 text-white hover:bg-amber-500",
            )}
            aria-label="Herramientas de dibujo"
            title={activo ? "Cambiar herramienta" : "Dibujar en el mapa"}
          >
            <IconoFab className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={8}
          className="w-auto gap-0 p-1.5"
        >
          <div className="grid grid-cols-3 gap-0.5">
            {HERRAMIENTAS.map(({ modo, icon: Icon, label }) => (
              <Button
                key={modo}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 flex-col gap-0 px-2 text-[10px] font-medium",
                  modoDibujo === modo &&
                    "bg-teal-600/15 text-teal-300 hover:bg-teal-600/20",
                )}
                onClick={() => elegir(modo)}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
          </div>
          <Separator className="my-1" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-full justify-start gap-2 text-xs",
              modoEdicion && "bg-amber-600/15 text-amber-300 hover:bg-amber-600/20",
            )}
            onClick={toggleEditar}
          >
            <Pencil className="size-3.5" />
            Editar geometrías
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
