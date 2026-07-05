// Calendario compacto reutilizable: puntos de color por día, selección y cierre.

import { es } from "date-fns/locale";
import type { DayButton } from "react-day-picker";
import { CalendarDays, PanelLeftClose } from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LeyendaCalendario {
  color: string;
  label: string;
}

interface Props {
  diaSeleccionado: string | null;
  onSeleccionarDia: (dia: string | null) => void;
  /** Día (YYYY-MM-DD) → color del punto inferior. Sin entrada = sin punto. */
  marcasPorDia: Map<string, string>;
  leyenda: LeyendaCalendario[];
  onCerrar?: () => void;
  titulo?: string;
  /** Sin Card propio: pensado para incrustar dentro de otro contenedor. */
  embebido?: boolean;
}

function parsearDiaLocal(dia: string): Date {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function CalendarioSelectorDia({
  diaSeleccionado,
  onSeleccionarDia,
  marcasPorDia,
  leyenda,
  onCerrar,
  titulo = "Calendario",
  embebido = false,
}: Props) {
  const hoyClave = claveDia(Date.now());
  const selected = diaSeleccionado ? parsearDiaLocal(diaSeleccionado) : undefined;

  const contenido = (
    <>
      <CardHeader className="flex flex-row items-center gap-1 space-y-0 px-3 py-2">
        <CardTitle className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold">
          <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{titulo}</span>
        </CardTitle>
        {onCerrar && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            title="Ocultar calendario"
            onClick={onCerrar}
          >
            <PanelLeftClose className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-1.5 px-3 pb-2 pt-0">
        <div className="flex justify-center rounded-md border border-border/60 bg-muted/15 p-0.5">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onSeleccionarDia(date ? claveDia(date.getTime()) : null)}
            locale={es}
            defaultMonth={selected ?? new Date()}
            className="[--cell-size:--spacing(5)] p-0 text-[10px]"
            components={{
              DayButton: ({ children, ...props }: React.ComponentProps<typeof DayButton>) => {
                const clave = claveDia(props.day.date.getTime());
                const color = marcasPorDia.get(clave);
                const esHoy = clave === hoyClave;
                return (
                  <CalendarDayButton
                    {...props}
                    className={cn(props.className, esHoy && "font-bold ring-1 ring-primary/40")}
                  >
                    {children}
                    {color && (
                      <span
                        aria-hidden
                        className="absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
                        style={{ background: color }}
                      />
                    )}
                  </CalendarDayButton>
                );
              },
            }}
          />
        </div>
        {leyenda.length > 0 && (
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[8px] leading-tight text-muted-foreground">
            {leyenda.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </>
  );

  if (embebido) {
    return <div className="flex flex-col">{contenido}</div>;
  }

  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      {contenido}
    </Card>
  );
}

/** Formato corto DD-MM para botones y etiquetas. */
export function formatearDiaCalendario(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}
