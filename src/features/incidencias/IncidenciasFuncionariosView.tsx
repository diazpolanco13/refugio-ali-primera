import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useIncidencias } from "@/data/useIncidencias";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { resolverIncidencia } from "@/data/reposReportes";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_INCIDENCIA,
  ETIQUETAS_INCIDENCIA,
  compararSeveridad,
  type CategoriaIncidencia,
  type EtiquetaIncidencia,
} from "@/domain/incidencias";
import { puedeResolverIncidencia } from "@/domain/permisos";
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
import { ListaIncidencias } from "./ListaIncidencias";

type FiltroEtiqueta = EtiquetaIncidencia | "todas";
type FiltroCategoria = CategoriaIncidencia | "todas";

/** Bandeja operativa: incidencias abiertas con acción de resolver. */
export function IncidenciasFuncionariosView({ sesion }: { sesion: Sesion }) {
  const incidencias = useIncidencias({ estado: "abierta" });

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
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);

  const hayFiltros =
    etiqueta !== "todas" || categoria !== "todas" || centroId !== "todos";

  function limpiarFiltros() {
    setEtiqueta("todas");
    setCategoria("todas");
    setCentroId("todos");
  }

  const visibles = useMemo(() => {
    const arr = incidencias.filter(
      (i) =>
        (etiqueta === "todas" || i.etiqueta === etiqueta) &&
        (centroId === "todos" || i.centro_id === centroId) &&
        (categoria === "todas" || i.categorias.includes(categoria)),
    );
    return [...arr].sort(
      (a, b) =>
        compararSeveridad(a.etiqueta, b.etiqueta) ||
        b.dia.localeCompare(a.dia) ||
        b.ts - a.ts,
    );
  }, [incidencias, etiqueta, categoria, centroId]);

  const urgentes = visibles.filter((i) => i.etiqueta === "urgente").length;

  async function resolver(id: string) {
    setResolviendoId(id);
    try {
      await resolverIncidencia(id);
    } catch (err) {
      console.error("[IncidenciasFuncionarios] error resolviendo:", err);
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>Incidencias abiertas de la red</CardDescription>
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

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base lg:text-lg">Abiertas</CardTitle>
                <CardDescription>
                  Ordenadas por severidad; resuelve desde aquí si tienes permiso
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="tabular-nums">
                  {visibles.length} abierta(s)
                </Badge>
                {urgentes > 0 && (
                  <Badge
                    variant="outline"
                    className="border-red-500/40 tabular-nums text-red-400"
                  >
                    {urgentes} urgente(s)
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ListaIncidencias
              incidencias={visibles}
              centrosPorId={centrosPorId}
              mostrarResolver
              puedeResolver={(inc) => puedeResolverIncidencia(sesion.user, inc)}
              onResolver={(id) => void resolver(id)}
              resolviendoId={resolviendoId}
            />
          </CardContent>
        </Card>
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
