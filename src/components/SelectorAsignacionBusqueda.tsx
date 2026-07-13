// Selector de asignación con buscador (shadcn Popover + Checkbox).
// Orden fijo: Todos → Sin asignar → opciones del catálogo.
// `multiple`: uno o varios. `unico`: una sola opción (radio vía checkbox).

import { useMemo, useState, type ReactNode } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const VALOR_SIN_ASIGNAR_ASIG = "sin_asignar";

export interface OpcionAsignacion {
  valor: string;
  etiqueta: string;
  indicador?: ReactNode;
}

function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

interface Props {
  opciones: OpcionAsignacion[];
  /** Valores seleccionados (vacío = Sin asignar). */
  seleccion: string[];
  onCambiar: (valores: string[]) => void;
  /** `unico` = una opción; `multiple` = varias. */
  modo?: "unico" | "multiple";
  placeholder?: string;
  buscarPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Chips debajo del trigger (útil en multiple). */
  mostrarChips?: boolean;
  vacioMensaje?: string;
}

/**
 * Lista desplegable de asignación: buscador + Todos + Sin asignar + opciones.
 */
export function SelectorAsignacionBusqueda({
  opciones,
  seleccion,
  onCambiar,
  modo = "unico",
  placeholder = "Seleccionar…",
  buscarPlaceholder = "Buscar…",
  disabled,
  className,
  mostrarChips = modo === "multiple",
  vacioMensaje = "Sin opciones disponibles.",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const multiple = modo === "multiple";

  const opcionesLimpias = useMemo(
    () => opciones.filter((o) => o.valor && o.valor !== VALOR_SIN_ASIGNAR_ASIG),
    [opciones],
  );

  const porValor = useMemo(() => {
    const m = new Map<string, OpcionAsignacion>();
    for (const o of opcionesLimpias) m.set(o.valor, o);
    return m;
  }, [opcionesLimpias]);

  const seleccionValida = useMemo(
    () => seleccion.filter((v) => v && v !== VALOR_SIN_ASIGNAR_ASIG && porValor.has(v)),
    [seleccion, porValor],
  );

  const esSinAsignar = seleccionValida.length === 0;
  const esTodos =
    multiple &&
    opcionesLimpias.length > 0 &&
    seleccionValida.length === opcionesLimpias.length &&
    opcionesLimpias.every((o) => seleccionValida.includes(o.valor));

  const q = normalizarBusqueda(busqueda.trim());
  const opcionesFiltradas = q
    ? opcionesLimpias.filter((o) => normalizarBusqueda(o.etiqueta).includes(q))
    : opcionesLimpias;

  const mostrarTodos = !q || normalizarBusqueda("Todos").includes(q);
  const mostrarSinAsignar = !q || normalizarBusqueda("Sin asignar").includes(q);

  function seleccionarSinAsignar() {
    onCambiar([]);
  }

  function seleccionarTodos() {
    if (!multiple) {
      // En modo único no hay «todos» como valor: equivale a dejar sin filtrar
      // la lista (sin asignación concreta).
      onCambiar([]);
      setAbierto(false);
      return;
    }
    onCambiar(opcionesLimpias.map((o) => o.valor));
  }

  function toggleOpcion(valor: string) {
    if (multiple) {
      if (seleccionValida.includes(valor)) {
        onCambiar(seleccionValida.filter((v) => v !== valor));
      } else {
        onCambiar([...seleccionValida, valor]);
      }
      return;
    }
    // Único: clic en la misma desasigna; en otra reemplaza.
    if (seleccionValida[0] === valor) onCambiar([]);
    else onCambiar([valor]);
    setAbierto(false);
  }

  const etiquetaTrigger = (() => {
    if (esSinAsignar) return placeholder;
    if (esTodos) return `Todos (${opcionesLimpias.length})`;
    if (seleccionValida.length === 1) {
      return porValor.get(seleccionValida[0])?.etiqueta ?? "1 seleccionado";
    }
    return `${seleccionValida.length} seleccionados`;
  })();

  const sinResultados =
    opcionesFiltradas.length === 0 && !mostrarTodos && !mostrarSinAsignar;

  return (
    <div className="space-y-1">
      <Popover
        open={abierto}
        onOpenChange={(open) => {
          if (disabled) return;
          setAbierto(open);
          if (!open) setBusqueda("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            role="combobox"
            aria-expanded={abierto}
            disabled={disabled}
            className={cn(
              // Caja de control bien marcada (outline dark:border-input queda invisible)
              "h-9 w-full justify-between gap-2 rounded-lg border-2 border-muted-foreground/45 bg-muted px-3 text-xs font-semibold shadow-md shadow-black/35",
              "dark:border-muted-foreground/55 dark:bg-secondary dark:hover:bg-secondary/90",
              "hover:border-teal-500/55 hover:bg-muted/90",
              "aria-expanded:border-teal-500/70 aria-expanded:ring-3 aria-expanded:ring-teal-500/25",
              esSinAsignar
                ? "font-normal text-muted-foreground"
                : "text-foreground",
              className,
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {etiquetaTrigger}
            </span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-teal-400/90"
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) gap-0 border-2 border-muted-foreground/40 p-0 shadow-lg shadow-black/40 ring-1 ring-foreground/15"
          align="start"
        >
          <div className="border-b border-border bg-muted/30 p-1.5">
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={buscarPlaceholder}
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto p-1.5">
            {mostrarTodos && (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border-2 border-muted-foreground/35 bg-muted/50 px-2.5 py-2 text-xs font-medium shadow-sm shadow-black/20",
                  "hover:border-teal-500/45 hover:bg-accent hover:text-accent-foreground",
                  esTodos && "border-teal-500/55 bg-teal-950/40",
                )}
              >
                <Checkbox
                  checked={esTodos}
                  className="size-3.5"
                  onCheckedChange={(checked) => {
                    if (checked === true) seleccionarTodos();
                  }}
                />
                <span className="truncate">Todos</span>
                {multiple && opcionesLimpias.length > 0 && (
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                    {opcionesLimpias.length}
                  </span>
                )}
              </label>
            )}
            {mostrarSinAsignar && (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border-2 border-muted-foreground/35 bg-muted/50 px-2.5 py-2 text-xs font-medium shadow-sm shadow-black/20",
                  "hover:border-teal-500/45 hover:bg-accent hover:text-accent-foreground",
                  esSinAsignar && "border-teal-500/55 bg-teal-950/40",
                )}
              >
                <Checkbox
                  checked={esSinAsignar}
                  className="size-3.5"
                  onCheckedChange={(checked) => {
                    if (checked === true) seleccionarSinAsignar();
                  }}
                />
                <span className="truncate text-muted-foreground">Sin asignar</span>
              </label>
            )}

            {(mostrarTodos || mostrarSinAsignar) && opcionesFiltradas.length > 0 && (
              <div className="my-1 border-t border-muted-foreground/30" />
            )}

            {opcionesLimpias.length === 0 && !q ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {vacioMensaje}
              </p>
            ) : sinResultados ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Sin resultados.
              </p>
            ) : (
              opcionesFiltradas.map((o) => {
                const marcado = seleccionValida.includes(o.valor);
                return (
                  <label
                    key={o.valor}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border-2 border-muted-foreground/35 bg-muted/50 px-2.5 py-2 text-xs shadow-sm shadow-black/20",
                      "hover:border-teal-500/45 hover:bg-accent hover:text-accent-foreground",
                      marcado && "border-teal-500/55 bg-teal-950/40",
                    )}
                  >
                    <Checkbox
                      checked={marcado}
                      className="size-3.5"
                      onCheckedChange={() => toggleOpcion(o.valor)}
                    />
                    {o.indicador}
                    <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {mostrarChips && seleccionValida.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {seleccionValida.map((id) => {
            const o = porValor.get(id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="h-5 gap-0.5 px-1.5 pr-0.5 text-[10px] font-normal"
              >
                {o?.indicador}
                <span className="max-w-36 truncate">{o?.etiqueta ?? id}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-background/80"
                    onClick={() => toggleOpcion(id)}
                    aria-label={`Quitar ${o?.etiqueta ?? id}`}
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
