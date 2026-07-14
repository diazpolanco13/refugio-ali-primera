// Barra segmentada del reporte diario (6 fases): reemplaza los 4 íconos que
// no reflejaban el estado real. Mismo dato que el aro de la baliza del mapa
// (`useEstadoReporteHoy`) — cada segmento es una fase (Parte · Salud ·
// Control · Trabajos · Requerimientos · Novedades). No es "verificado": cada
// fase solo prueba que el operador la guardó/confirmó hoy, no que cambió un
// dato real ("confirmar sin cambios" también cuenta).

import {
  fasesCompletadasHoy,
  TOTAL_FASES_REPORTE_DIA,
  useEstadoReporteHoy,
  type EstadoReporteHoyCentro,
} from "@/data/useEstadoReporteHoy";
import { cn } from "@/lib/utils";

const FASES: { clave: keyof EstadoReporteHoyCentro; etiqueta: string }[] = [
  { clave: "parte_ok", etiqueta: "Parte" },
  { clave: "salud_ok", etiqueta: "Salud" },
  { clave: "control_ok", etiqueta: "Control" },
  { clave: "trabajos_ok", etiqueta: "Trabajos" },
  { clave: "requerimientos_ok", etiqueta: "Requerimientos" },
  { clave: "novedades_ok", etiqueta: "Novedades" },
];

export function BarraReporteDiarioMini({
  centroId,
  className,
}: {
  centroId: string;
  className?: string;
}) {
  const estados = useEstadoReporteHoy(centroId);
  const estado = estados.get(centroId);
  const completas = fasesCompletadasHoy(estado);
  const completo = completas === TOTAL_FASES_REPORTE_DIA;

  const detalle =
    completas <= 0
      ? "No iniciado"
      : completo
        ? "Completo"
        : `${completas}/${TOTAL_FASES_REPORTE_DIA}`;
  const detalleClase = completo
    ? "text-emerald-400"
    : completas > 0
      ? "text-sky-400"
      : "text-muted-foreground";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="shrink-0 text-muted-foreground">Reporte diario</span>
        <span className={cn("tabular-nums font-medium", detalleClase)}>{detalle}</span>
      </div>
      <div className="flex gap-0.5" role="img" aria-label={`Reporte diario: ${detalle}`}>
        {FASES.map((fase) => {
          const ok = estado?.[fase.clave] === true;
          return (
            <span
              key={fase.clave}
              title={`${fase.etiqueta} · ${ok ? "abierta hoy" : "pendiente"}`}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                ok ? (completo ? "bg-emerald-500" : "bg-sky-400") : "bg-muted/80",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
