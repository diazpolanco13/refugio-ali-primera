// Feed de novedades en vivo para la sala situacional: mezcla los casos de
// salud PENDIENTES de toda la red (activos primero) con los eventos del día
// (positivos/negativos del reporte diario). Se actualiza solo vía Realtime
// (los hooks los provee el padre; este componente es presentacional).

import { ArrowDownRight, ArrowUpRight, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  META_ESTATUS_CASO_SALUD,
  type CasoSaludCentro,
} from "@/domain/casosSalud";
import {
  META_TIPO_EVENTO_REPORTE,
  type EventoReporte,
} from "@/domain/eventosReportes";

interface Props {
  /** Casos de salud pendientes (activo/en proceso) de toda la red. */
  casos: CasoSaludCentro[];
  /** Eventos del día (todos los campamentos). */
  eventos: EventoReporte[];
  /** id del centro → etiqueta legible ("N.° 3 · UEN Gran Colombia"). */
  nombresCentros: Map<string, string>;
  /** YYYY-MM-DD de hoy, para decidir si mostrar la fecha además de la hora. */
  hoy: string;
}

function horaDe(ts: number, dia: string, hoy: string): string {
  const hora =
    ts > 0
      ? new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
      : "";
  if (!dia || dia === hoy) return hora;
  const [, m, d] = dia.split("-");
  return `${d}-${m}${hora ? ` · ${hora}` : ""}`;
}

export function NovedadesEnVivo({ casos, eventos, nombresCentros, hoy }: Props) {
  // Activos primero (orden 0 < 1), luego los más recientes.
  const casosOrdenados = [...casos].sort(
    (a, b) =>
      META_ESTATUS_CASO_SALUD[a.estatus].orden -
        META_ESTATUS_CASO_SALUD[b.estatus].orden || b.creada_ts - a.creada_ts,
  );
  const eventosDesc = [...eventos].sort((a, b) => b.ts - a.ts);

  if (casosOrdenados.length === 0 && eventosDesc.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin novedades: no hay casos de salud pendientes ni eventos reportados hoy.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {casosOrdenados.map((caso) => {
        const meta = META_ESTATUS_CASO_SALUD[caso.estatus];
        return (
          <div
            key={`caso-${caso.id}`}
            className="rounded-lg border border-border bg-card/60 px-2.5 py-2"
            style={{ borderLeft: `3px solid ${meta.color}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-foreground">
                <HeartPulse className="size-3.5 shrink-0" style={{ color: meta.color }} />
                <span className="truncate">
                  {nombresCentros.get(caso.centro_id) ?? caso.centro_id}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[10px]"
                  style={{ borderColor: `${meta.color}66`, color: meta.color }}
                >
                  {meta.label}
                </Badge>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {horaDe(caso.creada_ts, caso.reportado_dia, hoy)}
                </span>
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">
                {caso.titulo || "Caso de salud"}
              </span>
              {caso.descripcion ? ` — ${caso.descripcion}` : ""}
            </p>
          </div>
        );
      })}

      {eventosDesc.map((ev) => {
        const meta = META_TIPO_EVENTO_REPORTE[ev.tipo];
        const Icono = ev.tipo === "positivo" ? ArrowUpRight : ArrowDownRight;
        return (
          <div
            key={`ev-${ev.id}`}
            className="rounded-lg border border-border bg-card/60 px-2.5 py-2"
            style={{ borderLeft: `3px solid ${meta.color}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-foreground">
                <Icono className="size-3.5 shrink-0" style={{ color: meta.color }} />
                <span className="truncate">
                  {nombresCentros.get(ev.centro_id) ?? ev.centro_id}
                </span>
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {horaDe(ev.ts, ev.dia, hoy)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">{ev.titulo}</span>
              {ev.descripcion ? ` — ${ev.descripcion}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
