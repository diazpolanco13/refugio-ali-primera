// Calendario mensual de la red: cada día con actividad muestra un punto de
// color (salud, novedades negativas o positivas). Clic filtra la lista.

import type { ComponentProps } from "react";
import type { DayButton } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { claveDia } from "@/data/reposSupabase";

interface Props {
  /** YYYY-MM-DD → color hex del día (p. ej. de `severidadMaximaPorDiaSeguimiento`). */
  severidadPorDia: Map<string, string>;
  /** Día seleccionado (YYYY-MM-DD) o null si no hay filtro por día. */
  diaSeleccionado: string | null;
  onSeleccionarDia: (dia: string | null) => void;
}

/** Convierte "YYYY-MM-DD" a Date local (sin desfase de zona horaria). */
function parsearDiaLocal(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function CalendarioIncidencias({
  severidadPorDia,
  diaSeleccionado,
  onSeleccionarDia,
}: Props) {
  const seleccionado = diaSeleccionado ? parsearDiaLocal(diaSeleccionado) : undefined;

  function DiaConPunto(props: ComponentProps<typeof DayButton>) {
    const color = severidadPorDia.get(claveDia(props.day.date.getTime()));
    return (
      <CalendarDayButton {...props} locale={es}>
        {props.children}
        {color && (
          <span
            aria-label="Actividad del día"
            className="absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
            style={{ backgroundColor: color, opacity: 1 }}
          />
        )}
      </CalendarDayButton>
    );
  }

  return (
    <Calendar
      mode="single"
      locale={es}
      selected={seleccionado}
      defaultMonth={seleccionado}
      onSelect={(date) => onSeleccionarDia(date ? claveDia(date.getTime()) : null)}
      className="mx-auto"
      components={{ DayButton: DiaConPunto }}
    />
  );
}
