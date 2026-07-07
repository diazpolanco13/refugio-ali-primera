import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  ESTADO_FILA_VACIO,
  FilaCentroLista,
  normalizarTextoBusqueda,
  type EstadoFilaCentro,
} from "./CentrosListaItems";

/**
 * Buscador compacto en la columna flotante del mapa. Al elegir un centro,
 * vuela hacia él y abre la nube informativa sin abrir el panel lateral.
 */
export function BuscadorCompacto({
  centros,
  estados,
  seleccionado,
  onSeleccionar,
}: {
  centros: CentroTransitorio[];
  estados: Map<string, EstadoFilaCentro>;
  seleccionado: string | null;
  onSeleccionar: (centro: CentroTransitorio) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClick(e: MouseEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClick);
    return () => document.removeEventListener("mousedown", alClick);
  }, [abierto]);

  const termino = normalizarTextoBusqueda(busqueda.trim());
  const resultados = useMemo(() => {
    if (!termino) return [];
    return centros
      .filter((c) =>
        normalizarTextoBusqueda(
          `${c.nombre} ${c.parroquia} ${c.direccion} ${c.cuerpo}`,
        ).includes(termino),
      )
      .slice(0, 30);
  }, [centros, termino]);

  return (
    <div ref={contenedorRef} className="contents">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-10 w-10 min-w-10 shrink-0 border-0 shadow-none hover:bg-muted/80",
              abierto ? "bg-primary/15 text-primary" : "bg-card text-foreground",
            )}
            onClick={() => {
              setAbierto((v) => !v);
              if (!abierto) requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label="Buscar un campamento"
            aria-expanded={abierto}
          >
            <Search className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Buscar un centro
        </TooltipContent>
      </Tooltip>

      {abierto && (
        <div
          className="absolute left-[3.25rem] top-0 z-50 flex max-h-[min(20rem,70dvh)] w-[min(18rem,calc(86vw-3.25rem))] flex-col overflow-hidden rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-sm"
          role="dialog"
          aria-label="Búsqueda de campamentos"
        >
          <div className="shrink-0 border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar campamento, parroquia…"
                className="h-8 pl-8 pr-7 text-xs"
                aria-label="Buscar campamento"
              />
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  inputRef.current?.focus();
                }}
                title="Limpiar búsqueda"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {!termino ? (
              <p className="px-2 py-2 text-[10px] text-muted-foreground">
                Escribe para buscar entre los {centros.length} campamentos.
              </p>
            ) : resultados.length === 0 ? (
              <p className="px-2 py-2 text-[10px] text-muted-foreground">
                Sin coincidencias.
              </p>
            ) : (
              <div className="space-y-0.5">
                {resultados.map((centro) => (
                  <FilaCentroLista
                    key={centro.id}
                    centro={centro}
                    estado={estados.get(centro.id) ?? ESTADO_FILA_VACIO}
                    seleccionado={seleccionado === centro.id}
                    mostrarUnidad
                    onSeleccionar={(c) => {
                      onSeleccionar(c);
                      setAbierto(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
