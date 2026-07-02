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

interface Props {
  modoDibujo: ModoDibujo;
  modoEdicion: boolean;
  onDibujar: (modo: ModoDibujo) => void;
  onEditar: () => void;
}

export function ControlDibujo({
  modoDibujo,
  modoEdicion,
  onDibujar,
  onEditar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const activo = modoDibujo !== "none" || modoEdicion;

  const herramientaActiva = HERRAMIENTAS.find((h) => h.modo === modoDibujo);
  const Icono = modoEdicion ? Pencil : (herramientaActiva?.icon ?? Pencil);

  function elegir(modo: ModoDibujo) {
    onDibujar(modo);
    setAbierto(false);
  }

  function toggleEditar() {
    onEditar();
    setAbierto(false);
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "size-9 rounded-none",
            activo &&
              !modoEdicion &&
              "bg-teal-600/20 text-teal-300 hover:bg-teal-600/25 hover:text-teal-200",
            modoEdicion &&
              "bg-amber-600/20 text-amber-300 hover:bg-amber-600/25 hover:text-amber-200",
          )}
          aria-label="Dibujar en el mapa"
          title={activo ? "Herramienta activa" : "Dibujar"}
        >
          <Icono className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" sideOffset={6} className="w-auto gap-0 p-1.5">
        <div className="grid grid-cols-3 gap-0.5">
          {HERRAMIENTAS.map(({ modo, icon: HerramientaIcon, label }) => (
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
              <HerramientaIcon className="size-4" />
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
  );
}
