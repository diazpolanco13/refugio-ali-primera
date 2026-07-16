import { Baby, FileWarning, Gift, HeartPulse, Home, ShieldAlert, UserRound, Users } from "lucide-react";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function KpiShell({ titulo, icono: Icono }: { titulo: string; icono: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div>
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <p className="text-2xl font-semibold tabular-nums">0</p>
        </div>
        <Icono className="size-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

/**
 * Fallback Suspense de `/centros/refugiados`: shell real + skeleton solo en la tabla.
 */
export function RefugiadosRedSkeleton() {
  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      marcoClassName="flex min-h-0 flex-col"
    >
      <VistaEncabezado
        icono={Users}
        acento="violet"
        titulo="Población (red)"
        descripcion="Censo nominal activo en todos los campamentos visibles"
        acciones={
          <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled>
            <Gift className="size-3.5" />
            Dotaciones pendientes
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            <KpiShell titulo="Total visible" icono={Users} />
            <KpiShell titulo="Familias" icono={Home} />
            <KpiShell titulo="Adultos" icono={UserRound} />
            <KpiShell titulo="Niños" icono={Baby} />
            <KpiShell titulo="Adolescentes" icono={ShieldAlert} />
            <KpiShell titulo="Adultos mayores" icono={Users} />
            <KpiShell titulo="Embarazadas" icono={HeartPulse} />
            <KpiShell titulo="Discapacidad" icono={HeartPulse} />
            <KpiShell titulo="Doc. pendiente" icono={FileWarning} />
          </div>

          <Card>
            <CardContent className="grid gap-3 pt-4 lg:grid-cols-12" aria-hidden>
              <Skeleton className="h-9 w-full lg:col-span-3" />
              <Skeleton className="h-9 w-full lg:col-span-2" />
              <Skeleton className="h-9 w-full lg:col-span-2" />
              <Skeleton className="h-9 w-full lg:col-span-2" />
              <Skeleton className="h-9 w-full lg:col-span-2" />
              <Skeleton className="h-9 w-full lg:col-span-1" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Personas alojadas</CardTitle>
              <CardDescription>Cargando perfiles…</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Persona</TableHead>
                      <TableHead>Edad / perfil</TableHead>
                      <TableHead>Familia</TableHead>
                      <TableHead>Vulnerabilidad</TableHead>
                      <TableHead>Campamento</TableHead>
                      <TableHead>Ingreso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }, (_, i) => (
                      <TableRow key={i} aria-hidden>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-36" />
                            <Skeleton className="h-2.5 w-24" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3 w-20" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarcoVista>
  );
}
