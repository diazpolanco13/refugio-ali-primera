import { useState, type ReactNode } from "react";
import {
  CATALOGO_LINEAS,
  CATALOGO_TIPOS,
  type TipoLinea,
  type TipoPunto,
} from "@/domain/tipos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { BASES_DISPONIBLES, type BaseMapa } from "@/map/estiloMapa";
import { ControlDibujo } from "@/map/ControlDibujo";
import type { ModoDibujo } from "@/map/MapView";
import { cn } from "@/lib/utils";
import { Layers, Loader2, LocateFixed, Map, Minus, Plus, Tent } from "lucide-react";
import type { MapViewHandle } from "@/map/MapView";

const btnMapa =
  "size-9 rounded-none first:rounded-t-md last:rounded-b-md shadow-none";

interface ControlesMapaProps {
  baseMapa: BaseMapa;
  onBaseMapa: (base: BaseMapa) => void;
  zoom: number;
  mapaRef: React.RefObject<MapViewHandle | null>;
  capasVisibles: Set<TipoPunto>;
  onToggleCapa: (tipo: TipoPunto) => void;
  lineasVisibles: Set<TipoLinea>;
  onToggleLinea: (tipo: TipoLinea) => void;
  mostrarSectores: boolean;
  onToggleSectores: () => void;
  mostrarLineas: boolean;
  onToggleMostrarLineas: () => void;
  conteos: Map<TipoPunto, number>;
  conteosLineas: Map<TipoLinea, number>;
  /** Ocultar cuando hay paneles móviles abiertos. */
  oculto?: boolean;
  puedeEditar?: boolean;
  modoDibujo?: ModoDibujo;
  modoEdicion?: boolean;
  onDibujar?: (modo: ModoDibujo) => void;
  onEditar?: () => void;
}

export function ControlesMapa({
  baseMapa,
  onBaseMapa,
  zoom,
  mapaRef,
  capasVisibles,
  onToggleCapa,
  lineasVisibles,
  onToggleLinea,
  mostrarSectores,
  onToggleSectores,
  mostrarLineas,
  onToggleMostrarLineas,
  conteos,
  conteosLineas,
  oculto,
  puedeEditar,
  modoDibujo = "none",
  modoEdicion = false,
  onDibujar,
  onEditar,
}: ControlesMapaProps) {
  const [ubicando, setUbicando] = useState(false);

  if (oculto) return null;

  function ajustarZoom(delta: number) {
    const z = Math.min(20, Math.max(13, Math.round((zoom + delta) * 10) / 10));
    mapaRef.current?.setZoom(z);
  }

  async function localizarme() {
    if (ubicando) return;
    setUbicando(true);
    try {
      await mapaRef.current?.localizar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo obtener la ubicación.");
    } finally {
      setUbicando(false);
    }
  }

  return (
    <>
      {/* Base + capas + dibujo */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex gap-1">
        <div className="pointer-events-auto flex overflow-hidden rounded-lg border border-border/60 bg-popover/95 shadow-lg backdrop-blur-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-9 rounded-none"
                title="Base del mapa"
                aria-label="Base del mapa"
              >
                <Map className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuRadioGroup
                value={baseMapa}
                onValueChange={(v) => onBaseMapa(v as BaseMapa)}
              >
                {BASES_DISPONIBLES.map((b) => (
                  <DropdownMenuRadioItem key={b.valor} value={b.valor}>
                    {b.label.replace(/^[^\s]+\s/, "")}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-9" />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-9 rounded-none"
                title="Capas"
                aria-label="Capas"
              >
                <Layers className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 gap-2 p-2">
              <div className="flex gap-1">
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={mostrarSectores}
                  onPressedChange={() => onToggleSectores()}
                  className="h-7 flex-1 text-xs"
                >
                  Sectores
                </Toggle>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={mostrarLineas}
                  onPressedChange={() => onToggleMostrarLineas()}
                  className="h-7 flex-1 text-xs"
                >
                  Líneas
                </Toggle>
              </div>
              <Separator />
              <div className="max-h-36 space-y-0.5 overflow-y-auto">
                {CATALOGO_LINEAS.map((m) => (
                  <FilaCapa
                    key={m.tipo}
                    activo={lineasVisibles.has(m.tipo)}
                    onToggle={() => onToggleLinea(m.tipo)}
                    icono={
                      <span
                        className="inline-block h-0.5 w-3 rounded"
                        style={{
                          background: m.estilo === "solido" ? m.color : "transparent",
                          borderTop:
                            m.estilo !== "solido" ? `2px dashed ${m.color}` : undefined,
                        }}
                      />
                    }
                    label={m.label}
                    count={conteosLineas.get(m.tipo) ?? 0}
                  />
                ))}
              </div>
              <Separator />
              <div className="max-h-44 space-y-0.5 overflow-y-auto">
                {CATALOGO_TIPOS.map((m) => (
                  <FilaCapa
                    key={m.tipo}
                    activo={capasVisibles.has(m.tipo)}
                    onToggle={() => onToggleCapa(m.tipo)}
                    icono={
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ background: m.color }}
                      />
                    }
                    label={`${m.icono} ${m.label.split(" / ")[0]}`}
                    count={conteos.get(m.tipo) ?? 0}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {puedeEditar && onDibujar && onEditar && (
            <>
              <Separator orientation="vertical" className="h-9" />
              <ControlDibujo
                modoDibujo={modoDibujo}
                modoEdicion={modoEdicion}
                onDibujar={onDibujar}
                onEditar={onEditar}
              />
            </>
          )}
        </div>
      </div>

      {/* Zoom + centrar */}
      <div className="pointer-events-none absolute right-2 top-2 z-10">
        <div className="pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-border/60 bg-popover/95 shadow-lg backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon-sm"
            className={btnMapa}
            onClick={() => ajustarZoom(0.5)}
            aria-label="Acercar"
          >
            <Plus className="size-4" />
          </Button>
          <div className="border-y border-border/60 px-1 py-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
            {zoom.toFixed(1)}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className={btnMapa}
            onClick={() => ajustarZoom(-0.5)}
            aria-label="Alejar"
          >
            <Minus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(btnMapa, "border-t border-border/60")}
            onClick={localizarme}
            disabled={ubicando}
            aria-label="Mi ubicación (GPS)"
            title="Mi ubicación (GPS)"
          >
            {ubicando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LocateFixed className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(btnMapa, "border-t border-border/60")}
            onClick={() => mapaRef.current?.volverAlParque()}
            aria-label="Centrar en el parque"
            title="Centrar en el parque"
          >
            <Tent className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function FilaCapa({
  activo,
  onToggle,
  icono,
  label,
  count,
}: {
  activo: boolean;
  onToggle: () => void;
  icono: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
        activo
          ? "bg-teal-600/15 text-foreground"
          : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {icono}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-[10px] opacity-60">{count}</span>
    </button>
  );
}
