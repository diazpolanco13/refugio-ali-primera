import type { ReactNode } from "react";
import {
  Droplets,
  Home,
  LayoutGrid,
  PawPrint,
  UserCog,
  Users,
  Utensils,
} from "lucide-react";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function KpiShell({
  icono,
  etiqueta,
  unidad,
  className,
}: {
  icono: ReactNode;
  etiqueta: string;
  unidad?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-2.5 py-2",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
          {etiqueta}
        </span>
        <span className="block text-sm font-bold tabular-nums leading-tight text-foreground sm:text-base">
          0{unidad ? <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{unidad}</span> : null}
        </span>
      </span>
    </div>
  );
}

/**
 * Fallback Suspense de `/centros/tablero`: encabezado y KPIs reales (en 0),
 * skeleton solo en la lista — mismo patrón que la carga de datos.
 */
export function TableroCampamentosSkeleton() {
  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col"
    >
      <VistaEncabezado
        icono={LayoutGrid}
        acento="sky"
        titulo="Campamentos"
        descripcion="Prioridad, capacidad y déficits logísticos · clic para abrir la ficha del centro"
        debajo={
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-5">
            <KpiShell icono={<LayoutGrid className="size-3.5 text-emerald-300" />} etiqueta="Campamentos" />
            <KpiShell icono={<Home className="size-3.5 text-orange-300" />} etiqueta="Familias" />
            <KpiShell icono={<Users className="size-3.5 text-sky-300" />} etiqueta="Damnificados" />
            <KpiShell icono={<UserCog className="size-3.5 text-violet-300" />} etiqueta="Funcionarios" />
            <KpiShell icono={<PawPrint className="size-3.5 text-amber-300" />} etiqueta="Mascotas" />
          </div>
        }
      />

      <div className="border-b border-border bg-muted/10 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
        <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
          <KpiShell
            icono={<Droplets className="size-3.5 text-cyan-300" />}
            etiqueta="Agua potable"
            unidad="L/día"
          />
          <KpiShell
            icono={<Droplets className="size-3.5 text-sky-300" />}
            etiqueta="Agua uso cotidiano"
            unidad="L/día"
          />
          <KpiShell
            icono={<Utensils className="size-3.5 text-amber-300" />}
            etiqueta="Comidas"
            unidad="/día"
          />
        </div>
        <div className="flex flex-wrap gap-2" aria-hidden>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-3 sm:px-4 sm:pt-4 lg:px-6">
        <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Lista de campamentos</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Ordenados por nivel de atención
            </p>
          </div>
        </div>
        <ul className="space-y-1.5 sm:space-y-2" aria-busy="true" aria-label="Cargando campamentos">
          {Array.from({ length: 8 }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/65 px-2.5 py-2 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3"
              aria-hidden
            >
              <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5" style={{ width: `${48 + ((i * 11) % 28)}%` }} />
                <Skeleton className="h-2.5" style={{ width: `${32 + ((i * 7) % 22)}%` }} />
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <Skeleton className="h-6 w-12 rounded-md" />
                <Skeleton className="h-6 w-12 rounded-md" />
                <Skeleton className="h-6 w-12 rounded-md" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </MarcoVista>
  );
}
