import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  metaCuerpoDe,
  normalizarCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  centros: CentroTransitorio[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
}

type Orden = "cupo" | "lleno" | "ocupados" | "nombre";

/**
 * Tablero comparativo de todos los centros: ocupación vs capacidad, % lleno,
 * cupo real y cuello de botella. Pensado para decidir a dónde reubicar
 * refugiados (por defecto ordena por cupo real: primero los que más pueden
 * recibir).
 */
export function TableroCentros({ centros, seleccionado, onSeleccionar }: Props) {
  const [orden, setOrden] = useState<Orden>("cupo");

  const filas = useMemo(() => {
    const arr = centros.map((c) => ({ centro: c, analisis: analisisCentro(c) }));
    arr.sort((a, b) => {
      switch (orden) {
        case "cupo":
          return (b.analisis.cupoReal ?? -1) - (a.analisis.cupoReal ?? -1);
        case "lleno":
          return (b.analisis.porcentajeOcupacion ?? -1) - (a.analisis.porcentajeOcupacion ?? -1);
        case "ocupados":
          return b.analisis.ocupados - a.analisis.ocupados;
        case "nombre":
          return a.centro.nombre.localeCompare(b.centro.nombre, "es");
      }
    });
    return arr;
  }, [centros, orden]);

  const totales = useMemo(() => {
    let ocupados = 0;
    let cupo = 0;
    let conCupo = 0;
    for (const { analisis } of filas) {
      ocupados += analisis.ocupados;
      if (analisis.cupoReal != null) {
        cupo += analisis.cupoReal;
        if (analisis.cupoReal > 0) conCupo++;
      }
    }
    return { ocupados, cupo, conCupo, total: filas.length };
  }, [filas]);

  const ordenes: { valor: Orden; label: string }[] = [
    { valor: "cupo", label: "Cupo real" },
    { valor: "lleno", label: "% lleno" },
    { valor: "ocupados", label: "Alojados" },
    { valor: "nombre", label: "Nombre" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Resumen */}
      <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-border bg-card/40 px-3 py-2.5 sm:px-4">
        <Resumen etiqueta="Alojados (total)" valor={totales.ocupados} />
        <Resumen etiqueta="Cupo real (total)" valor={totales.cupo} clase="text-emerald-400" />
        <Resumen etiqueta="Centros con cupo" valor={`${totales.conCupo}/${totales.total}`} />
      </div>

      {/* Orden */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2 sm:px-4">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpDown className="size-3" />
          Ordenar:
        </span>
        {ordenes.map((o) => (
          <Button
            key={o.valor}
            size="xs"
            variant={orden === o.valor ? "secondary" : "outline"}
            className="h-6 px-2 text-[11px]"
            onClick={() => setOrden(o.valor)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
        <div className="space-y-1.5">
          {filas.map(({ centro, analisis }) => {
            const c = normalizarCentro(centro);
            const meta = metaCuerpoDe(centro.cuerpo);
            const color = COLOR_SEMAFORO[analisis.semaforo];
            return (
              <button
                key={centro.id}
                onClick={() => onSeleccionar(centro.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-muted/50",
                  seleccionado === centro.id ? "border-primary/50 bg-primary/5" : "border-border",
                )}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white text-[11px]"
                  style={{ borderColor: meta.color }}
                >
                  {meta.logo ? (
                    <img src={meta.logo} alt="" className="size-full object-cover" />
                  ) : (
                    meta.icono
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{centro.nombre}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {c.ocupacion && analisis.ocupados > 0
                      ? `${analisis.ocupados.toLocaleString("es")} alojados`
                      : "Sin ocupación"}
                    {analisis.capacidadEfectiva != null &&
                      ` · cap. ${analisis.capacidadEfectiva.toLocaleString("es")}`}
                    {analisis.cuelloBotella && ` · límite: ${analisis.cuelloBotella.label}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-bold" style={{ color }}>
                    {analisis.cupoReal != null ? `+${analisis.cupoReal.toLocaleString("es")}` : "—"}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px]"
                    style={{ borderColor: `${color}66`, color }}
                  >
                    {analisis.porcentajeOcupacion != null
                      ? `${Math.min(999, analisis.porcentajeOcupacion)}%`
                      : "s/d"}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
  clase,
}: {
  etiqueta: string;
  valor: number | string;
  clase?: string;
}) {
  return (
    <div className="text-center">
      <div className={cn("text-lg font-bold tabular-nums text-foreground", clase)}>
        {typeof valor === "number" ? valor.toLocaleString("es") : valor}
      </div>
      <div className="text-[10px] leading-tight text-muted-foreground">{etiqueta}</div>
    </div>
  );
}
