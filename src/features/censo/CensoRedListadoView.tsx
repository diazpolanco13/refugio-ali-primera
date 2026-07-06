// Vista interna: listado general de damnificados del censo rápido (toda la red).

import { useMemo, useState } from "react";
import {
  Baby,
  FilterX,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useCensoRedListado } from "@/data/useCensoRedListado";
import { eliminarCenso, type RegistroCensoGuardado } from "@/data/reposCenso";
import { puedeEditarCensoRapidoRed, puedeVerCensoRapidoRed } from "@/domain/permisos";
import { BotonExportarCensoRed } from "@/features/censo/BotonExportarCensoRed";
import { CensoEditarRegistroSheet } from "@/features/censo/CensoEditarRegistroSheet";
import { CensoRedTabs } from "@/features/censo/CensoRedTabs";
import { CensoRegistrosTabla } from "@/features/censo/CensoRegistrosTabla";
import {
  estadisticasRegistrosCenso,
  filtrarRegistrosCenso,
  ordenarRegistrosCenso,
  type OrdenRegistrosCenso,
} from "@/features/censo/censoRegistrosUtil";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VistaPagina } from "@/components/VistaPagina";
import { cn } from "@/lib/utils";

type FiltroSexo = "todos" | "M" | "F";

const OPCIONES_ORDEN: { valor: OrdenRegistrosCenso; label: string }[] = [
  { valor: "reciente", label: "Más recientes" },
  { valor: "nombre", label: "Nombre A → Z" },
  { valor: "campamento", label: "Campamento" },
  { valor: "edad", label: "Mayor edad" },
];

function KpiPersona({
  valor,
  etiqueta,
  icono: Icono,
  clase,
}: {
  valor: number;
  etiqueta: string;
  icono: typeof Users;
  clase?: string;
}) {
  return (
    <Card size="sm" className="border-teal-500/15 py-2">
      <CardContent className="flex items-center gap-3 px-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-300",
            clase,
          )}
        >
          <Icono className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums leading-none">{valor.toLocaleString("es")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CensoRedListadoView({ sesion }: { sesion: Sesion }) {
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const puedeEditar = puedeEditarCensoRapidoRed(sesion.user.rol);
  const { registros, cargando, error, refrescar } = useCensoRedListado();
  const [busqueda, setBusqueda] = useState("");
  const [centroId, setCentroId] = useState("todos");
  const [sexo, setSexo] = useState<FiltroSexo>("todos");
  const [orden, setOrden] = useState<OrdenRegistrosCenso>("reciente");
  const [editando, setEditando] = useState<RegistroCensoGuardado | null>(null);
  const [eliminarTarget, setEliminarTarget] = useState<RegistroCensoGuardado | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");

  const campamentos = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of registros) {
      map.set(r.centro_id, r.centro_nombre);
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [registros]);

  const kpis = useMemo(() => {
    const stats = estadisticasRegistrosCenso(registros);
    const campamentosActivos = new Set(registros.map((r) => r.centro_id)).size;
    return { ...stats, campamentosActivos };
  }, [registros]);

  const visibles = useMemo(() => {
    let filas = filtrarRegistrosCenso(registros, busqueda, (f) => [f.centro_nombre]);
    if (centroId !== "todos") filas = filas.filter((f) => f.centro_id === centroId);
    if (sexo !== "todos") filas = filas.filter((f) => f.sexo === sexo);
    return ordenarRegistrosCenso(filas, orden, (f) => f.centro_nombre);
  }, [busqueda, centroId, sexo, orden, registros]);

  const hayFiltros =
    busqueda.trim() !== "" || centroId !== "todos" || sexo !== "todos" || orden !== "reciente";

  async function confirmarEliminar() {
    if (!eliminarTarget) return;
    setEliminando(true);
    setErrorEliminar("");
    try {
      await eliminarCenso(eliminarTarget.id);
      setEliminarTarget(null);
      await refrescar();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : "No se pudo eliminar el registro");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <VistaPagina
      icono={Users}
      acento="teal"
      titulo="Censo rápido (red)"
      descripcion="Listado general de damnificados registrados en terreno"
      cuerpoClassName="p-4 lg:p-6"
      acciones={
        tieneAcceso ? (
          <div className="flex items-center gap-2">
            <BotonExportarCensoRed
              filas={visibles}
              deshabilitado={cargando || visibles.length === 0}
            />
            <Button size="sm" variant="outline" onClick={() => void refrescar()} disabled={cargando}>
              <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        ) : undefined
      }
    >
      {!tieneAcceso ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Acceso restringido</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo el administrador, el analista SAE y la autoridad pueden consultar el censo de la
            red.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CensoRedTabs />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <KpiPersona valor={kpis.total} etiqueta="Total registrados" icono={Users} />
            <KpiPersona valor={kpis.campamentosActivos} etiqueta="Campamentos" icono={Users} />
            <KpiPersona valor={kpis.hombres} etiqueta="Hombres" icono={Users} />
            <KpiPersona valor={kpis.mujeres} etiqueta="Mujeres" icono={Users} />
            <KpiPersona valor={kpis.menores} etiqueta="Menores de 18" icono={Baby} />
            <KpiPersona
              valor={kpis.embarazadas + kpis.discapacidad + kpis.enfermedad}
              etiqueta="Cond. especiales"
              icono={Heart}
              clase="bg-amber-500/10 text-amber-600 dark:text-amber-300"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar nombre, cédula, teléfono o campamento…"
                className="h-8 pl-8 text-sm"
              />
            </div>

            <Select value={centroId} onValueChange={setCentroId}>
              <SelectTrigger size="sm" className="w-48 max-w-full">
                <SelectValue placeholder="Campamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los campamentos</SelectItem>
                {campamentos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sexo} onValueChange={(v) => setSexo(v as FiltroSexo)}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo sexo</SelectItem>
                <SelectItem value="M">Hombres</SelectItem>
                <SelectItem value="F">Mujeres</SelectItem>
              </SelectContent>
            </Select>

            <Select value={orden} onValueChange={(v) => setOrden(v as OrdenRegistrosCenso)}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_ORDEN.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hayFiltros && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={() => {
                  setBusqueda("");
                  setCentroId("todos");
                  setSexo("todos");
                  setOrden("reciente");
                }}
              >
                <FilterX className="size-3.5" />
                Limpiar
              </Button>
            )}

            <Badge variant="outline" className="ml-auto tabular-nums">
              {visibles.length} persona{visibles.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Card className="border-teal-500/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Damnificados registrados</CardTitle>
              <CardDescription>
                {cargando
                  ? "Cargando…"
                  : `${registros.length} registro${registros.length === 1 ? "" : "s"} en la red`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Cargando listado…
                </div>
              ) : registros.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Aún no hay damnificados registrados en el censo rápido.
                </p>
              ) : visibles.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Ninguna persona coincide con los filtros seleccionados.
                </p>
              ) : (
                <CensoRegistrosTabla
                  filas={visibles}
                  mostrarCentro
                  puedeEditar={puedeEditar}
                  onEditar={setEditando}
                  onEliminar={(f) => {
                    setErrorEliminar("");
                    setEliminarTarget(f);
                  }}
                />
              )}
            </CardContent>
          </Card>

          <CensoEditarRegistroSheet
            fila={editando}
            onOpenChange={(open) => {
              if (!open) setEditando(null);
            }}
            onGuardado={() => void refrescar()}
          />

          <AlertDialog
            open={eliminarTarget != null}
            onOpenChange={(abierto) => {
              if (!abierto) {
                setEliminarTarget(null);
                setErrorEliminar("");
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
                <AlertDialogDescription>
                  {eliminarTarget
                    ? `Se borrará permanentemente a ${[
                        eliminarTarget.primer_nombre,
                        eliminarTarget.primer_apellido,
                      ]
                        .filter(Boolean)
                        .join(" ")}. Esta acción no se puede deshacer.`
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {errorEliminar && <p className="text-sm text-destructive">{errorEliminar}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={eliminando}
                  onClick={(e) => {
                    e.preventDefault();
                    void confirmarEliminar();
                  }}
                >
                  {eliminando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Eliminando…
                    </>
                  ) : (
                    "Eliminar"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </VistaPagina>
  );
}
