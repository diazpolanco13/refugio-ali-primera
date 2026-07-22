// UI compartida de listas en Seguimiento (Salud / Trabajos / Novedades):
// agrupación por día, encabezado de fecha y tamaño de página.

import { CalendarDays } from "lucide-react";
import { formatearDiaVisorReporte } from "./VisorFechaReporte";

export const SEGUIMIENTO_ITEMS_POR_PAGINA = 5;

export function agruparPorDiaCampo<T>(
  items: T[],
  diaDe: (item: T) => string,
): { dia: string; items: T[] }[] {
  const grupos: { dia: string; items: T[] }[] = [];
  for (const item of items) {
    const dia = diaDe(item);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.items.push(item);
    else grupos.push({ dia, items: [item] });
  }
  return grupos;
}

export function EncabezadoDiaSeguimiento({
  dia,
  cantidad,
  hoyClave,
}: {
  dia: string;
  cantidad: number;
  hoyClave?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {formatearDiaVisorReporte(dia)}
        {hoyClave && dia === hoyClave ? " · hoy" : ""}
        <span className="ml-1.5 font-normal normal-case tabular-nums">({cantidad})</span>
      </p>
    </div>
  );
}
