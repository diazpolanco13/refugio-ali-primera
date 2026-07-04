// Calendario mensual de la red de centros: cada día con incidencias muestra un
// punto del color de la **severidad máxima** registrada ese día (todos los
// centros o los que pasen los filtros activos). Clic en un día filtra la lista
// a ese día; clic en el día ya seleccionado quita el filtro.

import type { ComponentProps } from "react";
import type { DayButton } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { claveDia } from "@/data/reposSupabase";
import { META_ETIQUETA, type EtiquetaIncidencia } from "@/domain/incidencias";

interface Props {
  /** YYYY-MM-DD → etiqueta más grave del día (de `severidadMaximaPorDia`). */
  severidadPorDia: Map<string, EtiquetaIncidencia>;
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

  // Botón de día con el punto de severidad superpuesto. El punto no altera el
  // layout (posición absoluta) y fuerza opacity 1 porque el botón atenúa los
  // spans hijos por defecto.
  function DiaConPunto(props: ComponentProps<typeof DayButton>) {
    const sev = severidadPorDia.get(claveDia(props.day.date.getTime()));
    return (
      <CalendarDayButton {...props} locale={es}>
        {props.children}
        {sev && (
          <span
            aria-label={`Incidencias: ${META_ETIQUETA[sev].label}`}
            className="absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
            style={{ backgroundColor: META_ETIQUETA[sev].color, opacity: 1 }}
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
