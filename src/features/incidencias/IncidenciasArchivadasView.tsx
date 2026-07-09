import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListaSeguimientoReportes, type ItemSeguimiento } from "./ListaSeguimientoReportes";

type FiltroTipo = "todos" | "salud" | "novedades";

/** Histórico archivado: casos de salud cerrados y novedades pasadas. */
export function IncidenciasArchivadasView() {
  const casos = useCasosSaludCentros();
  const eventos = useEventosReportes();

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const centrosPorId = useMemo(
    () => new Map<string, CentroTransitorio>(centros.map((c) => [c.id, c])),
    [centros],
  );

  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [centroId, setCentroId] = useState<string>("todos");

  const hayFiltros = tipo !== "todos" || centroId !== "todos";

  function limpiarFiltros() {
    setTipo("todos");
    setCentroId("todos");
  }

  const casosArchivados = useMemo(
    () => casos.filter((c) => c.estatus === "archivado"),
    [casos],
  );

  const visibles = useMemo((): ItemSeguimiento[] => {
    const items: ItemSeguimiento[] = [];

    if (tipo === "todos" || tipo === "salud") {
      for (const c of casosArchivados) {
        if (centroId !== "todos" && c.centro_id !== centroId) continue;
        items.push({ tipo: "salud", item: c });
      }
    }
    if (tipo === "todos" || tipo === "novedades") {
      for (const e of eventos) {
        if (centroId !== "todos" && e.centro_id !== centroId) continue;
        items.push({ tipo: "novedad", item: e });
      }
    }

    return items.sort((a, b) => {
      const diaA = a.tipo === "salud" ? a.item.reportado_dia : a.item.dia;
      const diaB = b.tipo === "salud" ? b.item.reportado_dia : b.item.dia;
      return diaB.localeCompare(diaA);
    });
  }, [tipo, centroId, casosArchivados, eventos]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>Casos archivados y novedades históricas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CampoFiltro label="Tipo">
              <Select value={tipo} onValueChange={(v) => setTipo(v as FiltroTipo)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Salud archivada + novedades</SelectItem>
                  <SelectItem value="salud">Solo salud archivada</SelectItem>
                  <SelectItem value="novedades">Solo novedades</SelectItem>
                </SelectContent>
              </Select>
            </CampoFiltro>

            <CampoFiltro label="Campamento">
              <Select value={centroId} onValueChange={setCentroId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="todos">Todos los campamentos</SelectItem>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      N.° {c.nro} · {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoFiltro>

            {hayFiltros && (
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={limpiarFiltros}>
                <FilterX className="size-3.5" />
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base lg:text-lg">Histórico</CardTitle>
                <CardDescription>
                  Casos de salud archivados y novedades registradas en reportes
                </CardDescription>
              </div>
              <Badge variant="outline" className="tabular-nums">
                {visibles.length} registro(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ListaSeguimientoReportes items={visibles} centrosPorId={centrosPorId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CampoFiltro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
