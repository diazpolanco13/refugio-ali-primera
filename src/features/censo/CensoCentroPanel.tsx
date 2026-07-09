// Panel del censo rápido de un campamento: contraste con el parte, calidad,
// demografía y listado paginado de personas. Se usa en la ficha del centro y en
// `/centros/censo-rapido/:centroId`.

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useCensoRedListado } from "@/data/useCensoRedListado";
import { useCensoRedResumen } from "@/data/useCensoRedResumen";
import {
  completarCenso,
  eliminarCenso,
  obtenerListadoCensoRedFiltrado,
  reabrirCenso,
  type RegistroCensoGuardado,
} from "@/data/reposCenso";
import { estadoCensoCentro, type EstadoCensoCentro } from "@/domain/censoResumen";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { puedeEditarCensoRapidoRed, puedeVerCensoRapidoRed } from "@/domain/permisos";
import { BotonExportarCensoCentro } from "@/features/censo/BotonExportarCensoCentro";
import { CalidadCensoResumen } from "@/features/censo/CalidadCensoResumen";
import { CensoEditarRegistroSheet } from "@/features/censo/CensoEditarRegistroSheet";
import { CensoRegistrosTabla } from "@/features/censo/CensoRegistrosTabla";
import { ComparacionParteCenso } from "@/features/censo/ComparacionParteCenso";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginadorTabla } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TabCensoCentro = "resumen" | "personas";

/** Estados que el usuario puede elegir en el selector (sin_ocupantes → Completado). */
type EstadoEditable = "sin_iniciar" | "en_curso" | "completado";

const META_ESTADO = {
  sin_iniciar: {
    label: "Sin iniciar",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  en_curso: {
    label: "En curso",
    clase: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  completado_declarado: {
    label: "Completado",
    clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  sin_ocupantes: {
    label: "Completado (sin ocupantes)",
    clase: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
} as const;

function estadoAEditable(estado: EstadoCensoCentro): EstadoEditable {
  if (estado === "completado_declarado" || estado === "sin_ocupantes") return "completado";
  if (estado === "en_curso") return "en_curso";
  return "sin_iniciar";
}

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  centroId: string;
  centroNombre?: string;
  /** Centro completo: aporta el desglose demográfico del parte (revista). */
  centro?: CentroTransitorio | null;
  sesion: Sesion;
  /** Acciones extra en la barra superior (p. ej. «Volver» en la ruta dedicada). */
  accionesExtra?: ReactNode;
  /** Si false, no muestra el botón Actualizar (útil cuando el padre ya refresca). */
  mostrarActualizar?: boolean;
}

export function CensoCentroPanel({
  centroId,
  centroNombre: centroNombreProp,
  centro,
  sesion,
  accionesExtra,
  mostrarActualizar = true,
}: Props) {
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const puedeEditar = puedeEditarCensoRapidoRed(sesion.user.rol);
  const { resumenes, cargando: cargandoResumen, refrescar: refrescarResumen } =
    useCensoRedResumen();
  const [tab, setTab] = useState<TabCensoCentro>("resumen");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<RegistroCensoGuardado | null>(null);
  const [eliminarTarget, setEliminarTarget] = useState<RegistroCensoGuardado | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");
  const [pendienteEstado, setPendienteEstado] = useState<EstadoEditable | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState("");

  const {
    registros,
    total,
    pagina,
    setPagina,
    totalPaginas,
    filasPorPagina,
    cargando: cargandoListado,
    error: errorListado,
    refrescar: refrescarListado,
    filtrosApi,
  } = useCensoRedListado(
    {
      busqueda,
      centroId,
      sexo: "todos",
      orden: "reciente",
    },
    { enabled: tab === "personas" },
  );

  const resumen = useMemo(
    () => resumenes.find((r) => r.centroId === centroId),
    [centroId, resumenes],
  );

  const centroNombre = resumen?.centroNombre ?? centroNombreProp ?? "Campamento";
  const totalPersonas = resumen?.totalRegistrados ?? total;
  const urlPlanilla = `/censo?centro=${encodeURIComponent(centroId)}`;

  async function refrescarTodo() {
    await Promise.all([refrescarResumen(), refrescarListado()]);
  }

  const obtenerFilasExportacion = useCallback(
    (onProgreso?: (cargados: number, totalFilas: number) => void) =>
      obtenerListadoCensoRedFiltrado(filtrosApi, onProgreso),
    [filtrosApi],
  );

  async function confirmarEliminar() {
    if (!eliminarTarget) return;
    setEliminando(true);
    setErrorEliminar("");
    try {
      await eliminarCenso(eliminarTarget.id);
      setEliminarTarget(null);
      await refrescarTodo();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : "No se pudo eliminar el registro");
    } finally {
      setEliminando(false);
    }
  }

  async function confirmarCambioEstado() {
    if (!pendienteEstado) return;
    setCambiandoEstado(true);
    setErrorEstado("");
    try {
      if (pendienteEstado === "completado") {
        await completarCenso(centroId, {
          jerarquia: sesion.user.jerarquia?.trim() || sesion.user.rol,
          nombre: sesion.user.nombre?.trim() || sesion.user.username || "Usuario interno",
          institucion: "Sala situacional",
          telefono: sesion.user.whatsapp?.trim() || "",
        });
      } else {
        // sin_iniciar / en_curso: anula cierre; el estado real lo dan los registros.
        await reabrirCenso(centroId);
      }
      setPendienteEstado(null);
      await refrescarTodo();
    } catch (err) {
      setErrorEstado(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    } finally {
      setCambiandoEstado(false);
    }
  }

  if (!tieneAcceso) {
    return (
      <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Acceso restringido</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Solo el administrador, el analista SAE y la autoridad pueden consultar el censo de la
          red.
        </p>
      </div>
    );
  }

  const estado = resumen
    ? estadoCensoCentro(resumen)
    : totalPersonas > 0
      ? "en_curso"
      : "sin_iniciar";
  const metaEstado = META_ESTADO[estado];
  const estadoEditable = estadoAEditable(estado);
  const cargandoAlgo = cargandoResumen || (tab === "personas" && cargandoListado);
  const numeroInicial = total - pagina * filasPorPagina;

  function solicitarCambioEstado(nuevo: EstadoEditable) {
    if (nuevo === estadoEditable) return;

    if (nuevo === "completado") {
      setErrorEstado("");
      setPendienteEstado("completado");
      return;
    }

    // Reabrir desde completado
    if (estadoEditable === "completado") {
      if (nuevo === "sin_iniciar" && totalPersonas > 0) {
        setErrorEstado(
          "Hay personas registradas: al reabrir quedará «En curso». Elimine los registros si desea «Sin iniciar».",
        );
        setPendienteEstado("en_curso");
        return;
      }
      setErrorEstado("");
      setPendienteEstado(nuevo);
      return;
    }

    if (estadoEditable === "sin_iniciar" && nuevo === "en_curso") {
      setErrorEstado(
        "El censo pasa a «En curso» al registrar la primera persona. Use «Ir al censo» para empezar.",
      );
      return;
    }

    if (estadoEditable === "en_curso" && nuevo === "sin_iniciar") {
      setErrorEstado(
        "Para volver a «Sin iniciar» elimine todos los registros en la pestaña Personas.",
      );
      return;
    }
  }

  const textoConfirmacionEstado =
    pendienteEstado === "completado"
      ? totalPersonas === 0
        ? `Declarará el censo de ${centroNombre} como completado sin ocupantes (0 personas).`
        : `Declarará el censo de ${centroNombre} como completado con ${totalPersonas.toLocaleString("es")} persona${totalPersonas === 1 ? "" : "s"} registradas.`
      : pendienteEstado === "en_curso"
        ? `Reabrirá el censo de ${centroNombre}. Se anulará el cierre declarado y quedará en curso.`
        : `Reabrirá el censo de ${centroNombre} y lo dejará como sin iniciar (sin cierre declarado).`;

  const tabTriggerClass = cn(
    "relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-none px-2 py-0",
    "!border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
    "text-xs font-medium text-muted-foreground",
    "transition-colors hover:text-foreground",
    "after:!hidden after:!content-none",
    "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
    "data-active:!bg-transparent data-active:!font-semibold data-active:!text-teal-300 data-active:!shadow-none",
    "dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {puedeEditar ? (
            <Select
              value={estadoEditable}
              onValueChange={(v) => solicitarCambioEstado(v as EstadoEditable)}
              disabled={cambiandoEstado || cargandoResumen}
            >
              <SelectTrigger
                size="sm"
                className={cn("h-7 w-auto min-w-36 gap-1.5 text-[11px]", metaEstado.clase)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin_iniciar">Sin iniciar</SelectItem>
                <SelectItem value="en_curso">En curso</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={cn("text-[10px]", metaEstado.clase)}>
              {metaEstado.label}
            </Badge>
          )}
          {resumen && (
            <>
              <span className="text-xs text-muted-foreground">
                Último registro: {formatearFecha(resumen.ultimoRegistroEn)}
              </span>
              {resumen.cierreEn && (
                <span className="text-xs text-emerald-700 dark:text-emerald-300">
                  Cierre: {formatearFecha(resumen.cierreEn)}
                  {resumen.cierreFuncionario ? ` · ${resumen.cierreFuncionario}` : ""}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accionesExtra}
          <Button size="sm" variant="outline" asChild>
            <a href={urlPlanilla} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Ir al censo
            </a>
          </Button>
          {mostrarActualizar && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refrescarTodo()}
              disabled={cargandoAlgo}
            >
              <RefreshCw className={cn("size-4", cargandoAlgo && "animate-spin")} />
              Actualizar
            </Button>
          )}
        </div>
      </div>

      {errorEstado && pendienteEstado == null && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorEstado}
        </div>
      )}

      {resumen?.cierreEn && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
            estado === "sin_ocupantes"
              ? "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
          )}
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">
              {estado === "sin_ocupantes"
                ? "Censo cerrado sin ocupantes"
                : "Censo completado declarado"}
            </p>
            <p className="text-xs opacity-90">
              {formatearFecha(resumen.cierreEn)}
              {estado === "sin_ocupantes"
                ? " · sin personas refugiadas / en adecuación"
                : resumen.cierreTotal != null
                  ? ` · ${resumen.cierreTotal.toLocaleString("es")} persona${resumen.cierreTotal === 1 ? "" : "s"} al cierre`
                  : ""}
              {resumen.cierreFuncionario ? ` · ${resumen.cierreFuncionario}` : ""}
            </p>
          </div>
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabCensoCentro)}
        className="gap-0"
      >
        <div className="border-b border-border">
          <TabsList
            variant="line"
            className="!grid h-10 w-full grid-cols-2 gap-0 overflow-hidden rounded-none bg-transparent p-0"
          >
            <TabsTrigger value="resumen" className={tabTriggerClass}>
              <BarChart3 className="size-3.5 shrink-0" />
              <span className="truncate">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="personas" className={tabTriggerClass}>
              <Users className="size-3.5 shrink-0" />
              <span className="truncate">Personas</span>
              {totalPersonas > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] tabular-nums">
                  {totalPersonas.toLocaleString("es")}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="mt-4 space-y-4">
          {cargandoResumen && !resumen ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando resumen del censo…
            </div>
          ) : resumen ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Parte (revista) vs censo
              </p>
              <ComparacionParteCenso
                resumen={resumen}
                ocupacionParte={centro?.ocupacion}
              />
              <CalidadCensoResumen resumen={resumen} />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
              Aún no hay datos de censo rápido para este campamento.
            </div>
          )}
        </TabsContent>

        <TabsContent value="personas" className="mt-4 space-y-4">
          {errorListado && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorListado}
            </div>
          )}

          <Card className="border-teal-500/15">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-teal-600 dark:text-teal-300" />
                    Personas registradas
                  </CardTitle>
                  <CardDescription>
                    {cargandoListado && registros.length === 0
                      ? "Cargando…"
                      : `${total.toLocaleString("es")} registro${total === 1 ? "" : "s"} · busque por nombre, cédula o teléfono${puedeEditar ? " · use los iconos para corregir o eliminar" : ""}`}
                  </CardDescription>
                </div>
                <BotonExportarCensoCentro
                  obtenerFilas={obtenerFilasExportacion}
                  centroNombre={centroNombre}
                  totalEsperado={total}
                  deshabilitado={cargandoListado || total === 0}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, apellido, cédula o teléfono…"
                  className="h-10 pl-9"
                  autoComplete="off"
                />
              </div>

              {cargandoListado && registros.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando registros…
                </div>
              ) : total === 0 && !cargandoListado ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {busqueda.trim()
                    ? `Ninguna persona coincide con «${busqueda.trim()}». Verifique la cédula o el nombre e intente de nuevo.`
                    : "Aún no hay personas registradas en este campamento."}
                </p>
              ) : (
                <>
                  <CensoRegistrosTabla
                    filas={registros}
                    numeroInicial={numeroInicial}
                    numeracionDescendente
                    puedeEditar={puedeEditar}
                    onEditar={setEditando}
                    onEliminar={(f) => {
                      setErrorEliminar("");
                      setEliminarTarget(f);
                    }}
                  />
                  <PaginadorTabla
                    pagina={pagina}
                    totalPaginas={totalPaginas}
                    totalFilas={total}
                    filasPorPagina={filasPorPagina}
                    cargando={cargandoListado}
                    onPagina={setPagina}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CensoEditarRegistroSheet
        fila={editando}
        onOpenChange={(open) => {
          if (!open) setEditando(null);
        }}
        onGuardado={() => void refrescarTodo()}
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

      <AlertDialog
        open={pendienteEstado != null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setPendienteEstado(null);
            setErrorEstado("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendienteEstado === "completado"
                ? "¿Marcar censo como completado?"
                : pendienteEstado === "en_curso"
                  ? "¿Reabrir censo (en curso)?"
                  : "¿Dejar censo sin iniciar?"}
            </AlertDialogTitle>
            <AlertDialogDescription>{textoConfirmacionEstado}</AlertDialogDescription>
          </AlertDialogHeader>
          {errorEstado && <p className="text-sm text-destructive">{errorEstado}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cambiandoEstado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cambiandoEstado}
              onClick={(e) => {
                e.preventDefault();
                void confirmarCambioEstado();
              }}
            >
              {cambiandoEstado ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
