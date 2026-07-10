// Vista completa de un campamento (`/centro/:id`): segmentada por pestañas
// (Resumen, Coordinación, Población, Censo, Reporte, Seguimiento, Infraestructura, Buzón).
// Las mismas secciones también aparecen en el submenú del sidebar bajo Reportes diarios.
// El reporte diario y la edición del campamento se abren integrados en el mismo marco.
// Vive dentro del AppShell global, con sidebar y TopBar compartidos.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  LayoutGrid,
  Pencil,
  SearchX,
  UserPlus,
} from "lucide-react";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import { RefugiadoForm } from "@/features/refugiados/RefugiadoForm";
import { FichaRefugiadoView } from "@/features/refugiados/FichaRefugiadoView";
import { useSupabaseQueryConEstado } from "@/data/useSupabaseQuery";
import { FichaCentroSkeleton } from "./FichaCentroSkeleton";
import { claveDia } from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesControlDia } from "@/data/useReportesControlDia";
import { useEventosReportes } from "@/data/useEventosReportes";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { Sesion } from "@/data/authSupabase";
import {
  SECCIONES_FICHA_TERRENO,
  esRolTerreno,
  puedeCrearCentros,
  puedeEditarCentro,
  puedeEditarReportesPasados,
  puedeVerBuzonCentro,
  puedeVerCensoCentro,
} from "@/domain/permisos";
import { aplicarPartesActualesACentros } from "@/domain/parteActualCentros";
import { controlReportado, reporteControlDelDia } from "@/domain/controlReporte";
import {
  estadoReporteDia,
  eventosRevisados,
  estadosReportePorDia,
  META_ESTADO_REPORTE,
  reporteDelDia,
  ultimosDiasReporte,
  type EstadoReporteDia,
} from "@/domain/reporteDiario";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BadgesEstadoCentro,
} from "./DetalleCentro";
import { CoordinacionCentroPanel } from "./CoordinacionCentroPanel";
import { PoblacionCentroPanel } from "./PoblacionCentroPanel";
import { ResumenCentroPanel } from "./ResumenCentroPanel";
import { SeccionReporteDiarioCentro, BadgeEstadoReporte } from "./ReporteDiarioCentro";
import { SeccionSeguimientoReportesCentro } from "./SeguimientoReportesCentro";
import { InfraestructuraCapacidadPanel } from "./InfraestructuraCapacidadPanel";
import { BuzonCentroPanel } from "./BuzonCentroPanel";
import {
  SECCIONES_FICHA_CENTRO,
  normalizarSeccionFichaCentro,
  type SeccionFichaCentro,
} from "./seccionesFichaCentro";
import { CensoCentroPanel } from "@/features/censo/CensoCentroPanel";
import { cn } from "@/lib/utils";
import { CentroForm } from "./CentroForm";
import { ReporteDiarioForm } from "./ReporteDiarioForm";
import { VisorFechaReporte } from "./VisorFechaReporte";

interface Props {
  sesion: Sesion;
}

function diaDesdeParam(param: string | null, hoy: string): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && param <= hoy) return param;
  return hoy;
}

/** Ficha completa de un campamento transitorio. */
export function FichaCentroView({ sesion }: Props) {
  const { id: idParam, centroId: centroIdParam } = useParams<{ id?: string; centroId?: string }>();
  const id = centroIdParam ?? idParam;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const seccionParam = searchParams.get("vista");
  // Sesión del QR de terreno: la ficha se reduce a sus pestañas operativas
  // (resumen, población, reporte, infraestructura). Una vista oculta en la
  // URL cae al reporte. «Censo» para roles de red y para el supervisor en
  // sus campamentos asignados.
  const esTerreno = esRolTerreno(sesion.user.rol);
  const veCensoFicha = id != null && puedeVerCensoCentro(sesion.user, id);
  const veBuzonFicha = id != null && puedeVerBuzonCentro(sesion.user, id);
  const seccionesVisibles = useMemo(
    () =>
      SECCIONES_FICHA_CENTRO.filter((s) => {
        if (esTerreno && !(SECCIONES_FICHA_TERRENO as readonly string[]).includes(s.id)) {
          return false;
        }
        if (s.id === "censo_rapido" && !veCensoFicha) return false;
        if (s.id === "buzon" && !veBuzonFicha) return false;
        return true;
      }),
    [esTerreno, veCensoFicha, veBuzonFicha],
  );
  const seccionNormalizada = normalizarSeccionFichaCentro(seccionParam);
  const seccionActiva: SeccionFichaCentro = seccionesVisibles.some(
    (s) => s.id === seccionNormalizada,
  )
    ? seccionNormalizada
    : "reporte";
  const modoReporte = searchParams.get("reportar") === "1";
  const modoRegistrar = searchParams.get("registrar") === "1";
  const modoEditar = searchParams.get("editar") === "1";
  const refugiadoId = searchParams.get("refugiado");

  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const [diaReporte, setDiaReporte] = useState(() =>
    diaDesdeParam(searchParams.get("dia"), hoyClave),
  );

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const {
    datos: filasCentros,
    cargando: cargandoCentros,
  } = useSupabaseQueryConEstado<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centrosBase = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const snapshotsOcupacion = useOcupacionesCentros();
  const centros = useMemo(
    () => aplicarPartesActualesACentros(centrosBase, snapshotsOcupacion),
    [centrosBase, snapshotsOcupacion],
  );

  const centro = useMemo(
    () => centros.find((c) => c.id === id) ?? null,
    [centros, id],
  );

  const puedeEditar = centro != null && puedeEditarCentro(sesion.user, centro.id);
  const puedeEditarPasado = puedeEditarReportesPasados(sesion.user);
  const puedeEliminar = puedeCrearCentros(sesion.user.rol);

  const reportesHoy = useReportesCentros({
    centroId: centro?.id,
    dia: hoyClave,
  });
  const controlesHoy = useReportesControlDia({
    centroId: centro?.id,
    dia: hoyClave,
  });
  const { eventos: eventosHoy } = useEventosReportes({
    centroId: centro?.id,
    dia: hoyClave,
  });
  const snapshotsHoy = useMemo(
    () =>
      snapshotsOcupacion.filter(
        (snapshot) => snapshot.centro_id === centro?.id && snapshot.dia >= hoyClave,
      ),
    [snapshotsOcupacion, centro?.id, hoyClave],
  );
  const hoyEstado = useMemo(() => {
    if (!centro) return "pendiente" as const;
    const reporte = reporteDelDia(reportesHoy, centro.id, hoyClave);
    const parte = snapshotsHoy.some((s) => s.dia === hoyClave);
    const control = reporteControlDelDia(controlesHoy, centro.id, hoyClave);
    return estadoReporteDia(reporte, parte, {
      controlRevisado: controlReportado(control),
      trabajosRevisados: reporte?.trabajos_revisados ?? false,
      requerimientosRevisados: reporte?.requerimientos_revisados ?? false,
      eventosRevisados: eventosRevisados(reporte, eventosHoy.length),
    });
  }, [centro, reportesHoy, controlesHoy, eventosHoy, snapshotsHoy, hoyClave]);

  const desdeMarcas = useMemo(() => ultimosDiasReporte(30, hoyClave)[0], [hoyClave]);
  const reportesMarcas = useReportesCentros({ centroId: centro?.id, desde: desdeMarcas });
  const controlesMarcas = useReportesControlDia({ centroId: centro?.id, desde: desdeMarcas });
  const { eventos: eventosMarcas } = useEventosReportes({ centroId: centro?.id, desde: desdeMarcas });
  const snapshotsMarcas = useOcupacionesCentros({ centroId: centro?.id, desde: desdeMarcas });

  const marcasPorDia = useMemo(() => {
    const diasConParte = new Set(snapshotsMarcas.map((s) => s.dia));
    const diasConControl = new Set(
      controlesMarcas.filter((c) => c.revisado).map((c) => c.dia),
    );
    const diasConTrabajos = new Set(
      reportesMarcas.filter((r) => r.trabajos_revisados).map((r) => r.dia),
    );
    const diasConRequerimientos = new Set(
      reportesMarcas.filter((r) => r.requerimientos_revisados).map((r) => r.dia),
    );
    const eventosPorDia = new Map<string, number>();
    for (const evento of eventosMarcas) {
      eventosPorDia.set(evento.dia, (eventosPorDia.get(evento.dia) ?? 0) + 1);
    }
    const estados = estadosReportePorDia(reportesMarcas, diasConParte, {
      diasConControl,
      diasConTrabajos,
      diasConRequerimientos,
      eventosPorDia,
    });
    const m = new Map<string, string>();
    for (const [dia, estado] of estados) {
      if (estado !== "pendiente") m.set(dia, META_ESTADO_REPORTE[estado].color);
    }
    return m;
  }, [reportesMarcas, snapshotsMarcas, controlesMarcas, eventosMarcas]);

  const leyendaCalendario = useMemo(
    () =>
      (Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => ({
        color: META_ESTADO_REPORTE[e].color,
        label: META_ESTADO_REPORTE[e].label,
      })),
    [],
  );

  const reportesDiaReporte = useReportesCentros({ centroId: centro?.id, dia: diaReporte });
  const controlesDiaReporte = useReportesControlDia({ centroId: centro?.id, dia: diaReporte });
  const { eventos: eventosDiaReporte } = useEventosReportes({ centroId: centro?.id, dia: diaReporte });
  const snapshotsDiaReporte = useMemo(
    () => snapshotsMarcas.filter((s) => s.dia === diaReporte),
    [snapshotsMarcas, diaReporte],
  );
  const estadoDiaReporte = useMemo(() => {
    if (!centro) return "pendiente" as const;
    const reporte = reporteDelDia(reportesDiaReporte, centro.id, diaReporte);
    const parte = snapshotsDiaReporte.some((s) => s.dia === diaReporte);
    const control = reporteControlDelDia(controlesDiaReporte, centro.id, diaReporte);
    return estadoReporteDia(reporte, parte, {
      controlRevisado: controlReportado(control),
      trabajosRevisados: reporte?.trabajos_revisados ?? false,
      requerimientosRevisados: reporte?.requerimientos_revisados ?? false,
      eventosRevisados: eventosRevisados(reporte, eventosDiaReporte.length),
    });
  }, [
    centro,
    reportesDiaReporte,
    controlesDiaReporte,
    eventosDiaReporte,
    snapshotsDiaReporte,
    diaReporte,
  ]);

  function cambiarDiaReporte(nuevoDia: string) {
    const clamped = nuevoDia > hoyClave ? hoyClave : nuevoDia;
    setDiaReporte(clamped);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (clamped === hoyClave) next.delete("dia");
        else next.set("dia", clamped);
        return next;
      },
      { replace: true },
    );
  }

  function cambiarSeccion(vista: SeccionFichaCentro) {
    setSearchParams(vista === "resumen" ? {} : { vista }, { replace: true });
  }

  function abrirReporte(fase?: string) {
    const next = new URLSearchParams({ vista: "reporte", reportar: "1" });
    if (diaReporte !== hoyClave) next.set("dia", diaReporte);
    if (fase) next.set("fase", fase);
    setSearchParams(next, { replace: true });
  }

  function cerrarReporte() {
    setSearchParams({ vista: "reporte" }, { replace: true });
  }

  function abrirEdicion() {
    setSearchParams({ vista: "resumen", editar: "1" }, { replace: true });
  }

  function cerrarEdicion() {
    setSearchParams({ vista: "resumen" }, { replace: true });
  }

  function volverPoblacion() {
    setSearchParams({ vista: "poblacion" }, { replace: true });
  }

  function abrirFichaRefugiado(id: string) {
    setSearchParams({ vista: "poblacion", refugiado: id }, { replace: true });
  }

  const { familias: familiasCentro } = useAlojamientosCentro({
    centroId: centro?.id ?? "",
  });
  const nombresCentros = useMemo(
    () => new Map(centros.map((c) => [c.id, c.nombre || c.id])),
    [centros],
  );

  // Sincronizar día del reporte con ?dia= en pestaña Reporte o modo formulario.
  useEffect(() => {
    if (seccionActiva !== "reporte" && !modoReporte) return;
    setDiaReporte(diaDesdeParam(searchParams.get("dia"), hoyClave));
  }, [seccionActiva, modoReporte, searchParams, hoyClave]);

  // Redirigir ?vista=capacidad (URL antigua) a la pestaña unificada.
  useEffect(() => {
    if (seccionParam === "capacidad") {
      setSearchParams({ vista: "infraestructura" }, { replace: true });
    }
  }, [seccionParam, setSearchParams]);

  // Si no puede editar, no mantener modos de edición en la URL.
  useEffect(() => {
    if (centro && !puedeEditar) {
      if (modoReporte) cerrarReporte();
      if (modoRegistrar) volverPoblacion();
      if (modoEditar) cerrarEdicion();
    }
  }, [modoReporte, modoRegistrar, modoEditar, centro, puedeEditar]);

  if (!centro) {
    if (cargandoCentros) {
      return <FichaCentroSkeleton />;
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        <SearchX className="size-8 text-muted-foreground" />
        <p className="text-sm font-semibold">Campamento no encontrado</p>
        <p className="text-xs text-muted-foreground">
          El campamento solicitado no existe o fue eliminado de la red.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/centros/mapa")}>
          Ir al mapa
        </Button>
      </div>
    );
  }

  const titulo = `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`;
  const etiquetaBotonReporte =
    hoyEstado === "pendiente" ? "Reportar hoy" : "Editar reporte de hoy";
  const esReporteTab = seccionActiva === "reporte";
  const esHoyReporte = diaReporte === hoyClave;
  const parteDiaReporte = snapshotsDiaReporte.length > 0;

  if (refugiadoId && centro) {
    return (
      <FichaRefugiadoView
        alojamientoId={refugiadoId}
        puedeEditar={puedeEditar}
        onVolver={volverPoblacion}
        onAbrirMiembro={abrirFichaRefugiado}
      />
    );
  }

  if (modoRegistrar && puedeEditar && centro) {
    return (
      <MarcoVista
        ancho={ANCHO_VISTA_PRINCIPAL}
        rellenarAltura
        className="overflow-hidden"
        marcoClassName="flex min-h-0 flex-col text-foreground"
      >
        <VistaEncabezado
          icono={UserPlus}
          acento="emerald"
          titulo="Registrar persona"
          descripcion={`Censo nominal · ${titulo}`}
          acciones={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2"
              onClick={volverPoblacion}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Volver a Población</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          }
        />
        <RefugiadoForm
          centroId={centro.id}
          familias={familiasCentro}
          nombresCentros={nombresCentros}
          onCancelar={volverPoblacion}
          onRegistrado={abrirFichaRefugiado}
        />
      </MarcoVista>
    );
  }

  if (modoEditar && puedeEditar && centro) {
    return (
      <MarcoVista
        ancho={ANCHO_VISTA_PRINCIPAL}
        rellenarAltura
        className="overflow-hidden"
        marcoClassName="flex min-h-0 flex-col text-foreground"
      >
        <VistaEncabezado
          icono={Pencil}
          acento="sky"
          titulo={`Editar · ${titulo}`}
          descripcion="Identificación, asignación operativa, capacidad y contactos"
          acciones={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2"
              onClick={cerrarEdicion}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Volver a la ficha</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          }
        />
        <CentroForm
          centro={centro}
          puedeEliminar={puedeEliminar}
          variant="integrado"
          onCerrar={cerrarEdicion}
          onGuardado={() => cerrarEdicion()}
        />
      </MarcoVista>
    );
  }

  if (modoReporte && puedeEditar && (esHoyReporte || puedeEditarPasado)) {
    return (
      <MarcoVista
        ancho={ANCHO_VISTA_PRINCIPAL}
        rellenarAltura
        className="overflow-hidden p-2 sm:p-4 lg:p-6"
        marcoClassName="flex min-h-0 flex-col text-foreground"
      >
        <header className="shrink-0 border-b border-border/70 px-3 pb-3 pt-3 sm:px-4 lg:px-6">
          <div className="flex items-start gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2"
              onClick={cerrarReporte}
              aria-label="Volver a la ficha"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Volver a la ficha</span>
              <span className="sm:hidden">Volver</span>
            </Button>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="truncate text-sm font-semibold sm:text-base">Reporte del día</h1>
              <p className="truncate text-xs text-muted-foreground">{titulo}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <VisorFechaReporte
              dia={diaReporte}
              onDiaChange={cambiarDiaReporte}
              hoyClave={hoyClave}
              marcasPorDia={marcasPorDia}
              leyenda={leyendaCalendario}
              compacto
              className="h-9 min-w-0 flex-1 sm:h-8 sm:flex-none"
            />
            <BadgeEstadoReporte estado={estadoDiaReporte} destacado />
          </div>
        </header>
        <ReporteDiarioForm
          key={diaReporte}
          centro={centro}
          variant="integrado"
          diaReporte={diaReporte}
          faseInicial={searchParams.get("fase") ?? undefined}
          onCerrar={cerrarReporte}
        />
      </MarcoVista>
    );
  }

  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col text-foreground"
    >
      <VistaEncabezado
        icono={LayoutGrid}
        acento="sky"
        titulo={titulo}
        descripcion={centro.parroquia || "Ficha del campamento en la red"}
        acciones={
          esReporteTab ? (
            <>
              <div className="hidden sm:block">
                <VisorFechaReporte
                  dia={diaReporte}
                  onDiaChange={cambiarDiaReporte}
                  hoyClave={hoyClave}
                  marcasPorDia={marcasPorDia}
                  leyenda={leyendaCalendario}
                  compacto
                />
              </div>
              {/* En móvil el badge baja a la fila de la fecha (debajo) para no
                  aplastar el nombre del campamento. */}
              <div className="hidden sm:block">
                <BadgeEstadoReporte estado={estadoDiaReporte} destacado />
              </div>
              {puedeEditar && (esHoyReporte || puedeEditarPasado) && (
                <Button
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 bg-teal-600 px-3 hover:bg-teal-500"
                  onClick={() => abrirReporte()}
                >
                  <ClipboardCheck className="size-4" />
                  <span className="hidden sm:inline">
                    {!esHoyReporte
                      ? "Editar este día"
                      : estadoDiaReporte === "pendiente" && !parteDiaReporte
                        ? "Reportar hoy"
                        : "Editar reporte"}
                  </span>
                  <span className="sm:hidden">Reporte</span>
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="hidden shrink-0 sm:block">
                <BadgesEstadoCentro centro={centro} />
              </div>
              {puedeEditar && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 px-3"
                  onClick={abrirEdicion}
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Editar campamento</span>
                  <span className="sm:hidden">Editar</span>
                </Button>
              )}
              {puedeEditar && hoyEstado !== "completo" && (
                <Button
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 bg-teal-600 px-3 hover:bg-teal-500"
                  onClick={() => abrirReporte()}
                >
                  <ClipboardCheck className="size-4" />
                  <span className="hidden sm:inline">{etiquetaBotonReporte}</span>
                  <span className="sm:hidden">Reporte</span>
                </Button>
              )}
            </>
          )
        }
        debajo={
          esReporteTab ? (
            <div className="flex items-center gap-2 sm:hidden">
              <VisorFechaReporte
                dia={diaReporte}
                onDiaChange={cambiarDiaReporte}
                hoyClave={hoyClave}
                marcasPorDia={marcasPorDia}
                leyenda={leyendaCalendario}
                compacto
                className="h-9 min-w-0 flex-1"
              />
              <BadgeEstadoReporte estado={estadoDiaReporte} destacado />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 sm:hidden">
              <BadgesEstadoCentro centro={centro} />
            </div>
          )
        }
      />

      <Tabs
        value={seccionActiva}
        onValueChange={(v) => cambiarSeccion(v as SeccionFichaCentro)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="h-[50px] shrink-0 border-b border-border bg-background/95 px-4 sm:px-6">
          <TabsList
            variant="line"
            className="!h-[50px] w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 align-middle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {seccionesVisibles.map((s) => {
              const activa = s.id === seccionActiva;
              const reportePendiente =
                s.id === "reporte" && puedeEditar && hoyEstado !== "completo";

              return (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className={cn(
                    "relative shrink-0 rounded-none px-3 py-2.5 text-xs font-medium sm:text-sm",
                    "!h-full !border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
                    "text-muted-foreground transition-colors hover:text-foreground",
                    "after:!hidden after:!content-none",
                    "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
                    "data-active:!bg-transparent data-active:!font-semibold data-active:!text-teal-300 data-active:!shadow-none",
                    "dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
                    reportePendiente && !activa && "font-semibold text-teal-300/80",
                  )}
                >
                  {s.label}
                  {reportePendiente && (
                    <span className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-400" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
            <TabsContent value="resumen" className="mt-0">
              <ResumenCentroPanel
                centro={centro}
                puedeEditar={puedeEditar}
                onIrAPestana={(vista) => cambiarSeccion(vista)}
                onEditar={puedeEditar ? abrirEdicion : undefined}
              />
            </TabsContent>

            <TabsContent value="coordinacion" className="mt-0">
              <CoordinacionCentroPanel centro={centro} puedeEditar={puedeEditar} />
            </TabsContent>

            <TabsContent value="poblacion" className="mt-0">
              <PoblacionCentroPanel
                centro={centro}
                puedeEditar={puedeEditar}
                onRegistrar={() =>
                  setSearchParams({ vista: "poblacion", registrar: "1" }, { replace: true })
                }
                onAbrirRefugiado={abrirFichaRefugiado}
              />
            </TabsContent>

            {veCensoFicha && (
              <TabsContent value="censo_rapido" className="mt-0">
                <CensoCentroPanel
                  centroId={centro.id}
                  centroNombre={centro.nombre}
                  centro={centro}
                  sesion={sesion}
                />
              </TabsContent>
            )}

            <TabsContent value="reporte" className="mt-0">
              <SeccionReporteDiarioCentro
                centro={centro}
                puedeEditar={puedeEditar}
                puedeEditarPasado={puedeEditarPasado}
                variant="expandido"
                onAbrirReporte={puedeEditar ? abrirReporte : undefined}
                diaSeleccionado={diaReporte}
                onDiaChange={cambiarDiaReporte}
                ocultarCabecera
              />
            </TabsContent>

            <TabsContent value="incidencias" className="mt-0">
              <SeccionSeguimientoReportesCentro
                centro={centro}
                puedeEditar={puedeEditar}
                variant="expandido"
                onIrAReporte={puedeEditar ? abrirReporte : undefined}
              />
            </TabsContent>

            <TabsContent value="infraestructura" className="mt-0">
              <InfraestructuraCapacidadPanel
                centro={centro}
                puedeEditar={puedeEditar}
                onIrAReporte={puedeEditar ? abrirReporte : undefined}
              />
            </TabsContent>

            {veBuzonFicha && (
              <TabsContent value="buzon" className="mt-0">
                <BuzonCentroPanel centro={centro} sesion={sesion} />
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>
    </MarcoVista>
  );
}
