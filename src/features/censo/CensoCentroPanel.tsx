// Panel Censo de la ficha del campamento: avance nominal vs parte + listado
// amplio por rol. Importaciones Excel (censo_registros) en pestaña homónima.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { registrarEgreso } from "@/data/reposRefugiados";
import { supabase } from "@/data/supabaseClient";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import { useCensoRedListado } from "@/data/useCensoRedListado";
import { useCensoRedResumen } from "@/data/useCensoRedResumen";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  completarCenso,
  eliminarCenso,
  listarIdsCensoProcesados,
  listarRegistrosCenso,
  obtenerListadoCensoRedFiltrado,
  reabrirCenso,
  type RegistroCensoGuardado,
} from "@/data/reposCenso";
import { estadoCensoCentro, type EstadoCensoCentro } from "@/domain/censoResumen";
import {
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  nivelColumnasCensoNominal,
  puedeEditarCensoCentro,
  puedeVerCensoCentro,
} from "@/domain/permisos";
import {
  alojamientosActivos,
  contarFamiliasActivas,
  nombreCompleto,
  progresoCensoNominal,
  type AlojamientoEnriquecido,
} from "@/domain/refugiados";
import { AvanceCensoNominal, type FiltroKpiDemografico } from "@/features/censo/AvanceCensoNominal";
import { BotonExportarCensoCentro } from "@/features/censo/BotonExportarCensoCentro";
import { CalidadCensoResumen } from "@/features/censo/CalidadCensoResumen";
import { CensoEditarRegistroSheet } from "@/features/censo/CensoEditarRegistroSheet";
import { CensoNominalTablaCentro } from "@/features/censo/CensoNominalTablaCentro";
import { CensoRegistrosTabla } from "@/features/censo/CensoRegistrosTabla";
import { ComparacionParteCenso } from "@/features/censo/ComparacionParteCenso";
import { metricasDemograficasNominal } from "@/features/censo/metricasDemograficasNominal";
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
import {
  CENSO_BOTON_ACCION,
  CENSO_BOTON_SECUNDARIO,
  CENSO_SELECT_TRIGGER,
} from "@/features/censo/censoFormularioShared";

type TabCensoCentro = "actual" | "importaciones";

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
  if (estado === "completado_declarado" || estado === "sin_ocupantes") {
    return "completado";
  }
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
  /** Abre ficha de refugiado (alojamiento id). */
  onAbrirRefugiado?: (alojamientoId: string) => void;
  /** Acciones extra en la barra superior (p. ej. «Volver» en la ruta dedicada). */
  accionesExtra?: ReactNode;
  /** Si false, no muestra el botón Actualizar (útil cuando el padre ya refresca). */
  mostrarActualizar?: boolean;
}

export function CensoCentroPanel({
  centroId,
  centroNombre: centroNombreProp,
  centro: centroProp,
  sesion,
  onAbrirRefugiado,
  accionesExtra,
  mostrarActualizar = true,
}: Props) {
  const navigate = useNavigate();
  const tieneAcceso = puedeVerCensoCentro(sesion.user, centroId);
  const puedeEditar = puedeEditarCensoCentro(sesion.user, centroId);
  const nivelColumnas = nivelColumnasCensoNominal(sesion.user.rol);

  const { resumenes, cargando: cargandoResumen, refrescar: refrescarResumen } =
    useCensoRedResumen();
  const [tab, setTab] = useState<TabCensoCentro>("actual");
  const [busquedaStaging, setBusquedaStaging] = useState("");
  const [editando, setEditando] = useState<RegistroCensoGuardado | null>(null);
  const [eliminarStaging, setEliminarStaging] =
    useState<RegistroCensoGuardado | null>(null);
  const [eliminandoStaging, setEliminandoStaging] = useState(false);
  const [errorEliminarStaging, setErrorEliminarStaging] = useState("");
  const [pendienteEstado, setPendienteEstado] = useState<EstadoEditable | null>(
    null,
  );
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState("");

  const [eliminarNominal, setEliminarNominal] =
    useState<AlojamientoEnriquecido | null>(null);
  const [eliminandoNominalId, setEliminandoNominalId] = useState<string | null>(
    null,
  );
  const [errorEliminarNominal, setErrorEliminarNominal] = useState<string | null>(
    null,
  );
  const [filtroKpi, setFiltroKpi] = useState<FiltroKpiDemografico>(null);

  const [centroLocal, setCentroLocal] = useState<CentroTransitorio | null>(null);
  const [censoViejoCount, setCensoViejoCount] = useState(0);
  const [verificadosViejo, setVerificadosViejo] = useState(0);

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
      busqueda: busquedaStaging,
      centroId,
      sexo: "todos",
      orden: "reciente",
      solicitado: "todos",
      registroPolicial: "todos",
    },
    { enabled: tab === "importaciones" },
  );

  const {
    alojamientos,
    cargando: cargandoNominal,
    quitarLocal,
    refrescar: refrescarNominal,
  } = useAlojamientosCentro({
    centroId,
    estado: "activo",
  });

  useEffect(() => {
    if (centroProp) {
      setCentroLocal(normalizarCentro(centroProp));
      return;
    }
    let cancelado = false;
    void (async () => {
      const { data, error } = await supabase
        .from("centros")
        .select("*")
        .eq("id", centroId)
        .eq("deleted", false)
        .maybeSingle();
      if (cancelado) return;
      if (error || !data) {
        setCentroLocal(null);
        return;
      }
      setCentroLocal(
        normalizarCentro(
          desenvolver(data as FilaSync<CentroTransitorio>) as CentroTransitorio,
        ),
      );
    })();
    return () => {
      cancelado = true;
    };
  }, [centroId, centroProp]);

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      listarRegistrosCenso(centroId),
      listarIdsCensoProcesados(centroId),
    ])
      .then(([lista, procesados]) => {
        if (cancelado) return;
        setCensoViejoCount(lista.length);
        setVerificadosViejo(
          lista.filter((f) => procesados.has(f.id)).length,
        );
      })
      .catch((err) => {
        console.warn("[CensoCentroPanel] importaciones Excel:", err);
      });
    return () => {
      cancelado = true;
    };
  }, [centroId]);

  const snapshots = useOcupacionesCentros({ centroId });
  const ultimoSnap = useMemo(() => {
    if (snapshots.length === 0) return null;
    return [...snapshots].sort((a, b) => b.dia.localeCompare(a.dia))[0] ?? null;
  }, [snapshots]);

  const centro = centroLocal;
  const metaRefugiados = useMemo(() => {
    const desdeCentro = centro ? poblacionCentro(centro) : 0;
    const desdeSnap = Math.max(0, ultimoSnap?.total_afectados ?? 0);
    return Math.max(desdeCentro, desdeSnap);
  }, [centro, ultimoSnap]);

  const metaFamilias = useMemo(() => {
    const desdeCentro = centro?.familias_ocupadas ?? 0;
    const desdeSnap = Math.max(0, ultimoSnap?.familias ?? 0);
    return Math.max(desdeCentro, desdeSnap);
  }, [centro, ultimoSnap]);

  const progreso = useMemo(() => {
    const activos = alojamientosActivos(alojamientos);
    return progresoCensoNominal(
      { refugiados: metaRefugiados, familias: metaFamilias },
      {
        refugiados: activos.length,
        familias: contarFamiliasActivas(activos),
      },
    );
  }, [alojamientos, metaFamilias, metaRefugiados]);

  const demografia = useMemo(
    () => metricasDemograficasNominal(alojamientos),
    [alojamientos],
  );

  const resumen = useMemo(
    () => resumenes.find((r) => r.centroId === centroId),
    [centroId, resumenes],
  );

  const centroNombre =
    centro?.nombre ?? resumen?.centroNombre ?? centroNombreProp ?? "Campamento";
  const totalPersonasStaging = resumen?.totalRegistrados ?? total;
  const urlPlanilla = `/registro?centro=${encodeURIComponent(centroId)}`;

  async function refrescarTodo() {
    await Promise.all([
      refrescarResumen(),
      refrescarListado(),
      refrescarNominal(),
    ]);
  }

  const obtenerFilasExportacion = useCallback(
    (onProgreso?: (cargados: number, totalFilas: number) => void) =>
      obtenerListadoCensoRedFiltrado(filtrosApi, onProgreso),
    [filtrosApi],
  );

  function abrirRefugiado(alojamientoId: string) {
    if (onAbrirRefugiado) {
      onAbrirRefugiado(alojamientoId);
      return;
    }
    // Ruta dedicada /centros/censo: ficha vía pestaña población del centro
    // (supervisor no entra a /centros/refugiados).
    navigate(
      `/centro/${encodeURIComponent(centroId)}?vista=poblacion&refugiado=${encodeURIComponent(alojamientoId)}`,
    );
  }

  async function confirmarEliminarStaging() {
    if (!eliminarStaging) return;
    setEliminandoStaging(true);
    setErrorEliminarStaging("");
    try {
      await eliminarCenso(eliminarStaging.id);
      setEliminarStaging(null);
      await refrescarTodo();
    } catch (err) {
      setErrorEliminarStaging(
        err instanceof Error ? err.message : "No se pudo eliminar el registro",
      );
    } finally {
      setEliminandoStaging(false);
    }
  }

  async function confirmarEliminarNominal() {
    if (!eliminarNominal) return;
    const id = eliminarNominal.id;
    setErrorEliminarNominal(null);
    setEliminandoNominalId(id);
    try {
      await registrarEgreso(id, { motivo: "Corrección de registro" });
      quitarLocal(id);
      setEliminarNominal(null);
    } catch (err) {
      setErrorEliminarNominal(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar del registro.",
      );
    } finally {
      setEliminandoNominalId(null);
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
          nombre:
            sesion.user.nombre?.trim() ||
            sesion.user.username ||
            "Usuario interno",
          institucion: "Sala situacional",
          telefono: sesion.user.whatsapp?.trim() || "",
        });
      } else {
        await reabrirCenso(centroId);
      }
      setPendienteEstado(null);
      await refrescarTodo();
    } catch (err) {
      setErrorEstado(
        err instanceof Error ? err.message : "No se pudo cambiar el estado",
      );
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
          Solo el administrador, el analista, la autoridad y el supervisor de
          este campamento pueden consultar el registro.
        </p>
      </div>
    );
  }

  const estado = resumen
    ? estadoCensoCentro(resumen)
    : totalPersonasStaging > 0
      ? "en_curso"
      : "sin_iniciar";
  const metaEstado = META_ESTADO[estado];
  const estadoEditable = estadoAEditable(estado);
  const cargandoAlgo =
    cargandoResumen ||
    cargandoNominal ||
    (tab === "importaciones" && cargandoListado);
  const numeroInicial = total - pagina * filasPorPagina;

  function solicitarCambioEstado(nuevo: EstadoEditable) {
    if (nuevo === estadoEditable) return;

    if (nuevo === "completado") {
      setErrorEstado("");
      setPendienteEstado("completado");
      return;
    }

    if (estadoEditable === "completado") {
      if (nuevo === "sin_iniciar" && totalPersonasStaging > 0) {
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
        "El registro pasa a «En curso» al registrar la primera persona. Use «Ir al registro» para empezar.",
      );
      return;
    }

    if (estadoEditable === "en_curso" && nuevo === "sin_iniciar") {
      setErrorEstado(
        "Para volver a «Sin iniciar» elimine todos los registros en la pestaña Importaciones Excel.",
      );
      return;
    }
  }

  const textoConfirmacionEstado =
    pendienteEstado === "completado"
      ? totalPersonasStaging === 0
        ? `Declarará el registro de ${centroNombre} como completado sin ocupantes (0 personas).`
        : `Declarará el registro de ${centroNombre} como completado con ${totalPersonasStaging.toLocaleString("es")} persona${totalPersonasStaging === 1 ? "" : "s"} registradas.`
      : pendienteEstado === "en_curso"
        ? `Reabrirá el registro de ${centroNombre}. Se anulará el cierre declarado y quedará en curso.`
        : `Reabrirá el registro de ${centroNombre} y lo dejará como sin iniciar (sin cierre declarado).`;

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
          <Badge variant="outline" className="text-[10px]">
            Registro nominal
          </Badge>
          {progreso.registradosRefugiados > 0 ? (
            <span className="text-xs text-muted-foreground">
              {progreso.registradosRefugiados.toLocaleString("es")} registrado
              {progreso.registradosRefugiados === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accionesExtra}
          <Button size="sm" variant="outline" asChild>
            <a href={urlPlanilla} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Ir al registro
            </a>
          </Button>
          {mostrarActualizar ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refrescarTodo()}
              disabled={cargandoAlgo}
            >
              <RefreshCw
                className={cn("size-4", cargandoAlgo && "animate-spin")}
              />
              Actualizar
            </Button>
          ) : null}
        </div>
      </div>

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
            <TabsTrigger value="actual" className={tabTriggerClass}>
              <ClipboardList className="size-3.5 shrink-0" />
              <span className="truncate">Registro actual</span>
              {progreso.registradosRefugiados > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[9px] tabular-nums"
                >
                  {progreso.registradosRefugiados.toLocaleString("es")}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="importaciones" className={tabTriggerClass}>
              <FileSpreadsheet className="size-3.5 shrink-0" />
              <span className="truncate">Importaciones Excel</span>
              {censoViejoCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[9px] tabular-nums"
                >
                  {censoViejoCount.toLocaleString("es")}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="actual" className="mt-4 space-y-4">
          <AvanceCensoNominal
            centroNombre={centroNombre}
            progreso={progreso}
            censoAnterior={
              censoViejoCount > 0
                ? { verificados: verificadosViejo, total: censoViejoCount }
                : null
            }
            demografia={demografia}
            filtroKpi={filtroKpi}
            onFiltroKpi={setFiltroKpi}
          />
          <CensoNominalTablaCentro
            alojamientos={alojamientos}
            cargando={cargandoNominal}
            centroId={centroId}
            centroNombre={centroNombre}
            nivel={nivelColumnas}
            puedeEditar={puedeEditar}
            eliminandoId={eliminandoNominalId}
            filtroKpi={filtroKpi}
            onLimpiarFiltroKpi={() => setFiltroKpi(null)}
            onAbrirRefugiado={abrirRefugiado}
            onEliminar={
              puedeEditar
                ? (a) => {
                    setErrorEliminarNominal(null);
                    setEliminarNominal(a);
                  }
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="importaciones" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {puedeEditar ? (
                <Select
                  value={estadoEditable}
                  onValueChange={(v) =>
                    solicitarCambioEstado(v as EstadoEditable)
                  }
                  disabled={cambiandoEstado || cargandoResumen}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn(
                      CENSO_SELECT_TRIGGER,
                      "h-8 w-auto min-w-36 gap-1.5 text-[11px]",
                      metaEstado.clase,
                    )}
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
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", metaEstado.clase)}
                >
                  {metaEstado.label}
                </Badge>
              )}
              {resumen ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    Último registro: {formatearFecha(resumen.ultimoRegistroEn)}
                  </span>
                  {resumen.cierreEn ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">
                      Cierre: {formatearFecha(resumen.cierreEn)}
                      {resumen.cierreFuncionario
                        ? ` · ${resumen.cierreFuncionario}`
                        : ""}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {errorEstado && pendienteEstado == null ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorEstado}
            </div>
          ) : null}

          {resumen?.cierreEn ? (
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
                    ? "Registro cerrado sin ocupantes"
                    : "Registro completado declarado"}
                </p>
                <p className="text-xs opacity-90">
                  {formatearFecha(resumen.cierreEn)}
                  {estado === "sin_ocupantes"
                    ? " · sin personas damnificadas / en adecuación"
                    : resumen.cierreTotal != null
                      ? ` · ${resumen.cierreTotal.toLocaleString("es")} persona${resumen.cierreTotal === 1 ? "" : "s"} al cierre`
                      : ""}
                  {resumen.cierreFuncionario
                    ? ` · ${resumen.cierreFuncionario}`
                    : ""}
                </p>
              </div>
            </div>
          ) : null}

          {cargandoResumen && !resumen ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando resumen de importaciones Excel…
            </div>
          ) : resumen ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Parte (revista) vs importaciones Excel
              </p>
              <ComparacionParteCenso
                resumen={resumen}
                ocupacionParte={centro?.ocupacion}
              />
              <CalidadCensoResumen resumen={resumen} />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
              Aún no hay importaciones Excel para este campamento.
            </div>
          )}

          {errorListado ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorListado}
            </div>
          ) : null}

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-muted-foreground" />
                    Personas importadas (Excel)
                  </CardTitle>
                  <CardDescription>
                    {cargandoListado && registros.length === 0
                      ? "Cargando…"
                      : `${total.toLocaleString("es")} registro${total === 1 ? "" : "s"} externos · no verificados`}
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
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busquedaStaging}
                  onChange={(e) => setBusquedaStaging(e.target.value)}
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
                  {busquedaStaging.trim()
                    ? `Ninguna persona coincide con «${busquedaStaging.trim()}».`
                    : "Aún no hay personas importadas por Excel en este campamento."}
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
                      setErrorEliminarStaging("");
                      setEliminarStaging(f);
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
        open={eliminarStaging != null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setEliminarStaging(null);
            setErrorEliminarStaging("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {eliminarStaging
                ? `Se borrará permanentemente a ${[
                    eliminarStaging.primer_nombre,
                    eliminarStaging.primer_apellido,
                  ]
                    .filter(Boolean)
                    .join(" ")}. Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorEliminarStaging ? (
            <p className="text-sm text-destructive">{errorEliminarStaging}</p>
          ) : null}
          <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              variant="destructive"
              className={CENSO_BOTON_ACCION}
              disabled={eliminandoStaging}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminarStaging();
              }}
            >
              {eliminandoStaging ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              className={CENSO_BOTON_SECUNDARIO}
              disabled={eliminandoStaging}
            >
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={eliminarNominal != null}
        onOpenChange={(abierto) => {
          if (!abierto && !eliminandoNominalId) {
            setEliminarNominal(null);
            setErrorEliminarNominal(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar del registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {eliminarNominal
                ? `Se quitará a ${nombreCompleto(eliminarNominal.refugiado)} del campamento (egreso por corrección de registro).`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorEliminarNominal ? (
            <p className="text-sm text-destructive">{errorEliminarNominal}</p>
          ) : null}
          <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              type="button"
              variant="destructive"
              className={CENSO_BOTON_ACCION}
              disabled={eliminandoNominalId != null}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminarNominal();
              }}
            >
              {eliminandoNominalId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              type="button"
              className={CENSO_BOTON_SECUNDARIO}
              disabled={eliminandoNominalId != null}
            >
              Cancelar
            </AlertDialogCancel>
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
                ? "¿Marcar registro como completado?"
                : pendienteEstado === "en_curso"
                  ? "¿Reabrir registro (en curso)?"
                  : "¿Dejar registro sin iniciar?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {textoConfirmacionEstado}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorEstado ? (
            <p className="text-sm text-destructive">{errorEstado}</p>
          ) : null}
          <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              className={CENSO_BOTON_ACCION}
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
            <AlertDialogCancel
              className={CENSO_BOTON_SECUNDARIO}
              disabled={cambiandoEstado}
            >
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
