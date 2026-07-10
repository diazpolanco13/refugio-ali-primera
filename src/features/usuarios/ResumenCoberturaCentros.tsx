import { AlertTriangle, BadgeCheck, Building2, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CoberturaCentros } from "./coberturaCentros";

type Props = {
  cobertura: CoberturaCentros;
  cargando?: boolean;
  className?: string;
};

function KpiCard({
  titulo,
  valor,
  icono: Icono,
  cargando,
}: {
  titulo: string;
  valor: number;
  icono: LucideIcon;
  cargando?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{titulo}</p>
          {cargando ? (
            <Skeleton className="mt-1 h-7 w-12" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {valor}
            </p>
          )}
        </div>
        <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  );
}

/** Tres KPIs de cobertura de la red: total, asignados y sin asignar. */
export function ResumenCoberturaCentros({
  cobertura,
  cargando,
  className,
}: Props) {
  return (
    <section
      aria-label="Cobertura de centros"
      className={cn("grid gap-3 sm:grid-cols-3", className)}
    >
      <KpiCard
        titulo="Centros"
        valor={cobertura.total}
        icono={Building2}
        cargando={cargando}
      />
      <KpiCard
        titulo="Asignados"
        valor={cobertura.asignados}
        icono={BadgeCheck}
        cargando={cargando}
      />
      <KpiCard
        titulo="Sin asignar"
        valor={cobertura.sinAsignar}
        icono={AlertTriangle}
        cargando={cargando}
      />
    </section>
  );
}
