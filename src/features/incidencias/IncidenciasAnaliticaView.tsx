import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import { useIncidencias } from "@/data/useIncidencias";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_INCIDENCIA,
  ETIQUETAS_INCIDENCIA,
  compararSeveridad,
  severidadMaximaPorDia,
  type CategoriaIncidencia,
  type EstadoIncidencia,
  type EtiquetaIncidencia,
} from "@/domain/incidencias";
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
import { ListaIncidencias } from "./ListaIncidencias";

type FiltroEtiqueta = EtiquetaIncidencia | "todas";
type FiltroCategoria = CategoriaIncidencia | "todas";
type FiltroEstado = EstadoIncidencia | "todas";

/** Calendario, filtros y análisis global de incidencias. */
export function IncidenciasAnaliticaView() {
  const incidencias = useIncidencias();

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const centrosPorId = useMemo(
    () => new Map<string, CentroTransitorio>(centros.map((c) => [c.id, c])),
    [centros],
  );

  const [etiqueta, setEtiqueta] = useState<FiltroEtiqueta>("todas");
  const [categoria, setCategoria] = useState<FiltroCategoria>("todas");
  const [centroId, setCentroId] = useState<string>("todos");
  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [dia, setDia] = useState<string | null>(null);

  const hayFiltros =
    etiqueta !== "todas" ||
    categoria !== "todas" ||
    centroId !== "todos" ||
    estado !== "todas" ||
    dia !== null;

  function limpiarFiltros() {
    setEtiqueta("todas");
    setCategoria("todas");
    setCentroId("todos");
    setEstado("todas");
    setDia(null);
  }

  const filtradasBase = useMemo(
    () =>
      incidencias.filter(
        (i) =>
          (etiqueta === "todas" || i.etiqueta === etiqueta) &&
          (centroId === "todos" || i.centro_id === centroId) &&
          (estado === "todas" || i.estado === estado),
      ),
    [incidencias, etiqueta, centroId, estado],
  );

  const paraCalendario = useMemo(
    () =>
      categoria === "todas"
        ? filtradasBase
        : filtradasBase.filter((i) => i.categorias.includes(categoria)),
    [filtradasBase, categoria],
  );
  const severidadPorDia = useMemo(
    () => severidadMaximaPorDia(paraCalendario),
    [paraCalendario],
  );

  const paraContadores = useMemo(
    () => (dia ? filtradasBase.filter((i) => i.dia === dia) : filtradasBase),
    [filtradasBase, dia],
  );
  const conteoPorCategoria = useMemo(() => {
    const m = new Map<CategoriaIncidencia, number>();
    for (const inc of paraContadores) {
      for (const cat of inc.categorias) m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return m;
  }, [paraContadores]);

  const visibles = useMemo(() => {
    const arr =
      categoria === "todas"
        ? paraContadores
        : paraContadores.filter((i) => i.categorias.includes(categoria));
    return [...arr].sort(
      (a, b) =>
        compararSeveridad(a.etiqueta, b.etiqueta) ||
        b.dia.localeCompare(a.dia) ||
        b.ts - a.ts,
    );
  }, [paraContadores, categoria]);

  const abiertasVisibles = visibles.filter((i) => i.estado === "abierta").length;

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Calendario de la red</CardTitle>
              <CardDescription>
                Punto de color = severidad máxima del día. Clic en un día para
                filtrar la lista.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarioIncidencias
                severidadPorDia={severidadPorDia}
                diaSeleccionado={dia}
                onSeleccionarDia={setDia}
              />
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                {ETIQUETAS_INCIDENCIA.map((e) => (
                  <span
                    key={e.valor}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground"
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                    {e.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CampoFiltro label="Etiqueta">
                <Select
                  value={etiqueta}
                  onValueChange={(v) => setEtiqueta(v as FiltroEtiqueta)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {ETIQUETAS_INCIDENCIA.map((e) => (
                      <SelectItem key={e.valor} value={e.valor}>
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: e.color }}
                        />
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CampoFiltro>

              <CampoFiltro label="Categoría">
                <Select
                  value={categoria}
                  onValueChange={(v) => setCategoria(v as FiltroCategoria)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {CATEGORIAS_INCIDENCIA.map((c) => (
                      <SelectItem key={c.valor} value={c.valor}>
                        {c.icono} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CampoFiltro>

              <CampoFiltro label="Centro">
                <Select value={centroId} onValueChange={setCentroId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="todos">Todos los centros</SelectItem>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        N.° {c.nro} · {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CampoFiltro>

              <CampoFiltro label="Estado">
                <Select
                  value={estado}
                  onValueChange={(v) => setEstado(v as FiltroEstado)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="abierta">Abiertas</SelectItem>
                    <SelectItem value="resuelta">Resueltas</SelectItem>
                  </SelectContent>
                </Select>
              </CampoFiltro>

              {hayFiltros && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={limpiarFiltros}
                >
                  <FilterX className="size-3.5" />
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Por categoría</CardTitle>
              <CardDescription>
                Clasificación global en el rango visible
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-1.5">
              {CATEGORIAS_INCIDENCIA.map((c) => {
                const n = conteoPorCategoria.get(c.valor) ?? 0;
                const activa = categoria === c.valor;
                return (
                  <button
                    key={c.valor}
                    type="button"
                    onClick={() => setCategoria(activa ? "todas" : c.valor)}
                    className={cn(
                      "flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                      activa
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                      n === 0 && !activa && "opacity-50",
                    )}
                    title={`Filtrar por ${c.label}`}
                  >
                    <span className="truncate">
                      {c.icono} {c.label}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {n}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base lg:text-lg">
                    Incidencias
                    {dia && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        del {dia}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Ordenadas por severidad (urgentes primero) y fecha
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="tabular-nums">
                    {visibles.length} visible(s)
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "tabular-nums",
                      abiertasVisibles > 0 && "border-amber-500/40 text-amber-400",
                    )}
                  >
                    {abiertasVisibles} abierta(s)
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ListaIncidencias incidencias={visibles} centrosPorId={centrosPorId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CampoFiltro({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
