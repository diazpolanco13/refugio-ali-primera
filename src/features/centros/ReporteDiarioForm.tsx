// Formulario del REPORTE DEL DÍA (formato Telegram): 6 bloques —
// Parte, Salud, Control, Trabajos, Requerimientos, Novedades.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  Package,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from "lucide-react";
import {
  confirmarParteNumericoDia,
  eliminarParteNumericoDia,
  guardarCentro,
  guardarIncidenciasSaludDia,
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
  ultimosDiasReporte,
} from "@/domain/reporteDiario";
import { ocupacionAlineadaAlTotal } from "@/domain/parteActualCentros";
import {
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { type Vulnerables } from "@/domain/tipos";
import type { ReporteControlDia } from "@/domain/controlReporte";
import { CONTROL_VACIO, reporteControlDelDia } from "@/domain/controlReporte";
import { DesgloseDemografico } from "@/features/censo/DesgloseDemografico";
import { BloqueConfirmacionReporte } from "./BloqueConfirmacionReporte";
import { ultimoSnapshotAntes } from "./ParteNumericoResumen";
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
import { DialogReporteCompleto } from "./DialogReporteCompleto";
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
  /** Pestaña con la que abre el formulario (parte, salud, control, trabajos, requerimientos, novedades). */
  faseInicial?: string;
  /** Oculta el botón «Cerrar» del pie (operador de terreno bloqueado en el parte). */
  ocultarCerrar?: boolean;
  /** Etiqueta del botón cerrar (p. ej. «Volver al portal»). */
  etiquetaCerrar?: string;
  /**
   * Si es false, no se permiten mutaciones en días distintos de hoy
   * (admin/analista SAE pasan true vía `puedeEditarReportesPasados`).
   */
  permitirDiaPasado?: boolean;
  /** Notifica al padre el progreso local (para el badge Completo sin esperar Realtime). */
  onProgresoChange?: (progreso: {
    completas: number;
    total: number;
    completo: boolean;
  }) => void;
}

interface ParteForm {
  ocupacion: Vulnerables;
  totalAfectados: number;
  familias: number;
}

function parteIgual(a: ParteForm, b: ParteForm): boolean {
  return (
    a.totalAfectados === b.totalAfectados &&
    a.familias === b.familias &&
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
  { value: "salud", titulo: "Salud", icono: Stethoscope },
  { value: "control", titulo: "Control", icono: ShieldCheck },
  { value: "trabajos", titulo: "Trabajos", icono: Wrench },
  { value: "requerimientos", titulo: "Requerimientos", etiquetaCorta: "Req.", icono: Package },
  { value: "novedades", titulo: "Novedades", etiquetaCorta: "Noved.", icono: CalendarPlus },
];

const ETIQUETAS_MOVIL: Record<string, string> = {
  parte: "Parte numérico",
  salud: "Incidencias de salud",
  control: "Control operativo",
  trabajos: "Trabajos",
  requerimientos: "Requerimientos",
  novedades: "Novedades y eventos",
};

type GuardandoBloque =
  | "parte"
  | "salud"
  | "control"
  | "trabajos"
  | "requerimientos"
  | "eventos"
  | null;

export function ReporteDiarioForm({
  centro,
  variant = "dialog",
  onCerrar,
  diaReporte: diaReporteProp,
  faseInicial,
  ocultarCerrar = false,
  etiquetaCerrar = "Cerrar",
  permitirDiaPasado = false,
  onProgresoChange,
}: Props) {
  const base = normalizarCentro(centro);
  const diaReporte = diaReporteProp ?? claveDia(Date.now());
  const esDiaPasado = diaReporte !== claveDia(Date.now());
  const edicionPasadoBloqueada = esDiaPasado && !permitirDiaPasado;

  const [ocupacion, setOcupacion] = useState<Vulnerables>(base.ocupacion);
  const [totalAfectados, setTotalAfectados] = useState(base.total_afectados);
  const [familias, setFamilias] = useState(base.familias_ocupadas);
  const [incidenciasSalud, setIncidenciasSalud] = useState(0);

  const [control, setControl] = useState<Omit<ReporteControlDia, "id">>({
    ...CONTROL_VACIO,
    centro_id: centro.id,
    dia: diaReporte,
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
  const [confirmandoSalud, setConfirmandoSalud] = useState(false);
  const [parteConfirmadoOk, setParteConfirmadoOk] = useState(false);
  const [parteDesmarcadoOk, setParteDesmarcadoOk] = useState(false);
  const [saludConfirmadaOk, setSaludConfirmadaOk] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [mostrarReporteCompleto, setMostrarReporteCompleto] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState(() =>
    PESTANAS_REPORTE.some((p) => p.value === faseInicial) ? (faseInicial as string) : "parte",
  );
  const guardando = guardandoBloque !== null || confirmandoSalud;
  const ocupadoGuardando = guardando || confirmandoParte;
  const ocupadoPrevioRef = useRef(false);

  const baselineParte = useRef<ParteForm>({
    ocupacion: base.ocupacion,
    totalAfectados: base.total_afectados,
    familias: base.familias_ocupadas,
  });
  const baselineIncidenciasSalud = useRef(0);

  const baselineControl = useRef<ControlDatos>(
    controlDatos({
      ...CONTROL_VACIO,
      centro_id: centro.id,
      dia: diaReporte,
    }),
  );

  const baselineEventos = useRef<EventoReporte[]>([]);

  // Ventana fija (no depende del día seleccionado): al navegar entre fechas el
  // parte del día ya está en memoria y no hay hueco async que deje el formulario
  // pegado al estado vigente del campamento.
  const hoyClaveForm = useMemo(() => claveDia(Date.now()), []);
  const desdeVentana = useMemo(
    () => ultimosDiasReporte(40, hoyClaveForm)[0],
    [hoyClaveForm],
  );
  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde: desdeVentana });
  const parteHoyEnBd = snapshots.some((s) => s.dia === diaReporte);
  const snapHoy = snapshots.find((s) => s.dia === diaReporte);

  const reportes = useReportesCentros({ centroId: centro.id, dia: diaReporte });
  const reporteExistente = reporteDelDia(reportes, centro.id, diaReporte);
  const controles = useReportesControlDia({ centroId: centro.id });
  const { trabajos } = useReparacionesCentros({ centroId: centro.id });
  const { requerimientos } = useRequerimientosSeguimiento({ centroId: centro.id });
  const { casos: casosSalud } = useCasosSaludCentros({ centroId: centro.id });
  const { eventos: eventosExistentes } = useEventosReportes({ centroId: centro.id, dia: diaReporte });

  // Día cuya demografía ya se cargó en el formulario. Se resetea al cambiar
  // `diaReporte` para que flechas/calendario recarguen el parte de ESE día.
  const parteDiaSincronizado = useRef<string | null>(null);
  const incidenciasInicializado = useRef(false);
  const controlTocado = useRef(false);
  const [contextoCargado, setContextoCargado] = useState(false);
  const [precargadoReporte, setPrecargadoReporte] = useState(false);
  const [precargadoEventos, setPrecargadoEventos] = useState(false);

  useEffect(() => {
    parteDiaSincronizado.current = null;
    incidenciasInicializado.current = false;
    controlTocado.current = false;
    setMostrarReporteCompleto(false);
    setPrecargadoReporte(false);
    setPrecargadoEventos(false);
    setParteConfirmadoOk(false);
    setParteDesmarcadoOk(false);
    setSaludConfirmadaOk(false);
    setEventosBorradorPendiente(false);
    setEventosReporte([]);
    setIdsEventosExistentes([]);
    setTrabajosRevisados(false);
    setRequerimientosRevisados(false);
    setEventosRevisados(false);
    setControl({
      ...CONTROL_VACIO,
      centro_id: centro.id,
      dia: diaReporte,
    });
    baselineControl.current = controlDatos({
      ...CONTROL_VACIO,
      centro_id: centro.id,
      dia: diaReporte,
    });
    setControlHeredado(false);
    baselineEventos.current = [];
  }, [diaReporte, centro.id]);

  // Precarga el parte del día seleccionado (snapshot de ese día; si no hay,
  // carry-forward del anterior en días pasados; hoy sin snapshot → centro).
  useEffect(() => {
    if (parteDiaSincronizado.current === diaReporte) return;

    if (snapHoy) {
      const ocupacionDia = ocupacionAlineadaAlTotal(
        snapHoy.ocupacion,
        snapHoy.total_afectados,
      );
      setOcupacion(ocupacionDia);
      setTotalAfectados(snapHoy.total_afectados);
      setFamilias(snapHoy.familias);
      baselineParte.current = {
        ocupacion: ocupacionDia,
        totalAfectados: snapHoy.total_afectados,
        familias: snapHoy.familias,
      };
      parteDiaSincronizado.current = diaReporte;
      return;
    }

    // Esperar la 1ª carga de la ventana: lista vacía = aún no llegó el select.
    if (snapshots.length === 0) return;

    if (!esDiaPasado) {
      baselineParte.current = {
        ocupacion: base.ocupacion,
        totalAfectados: base.total_afectados,
        familias: base.familias_ocupadas,
      };
      setOcupacion(base.ocupacion);
      setTotalAfectados(base.total_afectados);
      setFamilias(base.familias_ocupadas);
      parteDiaSincronizado.current = diaReporte;
      return;
    }

    const previo = ultimoSnapshotAntes(snapshots, diaReporte);
    if (previo) {
      const ocupacionDia = ocupacionAlineadaAlTotal(
        previo.ocupacion,
        previo.total_afectados,
      );
      setOcupacion(ocupacionDia);
      setTotalAfectados(previo.total_afectados);
      setFamilias(previo.familias);
      baselineParte.current = {
        ocupacion: ocupacionDia,
        totalAfectados: previo.total_afectados,
        familias: previo.familias,
      };
    } else {
      setOcupacion(base.ocupacion);
      setTotalAfectados(base.total_afectados);
      setFamilias(base.familias_ocupadas);
      baselineParte.current = {
        ocupacion: base.ocupacion,
        totalAfectados: base.total_afectados,
        familias: base.familias_ocupadas,
      };
    }
    parteDiaSincronizado.current = diaReporte;
  }, [
    diaReporte,
    snapHoy,
    snapshots,
    esDiaPasado,
    base.ocupacion,
    base.total_afectados,
    base.familias_ocupadas,
  ]);

  useEffect(() => {
    if (contextoCargado) return;
    setContextoCargado(true);
  }, [contextoCargado]);

  // Herencia del control de ayer: los hooks llegan vacíos en el primer render
  // (select async), así que se reevalúa cada vez que `controles` carga o
  // cambia, hasta que el usuario toque el bloque o exista el control de HOY
  // en BD (ese caso lo cubre el efecto de `controlHoy` más abajo).
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
      baselineIncidenciasSalud.current = snapHoy.incidencias_salud;
      if (snapHoy.incidencias_salud > 0 || (reporteExistente?.salud_reportada ?? false)) {
        setSaludConfirmadaOk(true);
      }
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
    baselineIncidenciasSalud.current = ctx.incidenciasSalud;
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
    reporteExistente?.salud_reportada,
  ]);

  useEffect(() => {
    if (precargadoReporte || !reporteExistente) return;
    setTrabajosRevisados(reporteExistente.trabajos_revisados);
    setRequerimientosRevisados(reporteExistente.requerimientos_revisados);
    setEventosRevisados(reporteExistente.eventos_revisados);
    if (reporteExistente.salud_reportada) setSaludConfirmadaOk(true);
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
  };
  const parteModificado = !parteIgual(parteActual, baselineParte.current);
  const parteHoyConfirmado = !parteDesmarcadoOk && (parteHoyEnBd || parteConfirmadoOk);
  const saludModificada = incidenciasSalud !== baselineIncidenciasSalud.current;
  const saludHoyConfirmada =
    saludConfirmadaOk ||
    (reporteExistente?.salud_reportada ?? false) ||
    (snapHoy != null && (snapHoy.incidencias_salud ?? 0) > 0 && !saludModificada);

  const controlModificado = !controlIgual(controlDatos(control), baselineControl.current);

  const eventosModificados =
    eventosBorradorPendiente || !eventosIguales(eventosReporte, baselineEventos.current);
  // Solo el flag explícito: si hay eventos pero el operador desmarcó, la fase
  // vuelve a pendiente (antes `length > 0` la dejaba “completa” al desmarcar).
  const novedadesCompletas = !eventosModificados && eventosRevisados;

  const fasesNav: FaseReporteNav[] = PESTANAS_REPORTE.map(({ value, titulo, icono }) => {
    const estado =
      value === "parte"
        ? estadoFaseReporte(parteHoyConfirmado, parteModificado)
        : value === "salud"
          ? estadoFaseReporte(saludHoyConfirmada, saludModificada)
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

  const completasNav = fasesNav.filter((f) => f.completa).length;
  const reporteFormCompleto = completasNav === fasesNav.length && fasesNav.length > 0;
  useEffect(() => {
    onProgresoChange?.({
      completas: completasNav,
      total: fasesNav.length,
      completo: reporteFormCompleto,
    });
  }, [completasNav, fasesNav.length, reporteFormCompleto, onProgresoChange]);

  // Celebra al terminar un guardado que deja el reporte 6/6 (no al abrir día ya completo).
  useEffect(() => {
    const estabaOcupado = ocupadoPrevioRef.current;
    ocupadoPrevioRef.current = ocupadoGuardando;
    if (estabaOcupado && !ocupadoGuardando && reporteFormCompleto) {
      setMostrarReporteCompleto(true);
    }
  }, [ocupadoGuardando, reporteFormCompleto]);

  const refugiados = poblacionCentro({ ...centro, ocupacion, total_afectados: totalAfectados });

  /**
   * Upsert de la fila del día preservando lo ya guardado (comidas, salud,
   * observaciones). Los flags de revisión aceptan `overrides` porque los
   * botones "Confirmar" del tab llaman a esto en el mismo tick en que marcan
   * el estado local (aún stale): el valor explícito gana sobre el useState.
   */
  const MSG_PASADO_BLOQUEADO =
    "Solo admin y analista SAE pueden editar reportes de fechas pasadas.";

  function bloquearSiPasado(): boolean {
    if (!edicionPasadoBloqueada) return false;
    setErrorGuardado(MSG_PASADO_BLOQUEADO);
    return true;
  }

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
    toques?: ("salud" | "trabajos" | "requerimientos" | "eventos")[];
  }): Promise<void> {
    if (edicionPasadoBloqueada) {
      throw new Error(MSG_PASADO_BLOQUEADO);
    }
    await guardarReporteDiario({
      centro_id: centro.id,
      dia: diaReporte,
      comidas: normalizarComidas(reporteExistente?.comidas),
      atenciones_medicas_detalle: reporteExistente?.atenciones_medicas_detalle ?? [],
      atenciones_medicas: reporteExistente?.atenciones_medicas ?? 0,
      // Preferir estado local: tras confirmar salud, Realtime puede ir atrasado.
      salud_reportada:
        saludConfirmadaOk ||
        (reporteExistente?.salud_reportada ?? false) ||
        (snapHoy != null && (snapHoy.incidencias_salud ?? 0) > 0),
      eventos_revisados: overrides?.eventos_revisados ?? eventosRevisados,
      trabajos_revisados: overrides?.trabajos_revisados ?? trabajosRevisados,
      requerimientos_revisados: overrides?.requerimientos_revisados ?? requerimientosRevisados,
      observaciones: reporteExistente?.observaciones ?? "",
      toques: overrides?.toques,
    });
  }

  async function guardarParte() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setConfirmandoParte(true);
    const prevConfirmado = parteConfirmadoOk;
    const prevDesmarcado = parteDesmarcadoOk;
    const prevBaseline = baselineParte.current;
    baselineParte.current = { ...parteActual };
    setParteConfirmadoOk(true);
    setParteDesmarcadoOk(false);
    try {
      const centroActualizado = {
        ...centro,
        ocupacion,
        total_afectados: totalAfectados,
        familias_ocupadas: familias,
      };
      // Conserva el conteo de salud ya guardado en el snapshot (vive en su pestaña).
      const incidenciasSnapshot = snapHoy?.incidencias_salud ?? incidenciasSalud;
      if (esDiaPasado) {
        await confirmarParteNumericoDia(centroActualizado, diaReporte, {
          incidenciasSalud: incidenciasSnapshot,
          omitirPersonal: true,
          soloSnapshot: true,
        });
      } else if (parteModificado) {
        await guardarCentro(centroActualizado);
        await confirmarParteNumericoDia(centroActualizado, diaReporte, {
          incidenciasSalud: incidenciasSnapshot,
          omitirPersonal: true,
          soloSnapshot: true,
        });
      } else {
        await confirmarParteNumericoDia(centroActualizado, diaReporte, {
          incidenciasSalud: incidenciasSnapshot,
          omitirPersonal: true,
        });
      }
    } catch (err) {
      baselineParte.current = prevBaseline;
      setParteConfirmadoOk(prevConfirmado);
      setParteDesmarcadoOk(prevDesmarcado);
      console.error("[ReporteDiarioForm] error guardando parte:", err);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar el parte.");
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function guardarSalud() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setConfirmandoSalud(true);
    // Optimista: el icono/progreso y el badge del padre no deben esperar Realtime.
    const prevConfirmada = saludConfirmadaOk;
    baselineIncidenciasSalud.current = incidenciasSalud;
    setSaludConfirmadaOk(true);
    try {
      await guardarIncidenciasSaludDia(centro, diaReporte, incidenciasSalud);
      await guardarReporteDiario({
        centro_id: centro.id,
        dia: diaReporte,
        comidas: normalizarComidas(reporteExistente?.comidas),
        atenciones_medicas_detalle: reporteExistente?.atenciones_medicas_detalle ?? [],
        atenciones_medicas: reporteExistente?.atenciones_medicas ?? 0,
        salud_reportada: true,
        eventos_revisados: eventosRevisados,
        trabajos_revisados: trabajosRevisados,
        requerimientos_revisados: requerimientosRevisados,
        observaciones: reporteExistente?.observaciones ?? "",
        toques: ["salud"],
      });
    } catch (err) {
      setSaludConfirmadaOk(prevConfirmada);
      console.error("[ReporteDiarioForm] error guardando salud:", err);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo guardar las incidencias de salud.",
      );
    } finally {
      setConfirmandoSalud(false);
    }
  }

  async function desmarcarSalud() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setConfirmandoSalud(true);
    const prevConfirmada = saludConfirmadaOk;
    setSaludConfirmadaOk(false);
    try {
      await guardarReporteDiario({
        centro_id: centro.id,
        dia: diaReporte,
        comidas: normalizarComidas(reporteExistente?.comidas),
        atenciones_medicas_detalle: reporteExistente?.atenciones_medicas_detalle ?? [],
        atenciones_medicas: reporteExistente?.atenciones_medicas ?? 0,
        salud_reportada: false,
        eventos_revisados: eventosRevisados,
        trabajos_revisados: trabajosRevisados,
        requerimientos_revisados: requerimientosRevisados,
        observaciones: reporteExistente?.observaciones ?? "",
        toques: ["salud"],
      });
    } catch (err) {
      setSaludConfirmadaOk(prevConfirmada);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo desmarcar la revisión de salud.",
      );
    } finally {
      setConfirmandoSalud(false);
    }
  }

  async function desmarcarParte() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setConfirmandoParte(true);
    const prevConfirmado = parteConfirmadoOk;
    const prevDesmarcado = parteDesmarcadoOk;
    setParteConfirmadoOk(false);
    setParteDesmarcadoOk(true);
    try {
      await eliminarParteNumericoDia(centro.id, diaReporte);
    } catch (err) {
      setParteConfirmadoOk(prevConfirmado);
      setParteDesmarcadoOk(prevDesmarcado);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar el parte.");
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function guardarControl() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setGuardandoBloque("control");
    const prevControl = control;
    const prevBaseline = baselineControl.current;
    const prevHeredado = controlHeredado;
    const actualizado = { ...control, revisado: true };
    setControl(actualizado);
    baselineControl.current = controlDatos(actualizado);
    setControlHeredado(false);
    try {
      await guardarReporteControlDia(actualizado);
    } catch (err) {
      setControl(prevControl);
      baselineControl.current = prevBaseline;
      setControlHeredado(prevHeredado);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar control.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarControl() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setGuardandoBloque("control");
    const prevRevisado = control.revisado;
    setControl((p) => ({ ...p, revisado: false }));
    try {
      await guardarReporteControlDia({ ...control, revisado: false });
    } catch (err) {
      setControl((p) => ({ ...p, revisado: prevRevisado }));
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar control.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarTrabajosRevision() {
    if (bloquearSiPasado()) return;
    setGuardandoBloque("trabajos");
    const prev = trabajosRevisados;
    setTrabajosRevisados(true);
    try {
      await guardarFlagsReporte({ trabajos_revisados: true, toques: ["trabajos"] });
    } catch (err) {
      setTrabajosRevisados(prev);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo confirmar trabajos.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarTrabajosRevision() {
    if (bloquearSiPasado()) return;
    setGuardandoBloque("trabajos");
    const prev = trabajosRevisados;
    setTrabajosRevisados(false);
    try {
      await guardarFlagsReporte({ trabajos_revisados: false, toques: ["trabajos"] });
    } catch (err) {
      setTrabajosRevisados(prev);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar trabajos.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarRequerimientosRevision() {
    if (bloquearSiPasado()) return;
    setGuardandoBloque("requerimientos");
    const prev = requerimientosRevisados;
    setRequerimientosRevisados(true);
    try {
      await guardarFlagsReporte({ requerimientos_revisados: true, toques: ["requerimientos"] });
    } catch (err) {
      setRequerimientosRevisados(prev);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo confirmar requerimientos.",
      );
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarRequerimientosRevision() {
    if (bloquearSiPasado()) return;
    setGuardandoBloque("requerimientos");
    const prev = requerimientosRevisados;
    setRequerimientosRevisados(false);
    try {
      await guardarFlagsReporte({ requerimientos_revisados: false, toques: ["requerimientos"] });
    } catch (err) {
      setRequerimientosRevisados(prev);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo desmarcar requerimientos.",
      );
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
    if (bloquearSiPasado()) return;
    const prev = eventosRevisados;
    setEventosRevisados(valor);
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    try {
      await guardarFlagsReporte({ eventos_revisados: valor, toques: ["eventos"] });
    } catch (err) {
      setEventosRevisados(prev);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar la revisión.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarEventos() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    const prevRevisados = eventosRevisados;
    const prevBaseline = baselineEventos.current;
    const prevIds = idsEventosExistentes;
    setEventosRevisados(true);
    baselineEventos.current = eventosReporte;
    try {
      await guardarFlagsReporte({ eventos_revisados: true, toques: ["eventos"] });
      await guardarEventosReporteDia({
        centro_id: centro.id,
        dia: diaReporte,
        eventos: eventosReporte,
        idsExistentes: idsEventosExistentes,
      });
      setIdsEventosExistentes(eventosReporte.map((e) => e.id));
    } catch (err) {
      setEventosRevisados(prevRevisados);
      baselineEventos.current = prevBaseline;
      setIdsEventosExistentes(prevIds);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar novedades.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function desmarcarNovedades() {
    if (bloquearSiPasado()) return;
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    const prev = eventosRevisados;
    setEventosRevisados(false);
    try {
      await guardarFlagsReporte({ eventos_revisados: false, toques: ["eventos"] });
    } catch (err) {
      setEventosRevisados(prev);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo desmarcar novedades.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  const descripcionFecha = new Date(`${diaReporte}T12:00:00`).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
  });

  const formBloqueado = guardando || confirmandoParte || edicionPasadoBloqueada;

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
      {!ocultarCerrar && (
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={onCerrar}
          disabled={guardando || confirmandoParte}
        >
          {etiquetaCerrar}
        </Button>
      )}
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
          {edicionPasadoBloqueada && (
            <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Solo admin y analista SAE pueden editar reportes de fechas pasadas. Este formulario
              queda en solo lectura.
            </p>
          )}
          {errorGuardado && (
            <p className="mb-3 text-xs leading-snug text-destructive sm:hidden">{errorGuardado}</p>
          )}
          <TabsContent value="parte" className="mt-0 block flex-none space-y-5 outline-none">
            <BloqueConfirmacionReporte
              titulo="Parte de hoy"
              tituloRevisado="Parte confirmado hoy"
              descripcion="Demografía y afectados/familias del día."
              icono={Users}
              acento="teal"
              revisado={parteHoyConfirmado}
              modificado={parteModificado}
              guardando={confirmandoParte}
              deshabilitado={formBloqueado}
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
                  <NumInput id="reporte-afectados" className="mt-1" value={totalAfectados} onChange={setTotalAfectados} disabled={formBloqueado} />
                </div>
                <div>
                  <Label htmlFor="reporte-familias" className="text-[11px] text-muted-foreground">
                    N.° de familias
                  </Label>
                  <NumInput id="reporte-familias" className="mt-1" value={familias} onChange={setFamilias} disabled={formBloqueado} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Desglose por edad y sexo</Label>
              <div className="mt-3">
                <DesgloseDemografico
                  vulnerables={ocupacion}
                  deshabilitado={formBloqueado}
                  onCampo={(campo, valor) => setOcupacion((prev) => ({ ...prev, [campo]: valor }))}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="salud" className="mt-0 block flex-none space-y-5 outline-none">
            <BloqueConfirmacionReporte
              titulo="Salud de hoy"
              tituloRevisado="Salud confirmada hoy"
              descripcion="Conteo de incidencias y detalle de casos del día."
              icono={Stethoscope}
              acento="rose"
              revisado={saludHoyConfirmada}
              modificado={saludModificada}
              guardando={confirmandoSalud}
              deshabilitado={formBloqueado}
              onConfirmar={() => void guardarSalud()}
              onDesmarcar={() => void desmarcarSalud()}
              etiquetaGuardar="Guardar salud"
              etiquetaConfirmar="Confirmar sin cambios"
              etiquetaActualizar="Actualizar salud"
            />

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
                disabled={formBloqueado}
              />
            </div>

            <CasosSaludParte
              centroId={centro.id}
              hoyClave={diaReporte}
              incidenciasSalud={incidenciasSalud}
              deshabilitado={formBloqueado}
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
              deshabilitado={formBloqueado}
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
              deshabilitado={formBloqueado}
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
              deshabilitado={formBloqueado}
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
              deshabilitado={formBloqueado}
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
      <DialogReporteCompleto
        abierto={mostrarReporteCompleto}
        onAbiertoChange={setMostrarReporteCompleto}
        centro={centro}
        dia={diaReporte}
        onCerrar={onCerrar}
      />
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
