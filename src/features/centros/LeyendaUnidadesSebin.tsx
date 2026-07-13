import { useState } from "react";
import { Building2, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCatalogoUnidadesSebinActivas } from "@/data/useUnidadesSebin";
import type { ClaveUnidadSebin } from "@/domain/centrosTransitorios";
import type { MetaUnidadSebin } from "@/domain/unidadesSebin";

const TITULO = "Unidades responsables";

interface Props {
  unidadesPresentes: Set<ClaveUnidadSebin>;
  unidadesFiltro: ReadonlySet<ClaveUnidadSebin>;
  onAlternarUnidad: (clave: ClaveUnidadSebin) => void;
  onLimpiarFiltro: () => void;
  /** Oculta el panel y sincroniza el switch de «Vista del mapa». */
  onMinimizar?: () => void;
  className?: string;
}

/** Leyenda / filtro por unidades responsables SEBIN (multi-selección). */
export function LeyendaUnidadesSebin({
  unidadesPresentes,
  unidadesFiltro,
  onAlternarUnidad,
  onLimpiarFiltro,
  onMinimizar,
  className,
}: Props) {
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const catalogo = useCatalogoUnidadesSebinActivas();
  const items = catalogo.filter(
    (u) => u.clave !== "sin_asignar" && unidadesPresentes.has(u.clave),
  );

  if (items.length === 0) return null;

  const hayFiltro = unidadesFiltro.size > 0;
  const seleccionadas = items.filter((u) => unidadesFiltro.has(u.clave));
  const resumenFiltro =
    seleccionadas.length === 0
      ? null
      : seleccionadas.length === 1
        ? seleccionadas[0]!.label
        : `${seleccionadas.length} unidades`;

  return (
    <>
      {/* Desktop: panel fijo abajo a la izquierda */}
      <div
        className={cn(
          "map-controls-overlay pointer-events-auto absolute bottom-3 left-3 z-10 hidden w-[min(12.5rem,calc(100%-1.5rem))] rounded-xl border border-border bg-background/95 px-2.5 py-2 shadow-lg backdrop-blur-sm md:block",
          className,
        )}
        aria-label={TITULO}
      >
        <div className="mb-0.5 flex items-start justify-between gap-1 border-b border-border/60 pb-1">
          <p className="min-w-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {TITULO}
          </p>
          {onMinimizar && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    className="shrink-0"
                    onClick={onMinimizar}
                    aria-label="Minimizar unidades responsables"
                  >
                    <ChevronDown className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Minimizar
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="mb-1.5 text-[9px] leading-snug text-muted-foreground/80">
          Puede marcar varias
        </p>
        <ListaUnidades
          items={items}
          unidadesFiltro={unidadesFiltro}
          onAlternar={onAlternarUnidad}
          densa
        />
        {hayFiltro && (
          <button
            type="button"
            onClick={onLimpiarFiltro}
            className="mt-1.5 w-full rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Ver todas las unidades
          </button>
        )}
      </div>

      {/*
        Móvil: mismo lenguaje visual que lista/buscar (columna de iconos),
        no una pastilla de texto suelta sobre el mapa.
      */}
      <TooltipProvider delayDuration={200}>
        <div
          className={cn(
            "map-controls-overlay pointer-events-auto absolute left-3 top-[7.25rem] z-10 md:hidden",
            className,
          )}
        >
          <div className="flex w-10 min-w-10 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(
                    "relative h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-foreground shadow-none hover:bg-muted/80",
                    hayFiltro && "bg-primary/15 text-primary",
                  )}
                  onClick={() => setSheetAbierto(true)}
                  aria-label={
                    hayFiltro
                      ? `${TITULO}: ${resumenFiltro}. Abrir filtro`
                      : `Abrir filtro de ${TITULO.toLowerCase()}`
                  }
                >
                  <Building2 className="size-4" aria-hidden />
                  {hayFiltro && (
                    <Badge
                      variant="default"
                      className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[9px] tabular-nums"
                    >
                      {unidadesFiltro.size}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {hayFiltro ? resumenFiltro : TITULO}
              </TooltipContent>
            </Tooltip>

            {hayFiltro && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-muted-foreground shadow-none hover:bg-muted/80 hover:text-foreground"
                    onClick={onLimpiarFiltro}
                    aria-label="Quitar filtro de unidades responsables"
                  >
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Ver todas
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TooltipProvider>

      <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
        <SheetContent
          side="bottom"
          className="max-h-[min(70dvh,28rem)] gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <SheetHeader className="border-b border-border/60 pb-3">
            <SheetTitle>{TITULO}</SheetTitle>
            <SheetDescription>
              Marque una o varias unidades para filtrar los campamentos en el
              mapa.
            </SheetDescription>
          </SheetHeader>
          <div className="scrollbar-oculto min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <ListaUnidades
              items={items}
              unidadesFiltro={unidadesFiltro}
              onAlternar={onAlternarUnidad}
            />
          </div>
          {hayFiltro && (
            <div className="border-t border-border/60 px-4 pt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  onLimpiarFiltro();
                  setSheetAbierto(false);
                }}
              >
                Ver todas las unidades
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ListaUnidades({
  items,
  unidadesFiltro,
  onAlternar,
  densa = false,
}: {
  items: MetaUnidadSebin[];
  unidadesFiltro: ReadonlySet<ClaveUnidadSebin>;
  onAlternar: (clave: ClaveUnidadSebin) => void;
  densa?: boolean;
}) {
  const hayFiltro = unidadesFiltro.size > 0;
  return (
    <ul
      className={cn(
        "space-y-0.5",
        densa && "scrollbar-oculto max-h-[min(46vh,20rem)] overflow-y-auto",
      )}
      role="group"
      aria-label={TITULO}
    >
      {items.map((u) => {
        const activa = unidadesFiltro.has(u.clave);
        const atenuada = hayFiltro && !activa;
        const id = `leyenda-unidad-${u.clave}`;
        return (
          <li key={u.clave}>
            <label
              htmlFor={id}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-lg text-left transition-colors",
                densa
                  ? "rounded-md px-1.5 py-1 text-[11px] leading-snug"
                  : "min-h-11 px-3 py-2.5 text-sm",
                activa
                  ? "bg-primary/15 font-semibold text-primary"
                  : "text-foreground hover:bg-muted/60",
                atenuada && "opacity-45",
              )}
            >
              <Checkbox
                id={id}
                checked={activa}
                onCheckedChange={(v) => {
                  const quiere = v === true;
                  if (quiere !== activa) onAlternar(u.clave);
                }}
                aria-label={u.label}
                className={cn(densa ? "size-3.5" : "size-4", "shrink-0")}
              />
              <span
                className={cn(
                  "shrink-0 rounded-full border border-white/80",
                  densa ? "size-2.5" : "size-3",
                )}
                style={{ backgroundColor: u.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">{u.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
