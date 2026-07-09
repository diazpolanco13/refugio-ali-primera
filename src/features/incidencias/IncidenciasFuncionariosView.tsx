import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { actualizarCasoSalud, archivarCasoSalud } from "@/data/reposCasosSalud";
import { claveDia } from "@/data/reposSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  casosSaludPendientes,
  type CasoSaludCentro,
  type EstatusCasoSalud,
} from "@/domain/seguimientoReportes";
import { puedeEditarCentro } from "@/domain/permisos";
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

/** Bandeja operativa: casos de salud en seguimiento y novedades negativas recientes. */
export function IncidenciasFuncionariosView({ sesion }: { sesion: Sesion }) {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => {
    const [y, m, d] = hoy.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 14);
    return claveDia(dt.getTime());
  }, [hoy]);

  const casos = useCasosSaludCentros();
  const eventos = useEventosReportes({ desde });

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
  const [accionEnCursoId, setAccionEnCursoId] = useState<string | null>(null);

  const hayFiltros = tipo !== "todos" || centroId !== "todos";

  function limpiarFiltros() {
    setTipo("todos");
    setCentroId("todos");
  }

  const casosPendientes = useMemo(() => casosSaludPendientes(casos), [casos]);
  const casosResueltos = useMemo(
    () => casos.filter((c) => c.estatus === "resuelto"),
    [casos],
  );
  const novedadesNegativas = useMemo(
    () => eventos.filter((e) => e.tipo === "negativo"),
    [eventos],
  );

  const visibles = useMemo((): ItemSeguimiento[] => {
    const items: ItemSeguimiento[] = [];

    if (tipo === "todos" || tipo === "salud") {
      for (const c of [...casosPendientes, ...casosResueltos]) {
        if (centroId !== "todos" && c.centro_id !== centroId) continue;
        items.push({ tipo: "salud", item: c });
      }
    }
    if (tipo === "todos" || tipo === "novedades") {
      for (const e of novedadesNegativas) {
        if (centroId !== "todos" && e.centro_id !== centroId) continue;
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
  }, [tipo, centroId, casosPendientes, casosResueltos, novedadesNegativas]);

  const activos = casosPendientes.length;

  async function cambiarEstatus(id: string, estatus: EstatusCasoSalud) {
    setAccionEnCursoId(id);
    try {
      await actualizarCasoSalud(id, { estatus });
    } catch (err) {
      console.error("[IncidenciasFuncionarios] error actualizando caso:", err);
    } finally {
      setAccionEnCursoId(null);
    }
  }

  async function archivar(id: string) {
    setAccionEnCursoId(id);
    try {
      await archivarCasoSalud(id);
    } catch (err) {
      console.error("[IncidenciasFuncionarios] error archivando caso:", err);
    } finally {
      setAccionEnCursoId(null);
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>Casos de salud y novedades negativas del reporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CampoFiltro label="Tipo">
              <Select value={tipo} onValueChange={(v) => setTipo(v as FiltroTipo)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Salud + novedades negativas</SelectItem>
                  <SelectItem value="salud">Solo salud</SelectItem>
                  <SelectItem value="novedades">Solo novedades negativas</SelectItem>
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
                <CardTitle className="text-base lg:text-lg">En seguimiento</CardTitle>
                <CardDescription>
                  Registros del reporte diario que requieren atención o cierre
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="tabular-nums">
                  {visibles.length} visible(s)
                </Badge>
                {activos > 0 && (
                  <Badge variant="outline" className="border-rose-500/40 tabular-nums text-rose-400">
                    {activos} salud activo(s)
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ListaSeguimientoReportes
              items={visibles}
              centrosPorId={centrosPorId}
              mostrarAccionesSalud
              puedeEditarSalud={(caso: CasoSaludCentro) =>
                puedeEditarCentro(sesion.user, caso.centro_id)
              }
              onCambiarEstatusSalud={(id, est) => void cambiarEstatus(id, est)}
              onArchivarSalud={(id) => void archivar(id)}
              accionEnCursoId={accionEnCursoId}
            />
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
