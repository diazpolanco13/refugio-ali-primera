// Vista completa de un campamento (`/centro/:id`): segmentada por pestañas
// (Resumen, Coordinación, Población, Reporte, Incidencias, Capacidad).
// El reporte diario y la edición del campamento se abren integrados en el mismo marco.
// Vive dentro del AppShell global, con sidebar y TopBar compartidos.

import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, LayoutGrid, Pencil, SearchX } from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { claveDia } from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useReportesCentros } from "@/data/useReportesCentros";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { Sesion } from "@/data/authSupabase";
import { puedeCrearCentros, puedeEditarCentro } from "@/domain/permisos";
import {
  estadoReporteDia,
  META_ESTADO_REPORTE,
  reporteDelDia,
} from "@/domain/reporteDiario";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BadgesEstadoCentro,
  SeccionCapacidadCentro,
  SeccionCoordinacionCentro,
  SeccionRequerimientosCentro,
  SeccionResponsablesCentro,
  SeccionSeguridadCentro,
} from "./DetalleCentro";
import { PoblacionCentroPanel } from "./PoblacionCentroPanel";
import { ResumenCentroPanel } from "./ResumenCentroPanel";
import { SeccionReporteDiarioCentro } from "./ReporteDiarioCentro";
import { SeccionIncidenciasCentro } from "./IncidenciasCentro";
import { SeccionInfraestructuraCentro } from "./InfraestructuraCentro";
import { cn } from "@/lib/utils";
import { CentroForm } from "./CentroForm";
import { ReporteDiarioForm } from "./ReporteDiarioForm";

interface Props {
  sesion: Sesion;
}

const SECCIONES = [
  { id: "resumen", label: "Resumen" },
  { id: "coordinacion", label: "Coordinación" },
  { id: "poblacion", label: "Población" },
  { id: "reporte", label: "Reporte" },
  { id: "incidencias", label: "Incidencias" },
  { id: "infraestructura", label: "Infraestructura" },
  { id: "capacidad", label: "Capacidad" },
] as const;

type SeccionFicha = (typeof SECCIONES)[number]["id"];

function esSeccionFicha(v: string | null): v is SeccionFicha {
  return SECCIONES.some((s) => s.id === v);
}

/** Ficha completa de un campamento transitorio. */
export function FichaCentroView({ sesion }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const seccionParam = searchParams.get("vista");
  const seccionActiva: SeccionFicha = esSeccionFicha(seccionParam) ? seccionParam : "resumen";
  const modoReporte = searchParams.get("reportar") === "1";
  const modoEditar = searchParams.get("editar") === "1";

  const hoyClave = useMemo(() => claveDia(Date.now()), []);

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

  const centro = useMemo(
    () => centros.find((c) => c.id === id) ?? null,
    [centros, id],
  );

  const puedeEditar = centro != null && puedeEditarCentro(sesion.user, centro.id);

  const reportesHoy = useReportesCentros({
    centroId: centro?.id,
    dia: hoyClave,
  });
  const snapshotsHoy = useOcupacionesCentros({
    centroId: centro?.id,
    desde: hoyClave,
  });
  const hoyEstado = useMemo(() => {
    if (!centro) return "pendiente" as const;
    const reporte = reporteDelDia(reportesHoy, centro.id, hoyClave);
    const parte = snapshotsHoy.some((s) => s.dia === hoyClave);
    return estadoReporteDia(reporte, parte);
  }, [centro, reportesHoy, snapshotsHoy, hoyClave]);

  function cambiarSeccion(vista: SeccionFicha) {
    setSearchParams(vista === "resumen" ? {} : { vista }, { replace: true });
  }

  function paramsFicha(extra?: Record<string, string>) {
    const base: Record<string, string> = {};
    if (seccionActiva !== "resumen") base.vista = seccionActiva;
    return { ...base, ...extra };
  }

  function abrirReporte() {
    setSearchParams({ vista: "reporte", reportar: "1" }, { replace: true });
  }

  function cerrarReporte() {
    setSearchParams({ vista: "reporte" }, { replace: true });
  }

  function abrirEditar() {
    setSearchParams(paramsFicha({ editar: "1" }), { replace: true });
  }

  function cerrarEditar() {
    setSearchParams(paramsFicha(), { replace: true });
  }

  // Si no puede editar, no mantener modos de edición en la URL.
  useEffect(() => {
    if (centro && !puedeEditar) {
      if (modoReporte) cerrarReporte();
      if (modoEditar) cerrarEditar();
    }
  }, [modoReporte, modoEditar, centro, puedeEditar]);

  if (!centro) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        {filasCentros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargando campamento…</p>
        ) : (
          <>
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">Campamento no encontrado</p>
            <p className="text-xs text-muted-foreground">
              El campamento solicitado no existe o fue eliminado de la red.
            </p>
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate("/centros/mapa")}>
          Ir al mapa
        </Button>
      </div>
    );
  }

  const titulo = `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`;
  const fechaHoy = new Date(`${hoyClave}T12:00:00`).toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const etiquetaBotonReporte =
    hoyEstado === "pendiente" ? "Reportar hoy" : "Editar reporte de hoy";

  if (modoEditar && puedeEditar) {
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
          titulo="Editar campamento"
          descripcion={titulo}
          acciones={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2"
              onClick={cerrarEditar}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Volver a la ficha</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          }
          debajo={<BadgesEstadoCentro centro={centro} />}
        />
        <CentroForm
          centro={centro}
          variant="integrado"
          puedeEliminar={puedeCrearCentros(sesion.user.rol)}
          onCerrar={cerrarEditar}
        />
      </MarcoVista>
    );
  }

  if (modoReporte && puedeEditar) {
    return (
      <MarcoVista
        ancho={ANCHO_VISTA_PRINCIPAL}
        rellenarAltura
        className="overflow-hidden"
        marcoClassName="flex min-h-0 flex-col text-foreground"
      >
        <VistaEncabezado
          icono={ClipboardCheck}
          acento="teal"
          titulo="Reporte del día"
          descripcion={`${titulo} · ${fechaHoy}`}
          acciones={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2"
              onClick={cerrarReporte}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Volver a la ficha</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          }
          debajo={
            hoyEstado !== "completo" ? (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-amber-500"
              >
                {META_ESTADO_REPORTE[hoyEstado].label}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-emerald-500/50 text-emerald-400"
              >
                Reporte completo
              </Badge>
            )
          }
        />
        <ReporteDiarioForm
          centro={centro}
          variant="integrado"
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
          <>
            <div className="hidden shrink-0 sm:block">
              <BadgesEstadoCentro centro={centro} />
            </div>
            {puedeEditar && (
              <Button
                size="sm"
                className="h-9 shrink-0 gap-1.5 bg-teal-600 px-3 hover:bg-teal-500"
                onClick={abrirReporte}
              >
                <ClipboardCheck className="size-4" />
                <span className="hidden sm:inline">{etiquetaBotonReporte}</span>
                <span className="sm:hidden">Reporte</span>
              </Button>
            )}
            {puedeEditar && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2"
                onClick={abrirEditar}
              >
                <Pencil className="size-3.5" />
                <span className="hidden sm:inline">Editar ficha</span>
              </Button>
            )}
          </>
        }
        debajo={
          <div className="flex flex-wrap items-center gap-2 sm:hidden">
            <BadgesEstadoCentro centro={centro} />
            {puedeEditar && hoyEstado !== "completo" && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                Reporte: {META_ESTADO_REPORTE[hoyEstado].label}
              </Badge>
            )}
          </div>
        }
      />

      <Tabs
        value={seccionActiva}
        onValueChange={(v) => cambiarSeccion(v as SeccionFicha)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Pestañas segmentadas — scroll horizontal en móvil */}
        <div className="h-[50px] shrink-0 border-b border-border bg-background/95 px-4 sm:px-6">
          <TabsList
            variant="line"
            className="!h-[50px] w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 align-middle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SECCIONES.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className={cn(
                  "shrink-0 rounded-none px-3 py-2.5 text-xs after:bottom-0 sm:text-sm",
                  s.id === "reporte" &&
                    puedeEditar &&
                    hoyEstado !== "completo" &&
                    "font-semibold text-teal-300",
                )}
              >
                {s.label}
                {s.id === "reporte" && puedeEditar && hoyEstado !== "completo" && (
                  <span className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-400" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
            <TabsContent value="resumen" className="mt-0">
              <ResumenCentroPanel
                centro={centro}
                onIrAPestana={(vista) => cambiarSeccion(vista)}
              />
            </TabsContent>

            <TabsContent value="coordinacion" className="mt-0 space-y-4">
              <SeccionCoordinacionCentro centro={centro} />
              <SeccionSeguridadCentro centro={centro} />
              <SeccionResponsablesCentro centro={centro} />
            </TabsContent>

            <TabsContent value="poblacion" className="mt-0">
              <PoblacionCentroPanel centro={centro} />
            </TabsContent>

            <TabsContent value="reporte" className="mt-0">
              <SeccionReporteDiarioCentro
                centro={centro}
                puedeEditar={puedeEditar}
                variant="expandido"
                onAbrirReporte={puedeEditar ? abrirReporte : undefined}
              />
            </TabsContent>

            <TabsContent value="incidencias" className="mt-0">
              <SeccionIncidenciasCentro
                centro={centro}
                puedeEditar={puedeEditar}
                variant="expandido"
              />
            </TabsContent>

            <TabsContent value="infraestructura" className="mt-0">
              <SeccionInfraestructuraCentro
                centro={centro}
                puedeEditar={puedeEditar}
                variant="expandido"
              />
            </TabsContent>

            <TabsContent value="capacidad" className="mt-0 space-y-4">
              <SeccionCapacidadCentro centro={centro} />
              <SeccionRequerimientosCentro centro={centro} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </MarcoVista>
  );
}
