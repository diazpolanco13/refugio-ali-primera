import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { claveDia } from "@/data/reposSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  casosSaludPendientes,
  severidadMaximaPorDiaSeguimiento,
} from "@/domain/seguimientoReportes";
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
import { cn } from "@/lib/utils";
import { CalendarioIncidencias } from "./CalendarioIncidencias";
import { ListaSeguimientoReportes, type ItemSeguimiento } from "./ListaSeguimientoReportes";

type FiltroTipo = "todos" | "salud" | "novedades";
type FiltroEstatus = "todos" | "activos" | "archivados";

/** Calendario, filtros y análisis global de salud y novedades del reporte. */
export function IncidenciasAnaliticaView() {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => {
    const [y, m, d] = hoy.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 60);
    return claveDia(dt.getTime());
  }, [hoy]);

  const casos = useCasosSaludCentros();
  const eventos = useEventosReportes({ desde });
  const snapshots = useOcupacionesCentros({ desde });

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
  const [estatus, setEstatus] = useState<FiltroEstatus>("todos");
  const [dia, setDia] = useState<string | null>(null);

  const hayFiltros =
    tipo !== "todos" || centroId !== "todos" || estatus !== "todos" || dia !== null;

  function limpiarFiltros() {
    setTipo("todos");
    setCentroId("todos");
    setEstatus("todos");
    setDia(null);
  }

  const filtradosBase = useMemo(() => {
    let casosFiltrados = casos;
    if (centroId !== "todos") casosFiltrados = casosFiltrados.filter((c) => c.centro_id === centroId);
    if (estatus === "activos") {
      casosFiltrados = casosFiltrados.filter((c) => c.estatus !== "archivado");
    } else if (estatus === "archivados") {
      casosFiltrados = casosFiltrados.filter((c) => c.estatus === "archivado");
    }

    let eventosFiltrados = eventos;
    if (centroId !== "todos") {
      eventosFiltrados = eventosFiltrados.filter((e) => e.centro_id === centroId);
    }

    return { casos: casosFiltrados, eventos: eventosFiltrados };
  }, [casos, eventos, centroId, estatus]);

  const snapshotsFiltrados = useMemo(() => {
    if (centroId === "todos") return snapshots;
    return snapshots.filter((s) => s.centro_id === centroId);
  }, [snapshots, centroId]);

  const severidadPorDia = useMemo(
    () => severidadMaximaPorDiaSeguimiento(snapshotsFiltrados, filtradosBase.eventos),
    [snapshotsFiltrados, filtradosBase.eventos],
  );

  const visibles = useMemo((): ItemSeguimiento[] => {
    const items: ItemSeguimiento[] = [];

    if (tipo === "todos" || tipo === "salud") {
      for (const c of filtradosBase.casos) {
        if (dia && c.reportado_dia !== dia) continue;
        items.push({ tipo: "salud", item: c });
      }
    }
    if (tipo === "todos" || tipo === "novedades") {
      for (const e of filtradosBase.eventos) {
        if (dia && e.dia !== dia) continue;
        items.push({ tipo: "novedad", item: e });
      }
    }

    return items.sort((a, b) => {
      const diaA = a.tipo === "salud" ? a.item.reportado_dia : a.item.dia;
      const diaB = b.tipo === "salud" ? b.item.reportado_dia : b.item.dia;
      if (diaA !== diaB) return diaB.localeCompare(diaA);
      const tsA = a.tipo === "salud" ? a.item.creada_ts : a.item.ts;
      const tsB = b.tipo === "salud" ? b.item.creada_ts : b.item.ts;
      return tsB - tsA;
    });
  }, [tipo, dia, filtradosBase]);

  const conteoPorTipo = useMemo(() => {
    const salud = filtradosBase.casos.length;
    const novedades = filtradosBase.eventos.length;
    const negativas = filtradosBase.eventos.filter((e) => e.tipo === "negativo").length;
    const activos = casosSaludPendientes(filtradosBase.casos).length;
    return { salud, novedades, negativas, activos };
  }, [filtradosBase]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Calendario de la red</CardTitle>
              <CardDescription>
                Punto de color = actividad del día (salud o novedades). Clic para filtrar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarioIncidencias
                severidadPorDia={severidadPorDia}
                diaSeleccionado={dia}
                onSeleccionarDia={setDia}
              />
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  Salud / negativa
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Solo positivas
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CampoFiltro label="Tipo">
                <Select value={tipo} onValueChange={(v) => setTipo(v as FiltroTipo)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Salud + novedades</SelectItem>
                    <SelectItem value="salud">Solo salud</SelectItem>
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

              <CampoFiltro label="Estatus salud">
                <Select value={estatus} onValueChange={(v) => setEstatus(v as FiltroEstatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activos">En seguimiento</SelectItem>
                    <SelectItem value="archivados">Archivados</SelectItem>
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen</CardTitle>
              <CardDescription>En el rango visible</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Casos salud", valor: conteoPorTipo.salud },
                { label: "Salud activa", valor: conteoPorTipo.activos },
                { label: "Novedades", valor: conteoPorTipo.novedades },
                { label: "Negativas", valor: conteoPorTipo.negativas },
              ].map(({ label, valor }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <span className="truncate text-muted-foreground">{label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{valor}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base lg:text-lg">
                    Registros del reporte
                    {dia && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">del {dia}</span>
                    )}
                  </CardTitle>
                  <CardDescription>Incidencias de salud y novedades diarias</CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="tabular-nums">
                    {visibles.length} visible(s)
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "tabular-nums",
                      conteoPorTipo.activos > 0 && "border-amber-500/40 text-amber-400",
                    )}
                  >
                    {conteoPorTipo.activos} salud activa(s)
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ListaSeguimientoReportes items={visibles} centrosPorId={centrosPorId} />
            </CardContent>
          </Card>
        </div>
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
