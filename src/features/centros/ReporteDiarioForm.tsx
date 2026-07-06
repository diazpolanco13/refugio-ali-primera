// Formulario del REPORTE DEL DÍA de un centro (dialog con pestañas).
//
// Tres pestañas:
// - Parte numérico: la misma edición de población/personal de la pestaña V de
//   `CentroForm` (DesgloseDemografico + DesglosePersonal + afectados/familias).
//   Se guarda con `guardarCentro()`, que genera el snapshot histórico en
//   `ocupaciones_centros` automáticamente.
// - Comidas: una tarjeta por jornada (desayuno/almuerzo/cena) con raciones,
//   hora de llegada y proveedor. Se guarda en `reportes_centros`.
// - Atención médica: número de atenciones del día + observaciones. También en
//   `reportes_centros`.
// - Reparaciones: flags diarios + lista histórica de trabajos. Flags en
//   `reportes_reparaciones_dia`; ítems en `reparaciones_centros`.
// - Eventos: múltiples novedades positivas/negativas del día en `eventos_reportes`.
//
// Si ya existe un reporte del día, el formulario carga sobre lo ya reportado
// (clave lógica `centro_id, dia`: la última edición del día gana).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  CalendarPlus,
  ClipboardCheck,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  Users,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import {
  confirmarParteNumericoDia,
  eliminarParteNumericoDia,
  guardarCentro,
  claveDia,
  nuevoId,
} from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { guardarReporteDiario } from "@/data/reposReportes";
import {
  eliminarReporteReparacionesDia,
  guardarReporteReparacionesDia,
} from "@/data/reposReparaciones";
import { guardarEventosReporteDia } from "@/data/reposEventosReportes";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesReparacionesDia } from "@/data/useReportesReparacionesDia";
import { useEventosReportes } from "@/data/useEventosReportes";
import { reporteReparacionesDelDia } from "@/domain/reparaciones";
import type { EventoReporte } from "@/domain/eventosReportes";
import {
  CATALOGO_GRUPOS_EDAD_ATENCION,
  CATALOGO_JORNADAS_REPORTE,
  CATALOGO_TIPOS_ATENCION,
  contarAtenciones,
  estadisticasEdadAtenciones,
  normalizarAtencionesMedicas,
  normalizarComidas,
  reporteDelDia,
  type AtencionMedicaCaso,
  type ComidasDia,
  type JornadaReporte,
  type TipoAtencionMedica,
} from "@/domain/reporteDiario";
import {
  normalizarCentro,
  poblacionCentro,
  totalPersonalOperativo,
  type CentroTransitorio,
  type PersonalCentro,
} from "@/domain/centrosTransitorios";
import type { Vulnerables } from "@/domain/tipos";
import { DesgloseDemografico } from "@/features/censo/DesgloseDemografico";
import { DesglosePersonal } from "@/features/censo/DesglosePersonal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ReparacionesTab } from "./ReparacionesTab";
import { EventosReporteTab } from "./EventosReporteTab";

interface Props {
  centro: CentroTransitorio;
  /** `dialog` = modal a pantalla casi completa; `integrado` = dentro del MarcoVista de la ficha. */
  variant?: "dialog" | "integrado";
  onCerrar: () => void;
}

interface ParteNumericoForm {
  ocupacion: Vulnerables;
  personal: PersonalCentro;
  totalAfectados: number;
  familias: number;
}

function parteNumericoIgual(a: ParteNumericoForm, b: ParteNumericoForm): boolean {
  if (a.totalAfectados !== b.totalAfectados) return false;
  if (a.familias !== b.familias) return false;
  return (
    JSON.stringify(a.ocupacion) === JSON.stringify(b.ocupacion) &&
    JSON.stringify(a.personal) === JSON.stringify(b.personal)
  );
}

/** Timestamp (ms) → "HH:MM" para el input time; "" si no hay hora. */
function horaDesdeTs(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:MM" del input time → timestamp (ms) dentro del día del reporte; null si vacío. */
function tsDesdeHora(hora: string, dia: string): number | null {
  if (!hora.trim()) return null;
  const [h, m] = hora.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date(`${dia}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const CASO_VACIO: Omit<AtencionMedicaCaso, "id"> = {
  nombre: "",
  cedula: "",
  edad: 0,
  tipo_atencion: "ambulatoria",
  sintomas: "",
  diagnostico: "",
};

function labelTipoAtencion(tipo: TipoAtencionMedica): string {
  return CATALOGO_TIPOS_ATENCION.find((t) => t.valor === tipo)?.label ?? tipo;
}

/** Pestaña Salud: casos individuales + notas generales opcionales. */
function AtencionesMedicasSalud({
  casos,
  onCasosChange,
  sinAtenciones,
  onSinAtencionesChange,
  observaciones,
  onObservaciones,
}: {
  casos: AtencionMedicaCaso[];
  onCasosChange: (casos: AtencionMedicaCaso[]) => void;
  sinAtenciones: boolean;
  onSinAtencionesChange: (v: boolean) => void;
  observaciones: string;
  onObservaciones: (v: string) => void;
}) {
  const [borrador, setBorrador] = useState<Omit<AtencionMedicaCaso, "id">>(CASO_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const total = casos.length;
  const statsEdad = useMemo(() => estadisticasEdadAtenciones(casos), [casos]);
  const saludCompleta = sinAtenciones || total > 0;

  function resetBorrador() {
    setBorrador(CASO_VACIO);
    setEditandoId(null);
  }

  function guardarCaso() {
    if (!borrador.nombre.trim()) return;
    const caso: AtencionMedicaCaso = {
      id: editandoId ?? nuevoId(),
      ...borrador,
      nombre: borrador.nombre.trim(),
      cedula: borrador.cedula.trim(),
      sintomas: borrador.sintomas.trim(),
      diagnostico: borrador.diagnostico.trim(),
    };
    if (editandoId) {
      onCasosChange(casos.map((c) => (c.id === editandoId ? caso : c)));
    } else {
      onCasosChange([...casos, caso]);
    }
    onSinAtencionesChange(false);
    resetBorrador();
  }

  function editarCaso(caso: AtencionMedicaCaso) {
    setEditandoId(caso.id);
    setBorrador({
      nombre: caso.nombre,
      cedula: caso.cedula,
      edad: caso.edad,
      tipo_atencion: caso.tipo_atencion,
      sintomas: caso.sintomas,
      diagnostico: caso.diagnostico,
    });
  }

  function eliminarCaso(id: string) {
    onCasosChange(casos.filter((c) => c.id !== id));
    if (editandoId === id) resetBorrador();
  }

  return (
    <div className="min-w-0 space-y-4">
      <div
        className={cn(
          "rounded-lg border px-3 py-3",
          saludCompleta
            ? "border-emerald-500/35 bg-emerald-500/5"
            : "border-teal-500/35 bg-teal-500/5",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Stethoscope className="size-4 text-teal-400" />
              Salud del día
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Registra cada caso atendido hoy o confirma que salud revisó el día
              sin atenciones médicas.
            </p>
          </div>
          <Badge variant="outline" className="w-fit shrink-0 gap-1 tabular-nums">
            {saludCompleta ? <Check className="size-3 text-emerald-400" /> : null}
            {total} {total === 1 ? "atención" : "atenciones"}
            {sinAtenciones && total === 0 ? " · revisado" : ""}
          </Badge>
        </div>

        {casos.length === 0 && (
          <div className="mt-3">
            <Button
              type="button"
              size="default"
              variant={sinAtenciones ? "secondary" : "default"}
              className={cn(
                "min-h-10 w-full shrink-0 justify-center font-semibold shadow-sm sm:w-auto",
                !sinAtenciones && "bg-teal-600 text-white shadow-teal-950/20 hover:bg-teal-500",
                sinAtenciones && "border border-emerald-500/40 text-emerald-400",
              )}
              onClick={() => onSinAtencionesChange(!sinAtenciones)}
            >
              {sinAtenciones ? (
                <CheckCircle2 className="size-4.5" />
              ) : (
                <Check className="size-4.5" />
              )}
              {sinAtenciones ? "Quitar cero atenciones" : "Confirmar cero atenciones"}
            </Button>
          </div>
        )}
      </div>

      {casos.length > 0 && (
        <ul className="space-y-2">
          {casos.map((c) => (
            <li key={c.id}>
              <Card size="sm" className="border-border/80 py-0">
                <CardContent className="flex min-w-0 items-start gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {c.nombre}
                      {c.cedula ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          · {c.cedula}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.edad} años · {labelTipoAtencion(c.tipo_atencion)}
                    </p>
                    {(c.sintomas || c.diagnostico) && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        {[c.sintomas, c.diagnostico].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Editar caso"
                      onClick={() => editarCaso(c)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Eliminar caso"
                      onClick={() => eliminarCaso(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card size="sm" className="border-border/80">
        <CardContent className="min-w-0 space-y-3 px-3 py-3">
          <p className="text-xs font-medium text-foreground">
            {editandoId ? "Editar caso" : "Nuevo caso"}
          </p>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="caso-nombre" className="text-[11px] text-muted-foreground">
                Nombre
              </Label>
              <Input
                id="caso-nombre"
                className="mt-1"
                value={borrador.nombre}
                onChange={(e) => setBorrador((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="caso-cedula" className="text-[11px] text-muted-foreground">
                Cédula
              </Label>
              <Input
                id="caso-cedula"
                className="mt-1"
                value={borrador.cedula}
                onChange={(e) => setBorrador((p) => ({ ...p, cedula: e.target.value }))}
                placeholder="V-…"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="caso-edad" className="text-[11px] text-muted-foreground">
                Edad
              </Label>
              <NumInput
                id="caso-edad"
                className="mt-1"
                value={borrador.edad}
                onChange={(n) => setBorrador((p) => ({ ...p, edad: n }))}
              />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Tipo de atención</Label>
              <Select
                value={borrador.tipo_atencion}
                onValueChange={(v) =>
                  setBorrador((p) => ({ ...p, tipo_atencion: v as TipoAtencionMedica }))
                }
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOGO_TIPOS_ATENCION.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="caso-sintomas" className="text-[11px] text-muted-foreground">
                Síntomas
              </Label>
              <Textarea
                id="caso-sintomas"
                className="mt-1 min-h-[4rem]"
                rows={2}
                value={borrador.sintomas}
                onChange={(e) => setBorrador((p) => ({ ...p, sintomas: e.target.value }))}
                placeholder="Motivo de consulta, signos…"
              />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="caso-diagnostico" className="text-[11px] text-muted-foreground">
                Diagnóstico
              </Label>
              <Textarea
                id="caso-diagnostico"
                className="mt-1 min-h-[4rem]"
                rows={2}
                value={borrador.diagnostico}
                onChange={(e) => setBorrador((p) => ({ ...p, diagnostico: e.target.value }))}
                placeholder="Impresión diagnóstica o conducta…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!borrador.nombre.trim()}
              onClick={guardarCaso}
            >
              {editandoId ? (
                <>
                  <Check className="size-4" />
                  Actualizar caso
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Agregar caso
                </>
              )}
            </Button>
            {editandoId && (
              <Button type="button" size="sm" variant="outline" onClick={resetBorrador}>
                Cancelar edición
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-foreground">Por grupo de edad</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATALOGO_GRUPOS_EDAD_ATENCION.filter((g) => statsEdad[g.valor] > 0).map((g) => (
              <Badge key={g.valor} variant="outline" className="text-[10px] tabular-nums">
                {g.label}: {statsEdad[g.valor]}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <Label htmlFor="reporte-observaciones">Notas generales (opcional)</Label>
        <Textarea
          id="reporte-observaciones"
          className="mt-1.5 w-full min-w-0"
          rows={3}
          value={observaciones}
          onChange={(e) => onObservaciones(e.target.value)}
          placeholder="Observaciones del día que no correspondan a un caso concreto…"
        />
      </div>
    </div>
  );
}

/** Estilo de pestañas del reporte: icono solo en móvil, texto truncado en sm+. */
const clasePestanaReporte = cn(
  "relative flex h-full min-h-0 min-w-0 w-full flex-row items-center justify-center gap-0.5 overflow-hidden rounded-none px-0 py-0",
  "!border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
  "!whitespace-normal text-[10px] font-medium leading-none text-muted-foreground",
  "transition-colors hover:text-foreground",
  "after:!hidden after:!content-none",
  "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
  "data-active:!bg-transparent data-active:!text-foreground data-active:!shadow-none",
  "dark:data-active:!border-x-transparent dark:data-active:!border-t-transparent dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
  "sm:gap-1.5 sm:px-1 sm:text-sm",
  "[&_svg]:size-4 shrink-0",
);

type GuardandoBloque = "parte" | "salud" | "reparaciones" | "eventos" | JornadaReporte | null;

/** Formulario del reporte del día (parte numérico + comidas + atención médica). */
export function ReporteDiarioForm({ centro, variant = "dialog", onCerrar }: Props) {
  const base = normalizarCentro(centro);
  const hoy = useMemo(() => claveDia(Date.now()), []);

  // Parte numérico (mismos campos que la pestaña V de CentroForm).
  const [ocupacion, setOcupacion] = useState<Vulnerables>(base.ocupacion);
  const [personal, setPersonal] = useState<PersonalCentro>(base.personal);
  const [totalAfectados, setTotalAfectados] = useState(base.total_afectados);
  const [familias, setFamilias] = useState(base.familias_ocupadas);

  // Comidas + atención médica (tabla `reportes_centros`). La hora se edita
  // como texto "HH:MM" y se convierte a timestamp del día al guardar.
  const [comidas, setComidas] = useState<ComidasDia>(() => normalizarComidas(undefined));
  const [horas, setHoras] = useState<Record<JornadaReporte, string>>({
    desayuno: "",
    almuerzo: "",
    cena: "",
  });
  const [atencionesCasos, setAtencionesCasos] = useState<AtencionMedicaCaso[]>([]);
  const [sinAtencionesMedicas, setSinAtencionesMedicas] = useState(false);
  const [observaciones, setObservaciones] = useState("");

  // Reparaciones (flags diarios en `reportes_reparaciones_dia`).
  const [requiereTrabajos, setRequiereTrabajos] = useState(false);
  const [seTrabajoHoy, setSeTrabajoHoy] = useState(false);
  const [obsReparaciones, setObsReparaciones] = useState("");
  const [reparacionesRevisadas, setReparacionesRevisadas] = useState(false);

  // Eventos (múltiples filas en `eventos_reportes` + flag de revisión en el reporte base).
  const [eventosReporte, setEventosReporte] = useState<EventoReporte[]>([]);
  const [eventosRevisados, setEventosRevisados] = useState(false);
  const [idsEventosExistentes, setIdsEventosExistentes] = useState<string[]>([]);

  const [guardandoBloque, setGuardandoBloque] = useState<GuardandoBloque>(null);
  const [confirmandoParte, setConfirmandoParte] = useState(false);
  const [parteConfirmadoOk, setParteConfirmadoOk] = useState(false);
  const [parteDesmarcadoOk, setParteDesmarcadoOk] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const guardando = guardandoBloque !== null;

  const baselineParte = useRef<ParteNumericoForm>({
    ocupacion: base.ocupacion,
    personal: base.personal,
    totalAfectados: base.total_afectados,
    familias: base.familias_ocupadas,
  });

  const snapshotsHoy = useOcupacionesCentros({ centroId: centro.id, desde: hoy });
  const parteHoyEnBd = snapshotsHoy.some((s) => s.dia === hoy);

  const parteActual: ParteNumericoForm = {
    ocupacion,
    personal,
    totalAfectados,
    familias,
  };
  const parteModificado = !parteNumericoIgual(parteActual, baselineParte.current);
  const parteHoyConfirmado = !parteDesmarcadoOk && (parteHoyEnBd || parteConfirmadoOk);

  // Si ya hay reporte de HOY, precarga comidas/atenciones para editar sobre
  // lo ya reportado (una sola vez, para no pisar lo que escriba el usuario).
  const reportes = useReportesCentros({ centroId: centro.id, dia: hoy });
  const reporteExistente = reporteDelDia(reportes, centro.id, hoy);
  const [precargado, setPrecargado] = useState(false);
  useEffect(() => {
    if (precargado || !reporteExistente) return;
    const c = normalizarComidas(reporteExistente.comidas);
    setComidas(c);
    setHoras({
      desayuno: horaDesdeTs(c.desayuno.hora_llegada),
      almuerzo: horaDesdeTs(c.almuerzo.hora_llegada),
      cena: horaDesdeTs(c.cena.hora_llegada),
    });
    const casos = normalizarAtencionesMedicas(reporteExistente.atenciones_medicas_detalle);
    setAtencionesCasos(casos);
    setSinAtencionesMedicas(
      reporteExistente.salud_reportada &&
        contarAtenciones(casos, reporteExistente.atenciones_medicas) === 0,
    );
    setObservaciones(reporteExistente.observaciones);
    setEventosRevisados(reporteExistente.eventos_revisados);
    setPrecargado(true);
  }, [precargado, reporteExistente]);

  const reportesRep = useReportesReparacionesDia({ centroId: centro.id, dia: hoy });
  const reporteRepExistente = reporteReparacionesDelDia(reportesRep, centro.id, hoy);
  const [precargadoRep, setPrecargadoRep] = useState(false);
  useEffect(() => {
    if (precargadoRep || !reporteRepExistente) return;
    setRequiereTrabajos(reporteRepExistente.requiere_trabajos);
    setSeTrabajoHoy(reporteRepExistente.se_trabajo_hoy);
    setObsReparaciones(reporteRepExistente.observaciones);
    setReparacionesRevisadas(true);
    setPrecargadoRep(true);
  }, [precargadoRep, reporteRepExistente]);

  const eventosExistentes = useEventosReportes({ centroId: centro.id, dia: hoy });
  const [precargadoEventos, setPrecargadoEventos] = useState(false);
  useEffect(() => {
    if (precargadoEventos || eventosExistentes.length === 0) return;
    setEventosReporte(eventosExistentes);
    setIdsEventosExistentes(eventosExistentes.map((evento) => evento.id));
    setEventosRevisados(true);
    setPrecargadoEventos(true);
  }, [eventosExistentes, precargadoEventos]);

  const refugiados = poblacionCentro({
    ...centro,
    ocupacion,
    total_afectados: totalAfectados,
  });
  const personalTotal = totalPersonalOperativo(personal);

  const setComida =
    (jornada: JornadaReporte, campo: "raciones" | "proveedor" | "observacion") =>
    (valor: number | string) =>
      setComidas((prev) => ({
        ...prev,
        [jornada]: { ...prev[jornada], [campo]: valor },
      }));

  function comidasConHoras(): ComidasDia {
    return {
      desayuno: {
        ...comidas.desayuno,
        hora_llegada: tsDesdeHora(horas.desayuno, hoy),
        proveedor: comidas.desayuno.proveedor.trim(),
        observacion: comidas.desayuno.observacion.trim(),
      },
      almuerzo: {
        ...comidas.almuerzo,
        hora_llegada: tsDesdeHora(horas.almuerzo, hoy),
        proveedor: comidas.almuerzo.proveedor.trim(),
        observacion: comidas.almuerzo.observacion.trim(),
      },
      cena: {
        ...comidas.cena,
        hora_llegada: tsDesdeHora(horas.cena, hoy),
        proveedor: comidas.cena.proveedor.trim(),
        observacion: comidas.cena.observacion.trim(),
      },
    };
  }

  async function guardarReporteBase(): Promise<void> {
    await guardarReporteDiario({
      centro_id: centro.id,
      dia: hoy,
      comidas: comidasConHoras(),
      atenciones_medicas_detalle: atencionesCasos,
      atenciones_medicas: contarAtenciones(atencionesCasos),
      salud_reportada:
        sinAtencionesMedicas ||
        atencionesCasos.length > 0 ||
        observaciones.trim() !== "",
      eventos_revisados: eventosRevisados || eventosReporte.length > 0,
      observaciones: observaciones.trim(),
    });
  }

  async function guardarParte() {
    setErrorGuardado(null);
    setConfirmandoParte(true);
    try {
      const centroActualizado = {
        ...centro,
        ocupacion,
        personal,
        total_afectados: totalAfectados,
        familias_ocupadas: familias,
      };
      if (parteModificado) {
        await guardarCentro(centroActualizado);
      } else {
        await confirmarParteNumericoDia(centroActualizado, hoy);
      }
      baselineParte.current = {
        ocupacion,
        personal,
        totalAfectados,
        familias,
      };
      setParteConfirmadoOk(true);
      setParteDesmarcadoOk(false);
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando parte numérico:", err);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo guardar el parte numérico del día.",
      );
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function desmarcarParte() {
    setErrorGuardado(null);
    setConfirmandoParte(true);
    try {
      await eliminarParteNumericoDia(centro.id, hoy);
      setParteConfirmadoOk(false);
      setParteDesmarcadoOk(true);
    } catch (err) {
      console.error("[ReporteDiarioForm] error desmarcando parte numérico:", err);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo desmarcar el parte numérico.",
      );
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function guardarComida(jornada: JornadaReporte) {
    setErrorGuardado(null);
    setGuardandoBloque(jornada);
    try {
      await guardarReporteBase();
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando comida:", err);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar la comida.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarSalud() {
    setErrorGuardado(null);
    setGuardandoBloque("salud");
    try {
      await guardarReporteBase();
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando salud:", err);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar salud.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarReparaciones() {
    setErrorGuardado(null);
    setGuardandoBloque("reparaciones");
    try {
      const bloqueRevisado =
        reparacionesRevisadas ||
        requiereTrabajos ||
        seTrabajoHoy ||
        obsReparaciones.trim() !== "";
      if (bloqueRevisado) {
        await guardarReporteReparacionesDia({
          centro_id: centro.id,
          dia: hoy,
          requiere_trabajos: requiereTrabajos,
          se_trabajo_hoy: seTrabajoHoy,
          observaciones: obsReparaciones.trim(),
        });
      } else if (reporteRepExistente) {
        await eliminarReporteReparacionesDia({ centro_id: centro.id, dia: hoy });
      }
      setReparacionesRevisadas(bloqueRevisado);
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando reparaciones:", err);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo guardar reparaciones.",
      );
    } finally {
      setGuardandoBloque(null);
    }
  }

  async function guardarEventos() {
    setErrorGuardado(null);
    setGuardandoBloque("eventos");
    try {
      await guardarReporteBase();
      await guardarEventosReporteDia({
        centro_id: centro.id,
        dia: hoy,
        eventos: eventosReporte,
        idsExistentes: idsEventosExistentes,
      });
      setIdsEventosExistentes(eventosReporte.map((evento) => evento.id));
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando eventos:", err);
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar eventos.");
    } finally {
      setGuardandoBloque(null);
    }
  }

  const descripcionFecha = new Date(`${hoy}T12:00:00`).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
  });

  const pieFormulario = (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-t border-border/80 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        variant === "integrado" ? "justify-end lg:px-6" : "",
      )}
    >
      {errorGuardado && (
        <p className="w-full text-xs leading-snug text-destructive sm:mr-auto sm:max-w-[60%]">
          {errorGuardado}
        </p>
      )}
      <div
        className={cn(
          "flex w-full gap-2",
          variant === "integrado"
            ? "flex-row justify-end sm:w-auto"
            : "flex-col-reverse sm:ml-auto sm:w-auto sm:flex-row",
        )}
      >
        <Button variant="outline" onClick={onCerrar} disabled={guardando || confirmandoParte}>
          Cerrar
        </Button>
      </div>
    </div>
  );

  const cuerpoFormulario = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs defaultValue="parte" className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          <div className="relative z-30 shrink-0 overflow-hidden border-b border-border/80 bg-background">
            <TabsList
              variant="line"
              className="grid !h-11 w-full min-w-0 grid-cols-5 gap-0 overflow-hidden rounded-none bg-background p-0 sm:!h-[50px]"
            >
              <TabsTrigger value="parte" title="Parte numérico" className={clasePestanaReporte}>
                <Users />
                <span className="hidden min-w-0 truncate sm:inline">Parte</span>
              </TabsTrigger>
              <TabsTrigger value="comidas" title="Comidas" className={clasePestanaReporte}>
                <UtensilsCrossed />
                <span className="hidden min-w-0 truncate sm:inline">Comidas</span>
              </TabsTrigger>
              <TabsTrigger value="salud" title="Salud" className={clasePestanaReporte}>
                <Stethoscope />
                <span className="hidden min-w-0 truncate sm:inline">Salud</span>
              </TabsTrigger>
              <TabsTrigger value="reparaciones" title="Reparaciones" className={clasePestanaReporte}>
                <Wrench />
                <span className="hidden min-w-0 truncate sm:inline">Rep.</span>
              </TabsTrigger>
              <TabsTrigger value="eventos" title="Eventos" className={clasePestanaReporte}>
                <CalendarPlus />
                <span className="hidden min-w-0 truncate sm:inline">Eventos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background px-5 py-4 sm:px-6 sm:py-5">
            {/* Parte numérico: población, familias, desglose y personal */}
            <TabsContent value="parte" className="mt-0 block flex-none space-y-5 outline-none">
              <div
                className={cn(
                  "rounded-lg border px-3 py-3",
                  parteHoyConfirmado
                    ? "border-emerald-500/35 bg-emerald-500/5"
                    : parteModificado
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-teal-500/35 bg-teal-500/5",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {parteHoyConfirmado ? (
                        <CheckCircle2 className="size-4 text-emerald-400" />
                      ) : (
                        <ClipboardCheck className="size-4 text-teal-400" />
                      )}
                      {parteHoyConfirmado
                        ? "Parte numérico confirmado hoy"
                        : "Parte numérico de hoy"}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {parteHoyConfirmado
                        ? "El registro de hoy ya quedó en el histórico."
                        : parteModificado
                          ? "Hay cambios respecto al último registro. Guárdalos desde esta pestaña."
                          : "Si la población no cambió, confírmalo sin reescribir las cifras."}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit shrink-0 gap-1 tabular-nums">
                    {parteHoyConfirmado ? <Check className="size-3 text-emerald-400" /> : null}
                    {parteHoyConfirmado
                      ? "Revisado"
                      : parteModificado
                        ? "Con cambios"
                        : "Pendiente"}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    className="min-h-10 w-full justify-center bg-teal-600 font-semibold text-white shadow-sm shadow-teal-950/20 hover:bg-teal-500 sm:w-auto"
                    disabled={confirmandoParte || guardando}
                    onClick={() => void guardarParte()}
                  >
                    {confirmandoParte ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {parteModificado
                      ? "Guardar parte"
                      : parteHoyConfirmado
                        ? "Actualizar parte"
                        : "Confirmar sin cambios"}
                  </Button>
                  {parteHoyConfirmado && !parteModificado && (
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      className="min-h-10 w-full justify-center sm:w-auto"
                      disabled={confirmandoParte || guardando}
                      onClick={() => void desmarcarParte()}
                    >
                      Desmarcar revisión
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Población afectada</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Damnificados:{" "}
                  <span className="font-semibold text-foreground">
                    {refugiados.toLocaleString("es")}
                  </span>
                  {personalTotal > 0 && (
                    <>
                      {" "}
                      · Personal:{" "}
                      <span className="font-semibold text-foreground">
                        {personalTotal.toLocaleString("es")}
                      </span>
                    </>
                  )}
                  .{" "}
                  {parteModificado
                    ? "Al guardar el reporte se actualiza el snapshot del día."
                    : "Si hubo cambios, edita las cifras y guarda el reporte."}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <Label
                      htmlFor="reporte-afectados"
                      className="text-[11px] text-muted-foreground"
                    >
                      Cantidad de afectados
                    </Label>
                    <NumInput
                      id="reporte-afectados"
                      className="mt-1"
                      value={totalAfectados}
                      onChange={setTotalAfectados}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="reporte-familias"
                      className="text-[11px] text-muted-foreground"
                    >
                      N.° de familias
                    </Label>
                    <NumInput
                      id="reporte-familias"
                      className="mt-1"
                      value={familias}
                      onChange={setFamilias}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Desglose por edad y sexo</Label>
                <div className="mt-3">
                  <DesgloseDemografico
                    vulnerables={ocupacion}
                    onCampo={(campo, valor) =>
                      setOcupacion((prev) => ({ ...prev, [campo]: valor }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Personal operativo</Label>
                <div className="mt-3">
                  <DesglosePersonal
                    personal={personal}
                    onCampo={(campo, valor) =>
                      setPersonal((prev) => ({ ...prev, [campo]: valor }))
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Comidas: una tarjeta por jornada */}
            <TabsContent value="comidas" className="mt-0 block flex-none space-y-2 outline-none">
              <p className="text-xs text-muted-foreground">
                Registra las raciones recibidas en cada jornada, a qué hora llegó la
                comida y quién la proveyó. Deja en 0 / vacío lo que aún no llega.
              </p>
              {CATALOGO_JORNADAS_REPORTE.map((j) => (
                <Card key={j.valor} size="sm" className="border-border/80 py-2">
                  <CardContent className="space-y-2 px-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <span className="text-base leading-none">{j.icono}</span>
                      {j.label}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label
                          htmlFor={`reporte-raciones-${j.valor}`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Raciones
                        </Label>
                        <NumInput
                          id={`reporte-raciones-${j.valor}`}
                          className="mt-1"
                          value={comidas[j.valor].raciones}
                          onChange={(n) => setComida(j.valor, "raciones")(n)}
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`reporte-hora-${j.valor}`}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground"
                        >
                          <Clock className="size-3" />
                          Hora de llegada
                        </Label>
                        <Input
                          id={`reporte-hora-${j.valor}`}
                          type="time"
                          className="mt-1"
                          value={horas[j.valor]}
                          onChange={(e) =>
                            setHoras((prev) => ({ ...prev, [j.valor]: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor={`reporte-proveedor-${j.valor}`}
                        className="text-[11px] text-muted-foreground"
                      >
                        Proveedor
                      </Label>
                      <Input
                        id={`reporte-proveedor-${j.valor}`}
                        className="mt-1"
                        value={comidas[j.valor].proveedor}
                        onChange={(e) => setComida(j.valor, "proveedor")(e.target.value)}
                        placeholder="Ej. Alcaldía, INN, donación privada…"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor={`reporte-obs-${j.valor}`}
                        className="text-[11px] text-muted-foreground"
                      >
                        Observación (opcional)
                      </Label>
                      <Input
                        id={`reporte-obs-${j.valor}`}
                        className="mt-1"
                        value={comidas[j.valor].observacion}
                        onChange={(e) => setComida(j.valor, "observacion")(e.target.value)}
                        placeholder="Ej. faltaron 20 raciones…"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        disabled={guardando || confirmandoParte}
                        onClick={() => void guardarComida(j.valor)}
                      >
                        {guardandoBloque === j.valor ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Guardar {j.label.toLowerCase()}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Atención médica del día: casos individuales */}
            <TabsContent
              value="salud"
              className="mt-0 block min-w-0 flex-none space-y-3 outline-none"
            >
              <AtencionesMedicasSalud
                casos={atencionesCasos}
                onCasosChange={setAtencionesCasos}
                sinAtenciones={sinAtencionesMedicas}
                onSinAtencionesChange={setSinAtencionesMedicas}
                observaciones={observaciones}
                onObservaciones={setObservaciones}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={guardando || confirmandoParte}
                  onClick={() => void guardarSalud()}
                >
                  {guardandoBloque === "salud" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Guardar salud
                </Button>
              </div>
            </TabsContent>

            {/* Reparaciones: flags diarios + lista histórica */}
            <TabsContent value="reparaciones" className="mt-0 block flex-none space-y-3 outline-none">
              <ReparacionesTab
                centroId={centro.id}
                puedeEditar
                requiereTrabajos={requiereTrabajos}
                seTrabajoHoy={seTrabajoHoy}
                observaciones={obsReparaciones}
                onRequiereTrabajos={setRequiereTrabajos}
                onSeTrabajoHoy={setSeTrabajoHoy}
                onObservaciones={setObsReparaciones}
                revisado={reparacionesRevisadas}
                onRevisadoChange={setReparacionesRevisadas}
                deshabilitado={guardando || confirmandoParte}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={guardando || confirmandoParte}
                  onClick={() => void guardarReparaciones()}
                >
                  {guardandoBloque === "reparaciones" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Guardar reparaciones
                </Button>
              </div>
            </TabsContent>

            {/* Eventos: positivos/negativos + participantes */}
            <TabsContent value="eventos" className="mt-0 block flex-none space-y-3 outline-none">
              <EventosReporteTab
                centroId={centro.id}
                dia={hoy}
                eventos={eventosReporte}
                eventosRevisados={eventosRevisados}
                onEventosChange={setEventosReporte}
                onEventosRevisadosChange={setEventosRevisados}
                deshabilitado={guardando || confirmandoParte}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={guardando || confirmandoParte}
                  onClick={() => void guardarEventos()}
                >
                  {guardandoBloque === "eventos" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Guardar eventos
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      {pieFormulario}
    </div>
  );

  if (variant === "integrado") {
    return cuerpoFormulario;
  }

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
