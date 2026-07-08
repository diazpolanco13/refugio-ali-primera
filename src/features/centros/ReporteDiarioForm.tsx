// Formulario del REPORTE DEL DÍA (formato Telegram): 5 bloques —
// Parte, Control, Trabajos, Requerimientos, Novedades.

import { useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  Package,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  confirmarParteNumericoDia,
  eliminarParteNumericoDia,
  guardarCentro,
  claveDia,
} from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { guardarReporteDiario } from "@/data/reposReportes";
import { guardarReporteControlDia } from "@/data/reposControlReporte";
import { guardarEventosReporteDia } from "@/data/reposEventosReportes";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesControlDia } from "@/data/useReportesControlDia";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { construirContextoReporteHoy } from "@/domain/contextoReporteDiario";
import type { EventoReporte } from "@/domain/eventosReportes";
import {
  normalizarComidas,
  reporteDelDia,
} from "@/domain/reporteDiario";
import {
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { normalizarVulnerables, type Vulnerables } from "@/domain/tipos";
import type { ReporteControlDia } from "@/domain/controlReporte";
import { reporteControlDelDia } from "@/domain/controlReporte";
import { DesgloseDemografico } from "@/features/censo/DesgloseDemografico";
import { BloqueConfirmacionReporte } from "./BloqueConfirmacionReporte";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EventosReporteTab } from "./EventosReporteTab";
import { ControlReporteTab } from "./ControlReporteTab";
import { TrabajosReporteTab } from "./TrabajosReporteTab";
import { RequerimientosReporteTab } from "./RequerimientosReporteTab";
import { CasosSaludParte } from "./CasosSaludParte";
import { NavegacionFasesReporteMovil } from "./NavegacionFasesReporteMovil";
import { NavegacionFasesReporteDesktop } from "./NavegacionFasesReporteDesktop";
import {
  estadoFaseReporte,
  type FaseReporteNav,
} from "./ProgresoFasesReporte";

interface Props {
  centro: CentroTransitorio;
  variant?: "dialog" | "integrado";
  onCerrar: () => void;
  /** Día del reporte (YYYY-MM-DD). Por defecto: hoy. */
  diaReporte?: string;
  /** Pestaña con la que abre el formulario (parte, control, trabajos, requerimientos, novedades). */
  faseInicial?: string;
}

interface ParteForm {
  ocupacion: Vulnerables;
  totalAfectados: number;
  familias: number;
  incidenciasSalud: number;
}

function parteIgual(a: ParteForm, b: ParteForm): boolean {
  return (
    a.totalAfectados === b.totalAfectados &&
    a.familias === b.familias &&
    a.incidenciasSalud === b.incidenciasSalud &&
    JSON.stringify(a.ocupacion) === JSON.stringify(b.ocupacion)
  );
}

type ControlDatos = Pick<
  ReporteControlDia,
  | "captahuella"
  | "captahuella_nota"
  | "juez_paz"
  | "juez_paz_nota"
  | "servicio_medico"
  | "servicio_medico_nota"
  | "ambulancia"
  | "ambulancia_nota"
>;

function controlDatos(c: Omit<ReporteControlDia, "id">): ControlDatos {
  return {
    captahuella: c.captahuella,
    captahuella_nota: c.captahuella_nota,
    juez_paz: c.juez_paz,
    juez_paz_nota: c.juez_paz_nota,
    servicio_medico: c.servicio_medico,
    servicio_medico_nota: c.servicio_medico_nota,
    ambulancia: c.ambulancia,
    ambulancia_nota: c.ambulancia_nota,
  };
}

function controlIgual(a: ControlDatos, b: ControlDatos): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function eventosIguales(a: EventoReporte[], b: EventoReporte[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const PESTANAS_REPORTE: {
  value: string;
  titulo: string;
  etiquetaCorta?: string;
  icono: typeof Users;
}[] = [
  { value: "parte", titulo: "Parte", icono: Users },
  { value: "control", titulo: "Control", icono: ShieldCheck },
  { value: "trabajos", titulo: "Trabajos", icono: Wrench },
  { value: "requerimientos", titulo: "Requerimientos", etiquetaCorta: "Req.", icono: Package },
  { value: "novedades", titulo: "Novedades", etiquetaCorta: "Noved.", icono: CalendarPlus },
];

const ETIQUETAS_MOVIL: Record<string, string> = {
  parte: "Parte numérico",
  control: "Control operativo",
  trabajos: "Trabajos",
  requerimientos: "Requerimientos",
  novedades: "Novedades y eventos",
};

type GuardandoBloque = "parte" | "control" | "trabajos" | "requerimientos" | "eventos" | null;

export function ReporteDiarioForm({
  centro,
  variant = "dialog",
  onCerrar,
  diaReporte: diaReporteProp,
  faseInicial,
}: Props) {
  const base = normalizarCentro(centro);
  const diaReporte = diaReporteProp ?? claveDia(Date.now());
  const esDiaPasado = diaReporte !== claveDia(Date.now());

  const [ocupacion, setOcupacion] = useState<Vulnerables>(base.ocupacion);
  const [totalAfectados, setTotalAfectados] = useState(base.total_afectados);
  const [familias, setFamilias] = useState(base.familias_ocupadas);
  const [incidenciasSalud, setIncidenciasSalud] = useState(0);

  const [control, setControl] = useState<Omit<ReporteControlDia, "id">>({
    centro_id: centro.id,
    dia: diaReporte,
    captahuella: null,
    captahuella_nota: "",
    juez_paz: null,
    juez_paz_nota: "",
    servicio_medico: null,
    servicio_medico_nota: "",
    ambulancia: null,
    ambulancia_nota: "",
    revisado: false,
    updated_at: 0,
    updated_by: "",
  });
  const [controlHeredado, setControlHeredado] = useState(false);

  const [trabajosRevisados, setTrabajosRevisados] = useState(false);
  const [requerimientosRevisados, setRequerimientosRevisados] = useState(false);
  const [eventosReporte, setEventosReporte] = useState<EventoReporte[]>([]);
  const [eventosRevisados, setEventosRevisados] = useState(false);
  const [idsEventosExistentes, setIdsEventosExistentes] = useState<string[]>([]);
  const [eventosBorradorPendiente, setEventosBorradorPendiente] = useState(false);

  const [guardandoBloque, setGuardandoBloque] = useState<GuardandoBloque>(null);
  const [confirmandoParte, setConfirmandoParte] = useState(false);
  const [parteConfirmadoOk, setParteConfirmadoOk] = useState(false);
  const [parteDesmarcadoOk, setParteDesmarcadoOk] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [pestanaActiva, setPestanaActiva] = useState(() =>
    PESTANAS_REPORTE.some((p) => p.value === faseInicial) ? (faseInicial as string) : "parte",
  );
  const guardando = guardandoBloque !== null;

  const baselineParte = useRef<ParteForm>({
    ocupacion: base.ocupacion,
    totalAfectados: base.total_afectados,
    familias: base.familias_ocupadas,
    incidenciasSalud: 0,
  });

  const baselineControl = useRef<ControlDatos>(controlDatos({
    centro_id: centro.id,
    dia: diaReporte,
    captahuella: null,
    captahuella_nota: "",
    juez_paz: null,
    juez_paz_nota: "",
    servicio_medico: null,
    servicio_medico_nota: "",
    ambulancia: null,
    ambulancia_nota: "",
    revisado: false,
    updated_at: 0,
    updated_by: "",
  }));

  const baselineEventos = useRef<EventoReporte[]>([]);

  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde: diaReporte });
  const parteHoyEnBd = snapshots.some((s) => s.dia === diaReporte);
  const snapHoy = snapshots.find((s) => s.dia === diaReporte);

  const reportes = useReportesCentros({ centroId: centro.id, dia: diaReporte });
  const reporteExistente = reporteDelDia(reportes, centro.id, diaReporte);
  const controles = useReportesControlDia({ centroId: centro.id });
  const trabajos = useReparacionesCentros({ centroId: centro.id });
  const requerimientos = useRequerimientosSeguimiento({ centroId: centro.id });
  const casosSalud = useCasosSaludCentros({ centroId: centro.id });
  const eventosExistentes = useEventosReportes({ centroId: centro.id, dia: diaReporte });

  // Al corregir un día pasado, el parte se precarga desde el snapshot de ESE
  // día (no desde el estado vigente del centro).
  const parteInicializadoPasado = useRef(false);
  useEffect(() => {
    if (!esDiaPasado || parteInicializadoPasado.current || !snapHoy) return;
    const ocupacionDia = normalizarVulnerables(snapHoy.ocupacion);
    setOcupacion(ocupacionDia);
    setTotalAfectados(snapHoy.total_afectados);
    setFamilias(snapHoy.familias);
    baselineParte.current = {
      ocupacion: ocupacionDia,
      totalAfectados: snapHoy.total_afectados,
      familias: snapHoy.familias,
      incidenciasSalud: snapHoy.incidencias_salud ?? 0,
    };
    parteInicializadoPasado.current = true;
  }, [esDiaPasado, snapHoy]);

  const [contextoCargado, setContextoCargado] = useState(false);
  const incidenciasInicializado = useRef(false);

  useEffect(() => {
    if (contextoCargado) return;
    setContextoCargado(true);
  }, [contextoCargado]);

  // Herencia del control de ayer: los hooks llegan vacíos en el primer render
  // (select async), así que se reevalúa cada vez que `controles` carga o
  // cambia, hasta que el usuario toque el bloque o exista el control de HOY
  // en BD (ese caso lo cubre el efecto de `controlHoy` más abajo).
  const controlTocado = useRef(false);
  useEffect(() => {
    if (controlTocado.current || control.revisado) return;
    if (reporteControlDelDia(controles, centro.id, diaReporte)) return;
    const ctx = construirContextoReporteHoy({
      centroId: centro.id,
      hoyClave: diaReporte,
      snapshots,
      controles,
      trabajos,
      requerimientos,
      casosSalud,
    });
    setControl(ctx.controlBorrador);
    baselineControl.current = controlDatos(ctx.controlBorrador);
    setControlHeredado(ctx.controlHeredadoDeAyer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controles, centro.id, diaReporte]);

  useEffect(() => {
    if (incidenciasInicializado.current) return;
    if (snapHoy?.incidencias_salud != null) {
      setIncidenciasSalud(snapHoy.incidencias_salud);
      baselineParte.current.incidenciasSalud = snapHoy.incidencias_salud;
      incidenciasInicializado.current = true;
      return;
    }
    if (!contextoCargado) return;
    const ctx = construirContextoReporteHoy({
      centroId: centro.id,
      hoyClave: diaReporte,
      snapshots,
      controles,
      trabajos,
      requerimientos,
      casosSalud,
    });
    setIncidenciasSalud(ctx.incidenciasSalud);
    baselineParte.current.incidenciasSalud = ctx.incidenciasSalud;
    incidenciasInicializado.current = true;
  }, [
    snapHoy?.incidencias_salud,
    contextoCargado,
    centro.id,
    diaReporte,
    snapshots,
    controles,
    trabajos,
    requerimientos,
    casosSalud,
  ]);

  const [precargadoReporte, setPrecargadoReporte] = useState(false);
  useEffect(() => {
    if (precargadoReporte || !reporteExistente) return;
    setTrabajosRevisados(reporteExistente.trabajos_revisados);
    setRequerimientosRevisados(reporteExistente.requerimientos_revisados);
    setEventosRevisados(reporteExistente.eventos_revisados);
    setPrecargadoReporte(true);
  }, [precargadoReporte, reporteExistente]);

  const controlHoy = reporteControlDelDia(controles, centro.id, diaReporte);
  useEffect(() => {
    if (controlHoy && !control.revisado) {
      setControl({ ...controlHoy });
      baselineControl.current = controlDatos(controlHoy);
      setControlHeredado(false);
    }
  }, [controlHoy?.updated_at]);

  const [precargadoEventos, setPrecargadoEventos] = useState(false);
  useEffect(() => {
    if (precargadoEventos || eventosExistentes.length === 0) return;
    setEventosReporte(eventosExistentes);
    setIdsEventosExistentes(eventosExistentes.map((e) => e.id));
    baselineEventos.current = eventosExistentes;
    setPrecargadoEventos(true);
  }, [eventosExistentes, precargadoEventos]);

  const parteActual: ParteForm = {
    ocupacion,
    totalAfectados,
    familias,
    incidenciasSalud,
  };
  const parteModificado = !parteIgual(parteActual, baselineParte.current);
  const parteHoyConfirmado = !parteDesmarcadoOk && (parteHoyEnBd || parteConfirmadoOk);

  const controlModificado = !controlIgual(controlDatos(control), baselineControl.current);

  const eventosModificados =
    eventosBorradorPendiente || !eventosIguales(eventosReporte, baselineEventos.current);
  const novedadesCompletas =
    !eventosModificados &&
    (eventosRevisados || (eventosReporte.length > 0 && eventosIguales(eventosReporte, baselineEventos.current)));

  const fasesNav: FaseReporteNav[] = PESTANAS_REPORTE.map(({ value, titulo, icono }) => {
    const estado =
      value === "parte"
        ? estadoFaseReporte(parteHoyConfirmado, parteModificado)
        : value === "control"
          ? estadoFaseReporte(control.revisado, controlModificado)
          : value === "trabajos"
            ? trabajosRevisados
              ? "completa"
              : "pendiente"
            : value === "requerimientos"
              ? requerimientosRevisados
                ? "completa"
                : "pendiente"
              : novedadesCompletas
                ? "completa"
                : eventosModificados || eventosRevisados
                  ? "en_progreso"
                  : "pendiente";

    return {
      value,
      titulo,
      etiquetaMovil: ETIQUETAS_MOVIL[value] ?? titulo,
      icono,
      estado,
      completa: estado === "completa",
    };
  });

  const refugiados = poblacionCentro({ ...centro, ocupacion, total_afectados: totalAfectados });

  /**
   * Upsert de la fila del día preservando lo ya guardado (comidas, salud,
   * observaciones). Los flags de revisión aceptan `overrides` porque los
   * botones "Confirmar" del tab llaman a esto en el mismo tick en que marcan
   * el estado local (aún stale): el valor explícito gana sobre el useState.
   */
  async function guardarFlagsReporte(overrides?: {
    trabajos_revisados?: boolean;
    requerimientos_revisados?: boolean;
    eventos_revisados?: boolean;
  }): Promise<void> {
    await guardarReporteDiario({
      centro_id: centro.id,
      dia: diaReporte,
      comidas: normalizarComidas(reporteExistente?.comidas),
      atenciones_medicas_detalle: reporteExistente?.atenciones_medicas_detalle ?? [],
      atenciones_medicas: reporteExistente?.atenciones_medicas ?? 0,
      salud_reportada: reporteExistente?.salud_reportada ?? false,
      eventos_revisados:
        overrides?.eventos_revisados ?? (eventosRevisados || eventosReporte.length > 0),
      trabajos_revisados: overrides?.trabajos_revisados ?? trabajosRevisados,
      requerimientos_revisados: overrides?.requerimientos_revisados ?? requerimientosRevisados,
      observaciones: reporteExistente?.observaciones ?? "",
    });
  }

  async function guardarParte() {
    setErrorGuardado(null);
    setConfirmandoParte(true);
    try {
      const centroActualizado = {
        ...centro,
        ocupacion,
        total_afectados: totalAfectados,
        familias_ocupadas: familias,
      };
      if (esDiaPasado) {
        // Corrección histórica: solo el snapshot de ese día; el estado
        // vigente del centro no se toca.
        await confirmarParteNumericoDia(centroActualizado, diaReporte, {
          incidenciasSalud,
          omitirPersonal: true,
          soloSnapshot: true,
        });
      } else if (parteModificado) {
        await guardarCentro(centroActualizado);
        await confirmarParteNumericoDia(centroActualizado, diaReporte, {
          incidenciasSalud,
          omitirPersonal: true,
          soloSnapshot: true,
        });
      } else {
        await confirmarParteNumericoDia(centroActualizado, diaReporte, {
          incidenciasSalud,
          omitirPersonal: true,
        });
      }
      baselineParte.current = { ...parteActual };
      setParteConfirmadoOk(true);
      setParteDesmarcadoOk(false);
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando parte:", err);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar el parte.");
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function desmarcarParte() {
    setErrorGuardado(null);
    setConfirmandoParte(true);
    try {
      await eliminarParteNumericoDia(centro.id, diaReporte);
      setParteConfirmadoOk(false);
      setParteDesmarcadoOk(true);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar el parte.");
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function guardarControl() {
    setErrorGuardado(null);
    setGuardandoBloque("control");
    try {
      await guardarReporteControlDia({ ...control, revisado: true });
      const actualizado = { ...control, revisado: true };
      setControl(actualizado);
      baselineControl.current = controlDatos(actualizado);
      setControlHeredado(false);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar control.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarControl() {
    setErrorGuardado(null);
    setGuardandoBloque("control");
    try {
      await guardarReporteControlDia({ ...control, revisado: false });
      setControl((p) => ({ ...p, revisado: false }));
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar control.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarTrabajosRevision() {
    setGuardandoBloque("trabajos");
    try {
      await guardarFlagsReporte({ trabajos_revisados: true });
      setTrabajosRevisados(true);
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarTrabajosRevision() {
    setGuardandoBloque("trabajos");
    try {
      await guardarFlagsReporte({ trabajos_revisados: false });
      setTrabajosRevisados(false);
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarRequerimientosRevision() {
    setGuardandoBloque("requerimientos");
    try {
      await guardarFlagsReporte({ requerimientos_revisados: true });
      setRequerimientosRevisados(true);
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarRequerimientosRevision() {
    setGuardandoBloque("requerimientos");
    try {
      await guardarFlagsReporte({ requerimientos_revisados: false });
      setRequerimientosRevisados(false);
    } finally {
      setGuardandoBloque(null);
    }
  }

  /** Confirma revisión de novedades (con o sin eventos) y persiste al instante. */
  async function confirmarNovedades() {
    if (eventosModificados) {
      await guardarEventos();
      return;
    }
    if (eventosReporte.length === 0) {
      await confirmarRevisionEventos(true);
      return;
    }
    await guardarEventos();
  }

  async function confirmarRevisionEventos(valor: boolean) {
    setEventosRevisados(valor);
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    try {
      await guardarFlagsReporte({ eventos_revisados: valor });
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar la revisión.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarEventos() {
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    try {
      await guardarFlagsReporte({ eventos_revisados: true });
      setEventosRevisados(true);
      await guardarEventosReporteDia({
        centro_id: centro.id,
        dia: diaReporte,
        eventos: eventosReporte,
        idsExistentes: idsEventosExistentes,
      });
      setIdsEventosExistentes(eventosReporte.map((e) => e.id));
      baselineEventos.current = eventosReporte;
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar novedades.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarNovedades() {
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    try {
      await guardarFlagsReporte({ eventos_revisados: false });
      setEventosRevisados(false);
    } catch (err) {
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar novedades.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  const descripcionFecha = new Date(`${diaReporte}T12:00:00`).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
  });

  const pieFormulario = (
    <div
      className={cn(
        "hidden shrink-0 flex-wrap items-center gap-2 border-t border-border/80 bg-background/95 px-4 py-4 backdrop-blur-sm sm:flex sm:px-6",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
      )}
    >
      {errorGuardado && (
        <p className="w-full text-xs leading-snug text-destructive">{errorGuardado}</p>
      )}
      <Button variant="outline" onClick={onCerrar} disabled={guardando || confirmandoParte}>
        Cerrar
      </Button>
    </div>
  );

  const cuerpoFormulario = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={pestanaActiva}
        onValueChange={setPestanaActiva}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <NavegacionFasesReporteDesktop fases={fasesNav} faseActiva={pestanaActiva} />

        <div
          className={cn(
            "relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 py-3 sm:px-6 sm:py-5",
            "pb-4 sm:pb-5",
          )}
        >
          {errorGuardado && (
            <p className="mb-3 text-xs leading-snug text-destructive sm:hidden">{errorGuardado}</p>
          )}
          <TabsContent value="parte" className="mt-0 block flex-none space-y-5 outline-none">
            <BloqueConfirmacionReporte
              titulo="Parte de hoy"
              tituloRevisado="Parte confirmado hoy"
              descripcion="Demografía, afectados/familias e incidencias de salud del día."
              icono={Users}
              acento="teal"
              revisado={parteHoyConfirmado}
              modificado={parteModificado}
              guardando={confirmandoParte}
              deshabilitado={guardando}
              onConfirmar={() => void guardarParte()}
              onDesmarcar={() => void desmarcarParte()}
              etiquetaGuardar="Guardar parte"
              etiquetaConfirmar="Confirmar sin cambios"
              etiquetaActualizar="Actualizar parte"
            />

            <div>
              <Label className="text-sm font-semibold">Población afectada</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Damnificados:{" "}
                <span className="font-semibold text-foreground">{refugiados.toLocaleString("es")}</span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="reporte-afectados" className="text-[11px] text-muted-foreground">
                    Cantidad de afectados
                  </Label>
                  <NumInput id="reporte-afectados" className="mt-1" value={totalAfectados} onChange={setTotalAfectados} />
                </div>
                <div>
                  <Label htmlFor="reporte-familias" className="text-[11px] text-muted-foreground">
                    N.° de familias
                  </Label>
                  <NumInput id="reporte-familias" className="mt-1" value={familias} onChange={setFamilias} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Desglose por edad y sexo</Label>
              <div className="mt-3">
                <DesgloseDemografico
                  vulnerables={ocupacion}
                  onCampo={(campo, valor) => setOcupacion((prev) => ({ ...prev, [campo]: valor }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="incidencias-salud" className="text-sm font-semibold">
                Incidencias de salud (hoy)
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Conteo manual reportado por el supervisor para el día.
              </p>
              <NumInput
                id="incidencias-salud"
                className="mt-2 max-w-[8rem]"
                value={incidenciasSalud}
                onChange={setIncidenciasSalud}
              />
            </div>

            <CasosSaludParte
              centroId={centro.id}
              hoyClave={diaReporte}
              incidenciasSalud={incidenciasSalud}
              deshabilitado={guardando || confirmandoParte}
            />
          </TabsContent>

          <TabsContent value="control" className="mt-0 block flex-none outline-none">
            <ControlReporteTab
              control={control}
              heredadoDeAyer={controlHeredado}
              revisado={control.revisado}
              modificado={controlModificado}
              onChange={(patch) => {
                controlTocado.current = true;
                setControl((p) => ({ ...p, ...patch }));
              }}
              onConfirmarRevision={() => void guardarControl()}
              onDesmarcarRevision={() => void desmarcarControl()}
              deshabilitado={guardando || confirmandoParte}
              guardando={guardandoBloque === "control"}
            />
          </TabsContent>

          <TabsContent value="trabajos" className="mt-0 block flex-none outline-none">
            <TrabajosReporteTab
              centroId={centro.id}
              hoyClave={diaReporte}
              revisado={trabajosRevisados}
              onConfirmarRevision={guardarTrabajosRevision}
              onDesmarcarRevision={desmarcarTrabajosRevision}
              deshabilitado={guardando || confirmandoParte}
              guardando={guardandoBloque === "trabajos"}
            />
          </TabsContent>

          <TabsContent value="requerimientos" className="mt-0 block flex-none outline-none">
            <RequerimientosReporteTab
              centroId={centro.id}
              hoyClave={diaReporte}
              revisado={requerimientosRevisados}
              onConfirmarRevision={guardarRequerimientosRevision}
              onDesmarcarRevision={desmarcarRequerimientosRevision}
              deshabilitado={guardando || confirmandoParte}
              guardando={guardandoBloque === "requerimientos"}
            />
          </TabsContent>

          <TabsContent value="novedades" className="mt-0 block flex-none space-y-3 outline-none">
            <EventosReporteTab
              centroId={centro.id}
              dia={diaReporte}
              eventos={eventosReporte}
              eventosRevisados={eventosRevisados}
              modificado={eventosModificados}
              onEventosChange={setEventosReporte}
              onEventosRevisadosChange={setEventosRevisados}
              onBorradorPendienteChange={setEventosBorradorPendiente}
              onConfirmarRevision={() => void confirmarNovedades()}
              onDesmarcarRevision={() => void desmarcarNovedades()}
              deshabilitado={guardando || confirmandoParte}
              guardando={guardandoBloque === "eventos"}
            />
          </TabsContent>
        </div>

        <div
          className={cn(
            "relative z-40 shrink-0 sm:hidden",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <NavegacionFasesReporteMovil fases={fasesNav} faseActiva={pestanaActiva} />
        </div>
      </Tabs>
      {pieFormulario}
    </div>
  );

  if (variant === "integrado") return cuerpoFormulario;

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent
        className="flex h-[96dvh] max-h-[96dvh] flex-col gap-0 bg-background p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl"
        overlayClassName="bg-black"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/80 bg-background px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg">Reporte del día</DialogTitle>
          <DialogDescription className="text-sm">
            N.° {centro.nro} · {centro.nombre} · {descripcionFecha}
          </DialogDescription>
        </DialogHeader>
        {cuerpoFormulario}
      </DialogContent>
    </Dialog>
  );
}
