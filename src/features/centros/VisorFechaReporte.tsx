// Visor de fecha con flechas y calendario emergente para el reporte diario.

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CalendarioSelectorDia,
  type LeyendaCalendario,
} from "./CalendarioSelectorDia";

interface Props {
  dia: string;
  onDiaChange: (dia: string) => void;
  /** Si se indica, no se puede avanzar más allá de hoy. */
  hoyClave?: string;
  marcasPorDia?: Map<string, string>;
  leyenda?: LeyendaCalendario[];
  compacto?: boolean;
  className?: string;
}

function parsearDiaLocal(dia: string): Date {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function moverDia(dia: string, offset: number): string {
  const fecha = parsearDiaLocal(dia);
  fecha.setDate(fecha.getDate() + offset);
  return claveDia(fecha.getTime());
}

/** Formato visible: 07 JUL 2026 */
export function formatearDiaVisorReporte(dia: string): string {
  const fecha = parsearDiaLocal(dia);
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mmm = fecha
    .toLocaleDateString("es-VE", { month: "short" })
    .replace(/\./g, "")
    .toUpperCase();
  const yyyy = fecha.getFullYear();
  return `${dd} ${mmm} ${yyyy}`;
}

export function VisorFechaReporte({
  dia,
  onDiaChange,
  hoyClave,
  marcasPorDia = new Map(),
  leyenda = [],
  compacto = false,
  className,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const esHoy = hoyClave != null && dia === hoyClave;
  const enHoy = hoyClave != null && dia >= hoyClave;

  function seleccionarDia(nuevoDia: string | null) {
    if (!nuevoDia) return;
    if (hoyClave && nuevoDia > hoyClave) return;
    onDiaChange(nuevoDia);
    setAbierto(false);
  }

  function irAnterior() {
    onDiaChange(moverDia(dia, -1));
  }

  function irSiguiente() {
    if (enHoy) return;
    const siguiente = moverDia(dia, 1);
    onDiaChange(hoyClave && siguiente > hoyClave ? hoyClave : siguiente);
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden rounded-lg border bg-card/70",
        compacto ? "h-7" : "h-8",
        esHoy
          ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
          : "border-border/60",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn(
          "h-full shrink-0 rounded-none border-r border-border/60",
          compacto && "size-7",
        )}
        title="Día anterior"
        aria-label="Día anterior"
        onClick={irAnterior}
      >
        <ChevronLeft className={compacto ? "size-3" : "size-3.5"} />
      </Button>

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-full min-w-0 flex-1 gap-1.5 rounded-none px-2 font-semibold tracking-wide tabular-nums hover:bg-muted/40",
              compacto ? "text-[10px] sm:text-xs" : "text-xs",
              esHoy && "text-emerald-400 hover:bg-emerald-500/10",
            )}
            aria-label={`Fecha del reporte: ${formatearDiaVisorReporte(dia)}${esHoy ? " (hoy)" : ""}`}
          >
            {esHoy && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-emerald-400"
                aria-hidden
              />
            )}
            {formatearDiaVisorReporte(dia)}
            {esHoy && (
              <span className="text-[9px] font-medium uppercase tracking-wider opacity-80">
                Hoy
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[260px] overflow-hidden p-0">
          <CalendarioSelectorDia
            embebido
            diaSeleccionado={dia}
            onSeleccionarDia={seleccionarDia}
            marcasPorDia={marcasPorDia}
            leyenda={leyenda}
            titulo="Seleccionar día"
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn(
          "h-full shrink-0 rounded-none border-l border-border/60",
          compacto && "size-7",
        )}
        title="Día siguiente"
        aria-label="Día siguiente"
        disabled={enHoy}
        onClick={irSiguiente}
      >
        <ChevronRight className={compacto ? "size-3" : "size-3.5"} />
      </Button>
    </div>
  );
}
