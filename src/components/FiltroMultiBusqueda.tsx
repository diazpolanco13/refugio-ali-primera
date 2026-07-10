import { useMemo, useState, type ReactNode } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Sentinel compartido: campamentos sin valor en esa dimensión. */
export const VALOR_SIN_ASIGNAR = "sin_asignar";

export interface OpcionFiltroMulti {
  valor: string;
  etiqueta: string;
  /** Conteo opcional mostrado como `(n)`. */
  cantidad?: number;
  indicador?: ReactNode;
}

function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const ETIQUETA_TODOS = "Todos";

/**
 * Filtro multi-select con buscador. Vacío = «Todos» (sin filtrar).
 * Orden fijo: Todos → Sin asignar → opciones del catálogo.
 */
export function FiltroMultiBusqueda({
  opciones,
  seleccion,
  onCambiar,
  placeholder,
  buscarPlaceholder = "Buscar…",
  etiquetaTodos = ETIQUETA_TODOS,
  etiquetaSinAsignar = "Sin asignar",
  cantidadSinAsignar,
  className,
}: {
  opciones: OpcionFiltroMulti[];
  seleccion: string[];
  onCambiar: (valores: string[] | ((prev: string[]) => string[])) => void;
  /** Texto del trigger cuando no hay selección (Todos). */
  placeholder: string;
  buscarPlaceholder?: string;
  etiquetaTodos?: string;
  etiquetaSinAsignar?: string;
  cantidadSinAsignar?: number;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const esTodos = seleccion.length === 0;

  const opcionesSinSentinel = useMemo(
    () => opciones.filter((o) => o.valor !== VALOR_SIN_ASIGNAR),
    [opciones],
  );

  const porValor = useMemo(() => {
    const m = new Map<string, OpcionFiltroMulti>();
    for (const o of opcionesSinSentinel) m.set(o.valor, o);
    return m;
  }, [opcionesSinSentinel]);

  const q = normalizarBusqueda(busqueda.trim());
  const opcionesFiltradas = q
    ? opcionesSinSentinel.filter((o) =>
        normalizarBusqueda(o.etiqueta).includes(q),
      )
    : opcionesSinSentinel;

  const mostrarTodos = !q || normalizarBusqueda(etiquetaTodos).includes(q);
  const mostrarSinAsignar =
    !q || normalizarBusqueda(etiquetaSinAsignar).includes(q);

  function marcar(valor: string, marcado: boolean) {
    onCambiar((prev) => {
      if (marcado) return prev.includes(valor) ? prev : [...prev, valor];
      return prev.filter((v) => v !== valor);
    });
  }

  function seleccionarTodos() {
    onCambiar([]);
  }

  const etiquetaTrigger = (() => {
    if (esTodos) return `${placeholder}: ${etiquetaTodos}`;
    if (seleccion.length === 1) {
      const v = seleccion[0];
      if (v === VALOR_SIN_ASIGNAR) {
        return `${placeholder}: ${etiquetaSinAsignar}`;
      }
      return `${placeholder}: ${porValor.get(v)?.etiqueta ?? "1 seleccionado"}`;
    }
    return `${placeholder}: ${seleccion.length} seleccionados`;
  })();

  const sinResultados =
    opcionesFiltradas.length === 0 && !mostrarTodos && !mostrarSinAsignar;

  return (
    <Popover
      open={abierto}
      onOpenChange={(open) => {
        setAbierto(open);
        if (!open) setBusqueda("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-pressed={!esTodos}
          data-active={!esTodos || undefined}
          className={cn(
            "h-8 w-full justify-between px-2.5 text-xs transition-colors",
            esTodos
              ? "border-border/70 bg-card/70 font-normal text-muted-foreground"
              : "border-primary/70 bg-primary/15 font-medium text-foreground shadow-sm ring-1 ring-primary/35",
            className,
          )}
        >
          <span className="truncate text-left">{etiquetaTrigger}</span>
          <ChevronsUpDown
            className={cn(
              "size-3.5 shrink-0",
              esTodos ? "opacity-50" : "opacity-80 text-primary",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="border-b border-border/60 p-1.5">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={buscarPlaceholder}
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {mostrarTodos && (
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium",
                "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Checkbox
                checked={esTodos}
                onCheckedChange={(checked) => {
                  if (checked === true) seleccionarTodos();
                }}
              />
              <span className="truncate">{etiquetaTodos}</span>
            </label>
          )}
          {mostrarSinAsignar && (
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium",
                "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Checkbox
                checked={seleccion.includes(VALOR_SIN_ASIGNAR)}
                onCheckedChange={(checked) =>
                  marcar(VALOR_SIN_ASIGNAR, checked === true)
                }
              />
              <span className="truncate">
                {etiquetaSinAsignar}
                {cantidadSinAsignar != null ? ` (${cantidadSinAsignar})` : ""}
              </span>
            </label>
          )}
          {sinResultados ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Sin resultados.
            </p>
          ) : (
            opcionesFiltradas.map((o) => {
              const marcado = seleccion.includes(o.valor);
              return (
                <label
                  key={o.valor}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs",
                    "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Checkbox
                    checked={marcado}
                    onCheckedChange={(checked) =>
                      marcar(o.valor, checked === true)
                    }
                  />
                  {o.indicador}
                  <span className="truncate">
                    {o.etiqueta}
                    {o.cantidad != null ? ` (${o.cantidad})` : ""}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * ¿El valor escalar del campamento coincide con la selección multi?
 * `valorNormalizado === VALOR_SIN_ASIGNAR` (o vacío) = sin asignar.
 */
export function coincideFiltroEscalar(
  seleccion: readonly string[],
  valorNormalizado: string,
): boolean {
  if (seleccion.length === 0) return true;
  const clave =
    !valorNormalizado || valorNormalizado === VALOR_SIN_ASIGNAR
      ? VALOR_SIN_ASIGNAR
      : valorNormalizado;
  return seleccion.includes(clave);
}

/**
 * ¿Algún id de la lista del campamento está en la selección?
 * Lista vacía = sin asignar.
 */
export function coincideFiltroLista(
  seleccion: readonly string[],
  valores: readonly string[],
): boolean {
  if (seleccion.length === 0) return true;
  if (valores.length === 0) return seleccion.includes(VALOR_SIN_ASIGNAR);
  return seleccion.some(
    (v) => v !== VALOR_SIN_ASIGNAR && valores.includes(v),
  );
}
