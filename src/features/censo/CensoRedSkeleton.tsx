import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VistaPagina } from "@/components/VistaPagina";
import { cn } from "@/lib/utils";
import { CensoRedTabs } from "./CensoRedTabs";

function KpiShell({
  etiqueta,
  icono: Icono,
  clase,
}: {
  etiqueta: string;
  icono: typeof Users;
  clase?: string;
}) {
  return (
    <Card size="sm" className="border-border/60 bg-card/70 py-2.5">
      <CardContent className="flex items-center gap-2.5 px-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            clase ?? "bg-primary/10 text-primary",
          )}
        >
          <Icono className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-medium text-muted-foreground">
            {etiqueta}
          </span>
          <span className="block text-lg font-bold tabular-nums leading-tight">0</span>
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * Fallback Suspense de `/centros/censo`: shell real + skeleton solo
 * en la grilla de escuelas.
 */
export function CensoRedSkeleton() {
  return (
    <VistaPagina
      icono={ClipboardList}
      acento="teal"
      titulo="Registro (red)"
      descripcion="Avance del registro nominal por escuela/campamento"
      cuerpoClassName="p-4 lg:p-6"
    >
      <div className="space-y-4">
        <CensoRedTabs />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <KpiShell
            etiqueta="Escuelas sin iniciar registro"
            icono={CircleDashed}
            clase="bg-muted text-muted-foreground"
          />
          <KpiShell etiqueta="Escuelas con registro activo" icono={ClipboardList} />
          <KpiShell etiqueta="Personas registradas (red)" icono={Users} />
          <KpiShell
            etiqueta="Escuelas con cierre declarado"
            icono={CheckCircle2}
            clase="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-hidden>
          <Skeleton className="h-8 w-48 max-w-full flex-1 sm:flex-none sm:max-w-xs" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-44" />
        </div>

        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Cargando escuelas del registro"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4"
              aria-hidden
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton
                    className="h-4"
                    style={{ width: `${55 + ((i * 9) % 30)}%` }}
                  />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-12 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </VistaPagina>
  );
}
