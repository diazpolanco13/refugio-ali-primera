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
//
// Si ya existe un reporte del día, el formulario carga sobre lo ya reportado
// (clave lógica `centro_id, dia`: la última edición del día gana).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
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
  guardarCentro,
  claveDia,
  nuevoId,
} from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { guardarReporteDiario } from "@/data/reposReportes";
import { guardarReporteReparacionesDia } from "@/data/reposReparaciones";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesReparacionesDia } from "@/data/useReportesReparacionesDia";
import { reporteReparacionesDelDia } from "@/domain/reparaciones";
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
  DialogFooter,
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

interface Props {
  centro: CentroTransitorio;
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
  observaciones,
  onObservaciones,
}: {
  casos: AtencionMedicaCaso[];
  onCasosChange: (casos: AtencionMedicaCaso[]) => void;
  observaciones: string;
  onObservaciones: (v: string) => void;
}) {
  const [borrador, setBorrador] = useState<Omit<AtencionMedicaCaso, "id">>(CASO_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const total = casos.length;
  const statsEdad = useMemo(() => estadisticasEdadAtenciones(casos), [casos]);

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Atenciones médicas</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registra cada caso atendido hoy. El total se calcula automáticamente.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {total} {total === 1 ? "atención" : "atenciones"}
        </Badge>
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

/** Estilo de pestañas del reporte: grid 4 cols; icono solo en móvil, texto truncado en sm+. */
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

/** Formulario del reporte del día (parte numérico + comidas + atención médica). */
export function ReporteDiarioForm({ centro, onCerrar }: Props) {
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
  const [observaciones, setObservaciones] = useState("");

  // Reparaciones (flags diarios en `reportes_reparaciones_dia`).
  const [requiereTrabajos, setRequiereTrabajos] = useState(false);
  const [seTrabajoHoy, setSeTrabajoHoy] = useState(false);
  const [obsReparaciones, setObsReparaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [confirmandoParte, setConfirmandoParte] = useState(false);
  const [parteConfirmadoOk, setParteConfirmadoOk] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

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
  const parteHoyConfirmado = parteHoyEnBd || parteConfirmadoOk;

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
    setAtencionesCasos(normalizarAtencionesMedicas(reporteExistente.atenciones_medicas_detalle));
    setObservaciones(reporteExistente.observaciones);
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
    setPrecargadoRep(true);
  }, [precargadoRep, reporteRepExistente]);

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

  async function confirmarSinCambios() {
    setErrorGuardado(null);
    setConfirmandoParte(true);
    try {
      await confirmarParteNumericoDia(
        {
          ...centro,
          ocupacion,
          personal,
          total_afectados: totalAfectados,
          familias_ocupadas: familias,
        },
        hoy,
      );
      setParteConfirmadoOk(true);
    } catch (err) {
      console.error("[ReporteDiarioForm] error confirmando parte numérico:", err);
      setErrorGuardado(
        err instanceof Error
          ? err.message
          : "No se pudo confirmar el parte numérico del día.",
      );
    } finally {
      setConfirmandoParte(false);
    }
  }

  async function guardar() {
    setErrorGuardado(null);
    setGuardando(true);
    try {
      // 1) Parte numérico → solo si hubo cambios respecto al último registro.
      if (parteModificado) {
        await guardarCentro({
          ...centro,
          ocupacion,
          personal,
          total_afectados: totalAfectados,
          familias_ocupadas: familias,
        });
      }
      // 2) Comidas + atención médica → reportes_centros (upsert del día).
      await guardarReporteDiario({
        centro_id: centro.id,
        dia: hoy,
        comidas: {
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
        },
        atenciones_medicas_detalle: atencionesCasos,
        atenciones_medicas: contarAtenciones(atencionesCasos),
        observaciones: observaciones.trim(),
      });
      // 3) Flags diarios de reparaciones.
      await guardarReporteReparacionesDia({
        centro_id: centro.id,
        dia: hoy,
        requiere_trabajos: requiereTrabajos,
        se_trabajo_hoy: seTrabajoHoy,
        observaciones: obsReparaciones.trim(),
      });
      onCerrar();
    } catch (err) {
      console.error("[ReporteDiarioForm] error guardando reporte:", err);
      setErrorGuardado(
        err instanceof Error ? err.message : "No se pudo guardar el reporte del día.",
      );
    } finally {
      setGuardando(false);
    }
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
            N.° {centro.nro} · {centro.nombre} ·{" "}
            {new Date(`${hoy}T12:00:00`).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "long",
            })}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="parte" className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          <div className="relative z-30 shrink-0 overflow-hidden border-b border-border/80 bg-background">
            <TabsList
              variant="line"
              className="grid !h-11 w-full min-w-0 grid-cols-4 gap-0 overflow-hidden rounded-none bg-background p-0 sm:!h-[50px]"
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
            </TabsList>
          </div>

          <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background px-5 py-4 sm:px-6 sm:py-5">
            {/* Parte numérico: población, familias, desglose y personal */}
            <TabsContent value="parte" className="mt-0 block flex-none space-y-5 outline-none">
              <div
                className={cn(
                  "rounded-lg border px-4 py-3.5",
                  parteHoyConfirmado
                    ? "border-emerald-500/35 bg-emerald-500/5"
                    : parteModificado
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-teal-500/35 bg-teal-500/5",
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      parteHoyConfirmado
                        ? "bg-emerald-500/15 text-emerald-400"
                        : parteModificado
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-teal-500/15 text-teal-400",
                    )}
                  >
                    {parteHoyConfirmado ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <ClipboardCheck className="size-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {parteHoyConfirmado
                          ? "Parte numérico confirmado hoy"
                          : "Parte numérico de hoy"}
                      </p>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {parteHoyConfirmado
                          ? "El registro de hoy ya quedó en el histórico."
                          : parteModificado
                            ? "Hay cambios respecto al último registro. Guárdalos con el botón del pie del formulario."
                            : "Si la población no cambió, confírmalo sin reescribir las cifras."}
                      </p>
                    </div>

                    {!parteHoyConfirmado && !parteModificado && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-500"
                        disabled={confirmandoParte || guardando}
                        onClick={() => void confirmarSinCambios()}
                      >
                        {confirmandoParte ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Confirmar sin cambios
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Población afectada</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Refugiados:{" "}
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
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Atención médica del día: casos individuales */}
            <TabsContent
              value="salud"
              className="mt-0 block min-w-0 flex-none outline-none"
            >
              <AtencionesMedicasSalud
                casos={atencionesCasos}
                onCasosChange={setAtencionesCasos}
                observaciones={observaciones}
                onObservaciones={setObservaciones}
              />
            </TabsContent>

            {/* Reparaciones: flags diarios + lista histórica */}
            <TabsContent value="reparaciones" className="mt-0 block flex-none outline-none">
              <ReparacionesTab
                centroId={centro.id}
                puedeEditar
                requiereTrabajos={requiereTrabajos}
                seTrabajoHoy={seTrabajoHoy}
                observaciones={obsReparaciones}
                onRequiereTrabajos={setRequiereTrabajos}
                onSeTrabajoHoy={setSeTrabajoHoy}
                onObservaciones={setObsReparaciones}
                deshabilitado={guardando || confirmandoParte}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 border-t border-border/80 bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {errorGuardado && (
            <p className="w-full text-xs leading-snug text-destructive sm:mr-auto sm:max-w-[60%]">
              {errorGuardado}
            </p>
          )}
          <div className="flex w-full flex-col-reverse gap-2 sm:ml-auto sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={onCerrar} disabled={guardando || confirmandoParte}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={guardando || confirmandoParte}>
              {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
              {parteModificado ? "Guardar reporte" : "Guardar comidas y atención"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
