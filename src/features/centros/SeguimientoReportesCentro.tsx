// Seguimiento de incidencias de salud y novedades del reporte diario.
// Los registros se crean en el reporte (fases Parte y Novedades); aquí se
// administran y dan seguimiento.

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { actualizarCasoSalud, archivarCasoSalud } from "@/data/reposCasosSalud";
import {
  actualizarEventoReporte,
  eliminarEventoReporte,
} from "@/data/reposEventosReportes";
import { claveDia } from "@/data/reposSupabase";
import { casosAbiertosSeguimiento, ESTATUS_CASO_SALUD } from "@/domain/casosSalud";
import {
  casosSaludEnSeguimiento,
  casosSaludPendientes,
  contadoresSeguimientoCentro,
  marcasCalendarioSeguimiento,
  META_ESTATUS_CASO_SALUD,
  META_TIPO_EVENTO_REPORTE,
  type CasoSaludCentro,
  type EstatusCasoSalud,
} from "@/domain/seguimientoReportes";
import {
  CATALOGO_TIPOS_EVENTO_REPORTE,
  textoParticipantesEvento,
  type EventoReporte,
  type TipoEventoReporte,
} from "@/domain/eventosReportes";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import {
  CalendarioSelectorDia,
  formatearDiaCalendario,
} from "./CalendarioSelectorDia";
import { GraficoSeguimientoCentro } from "./GraficoSeguimientoCentro";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  variant?: "compacto" | "expandido";
  /** Abre el formulario del reporte en la fase indicada (parte | salud | novedades). */
  onIrAReporte?: (fase?: string) => void;
}

type FiltroLista = "seguimiento" | "salud" | "novedades" | "dia" | "historial";

const LEYENDA_CALENDARIO = [
  { color: "#ef4444", label: "Salud o novedad negativa" },
  { color: "#22c55e", label: "Solo novedades positivas" },
];

function formatearHora(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function horaDesdeTs(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function tsDesdeHora(hora: string, dia: string): number {
  const base = new Date(`${dia}T00:00:00`);
  if (!hora.trim()) return Date.now();
  const [h, m] = hora.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Date.now();
  base.setHours(h, m, 0, 0);
  return base.getTime();
}

/** Partes con contador de salud pero sin casos detallados registrados. */
function partesSaludSinDetalle(
  centroId: string,
  snapshots: SnapshotOcupacion[],
  casos: CasoSaludCentro[],
  hoyClave: string,
): { dia: string; reportadas: number; faltan: number }[] {
  const casosCentro = casos.filter((c) => c.centro_id === centroId);
  const abiertosTotal = casosAbiertosSeguimiento(casosCentro).length;

  return snapshots
    .filter((s) => s.centro_id === centroId && (s.incidencias_salud ?? 0) > 0)
    .map((snap) => {
      const reportadas = snap.incidencias_salud ?? 0;
      const registrados =
        snap.dia === hoyClave
          ? abiertosTotal
          : casosCentro.filter((c) => c.reportado_dia === snap.dia).length;
      return { dia: snap.dia, reportadas, faltan: Math.max(0, reportadas - registrados) };
    })
    .filter((x) => x.faltan > 0)
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

function TarjetaSaludPendienteDetalle({
  dia,
  reportadas,
  faltan,
  onCompletar,
}: {
  dia: string;
  reportadas: number;
  faltan: number;
  onCompletar?: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Stethoscope className="size-4 text-rose-400" />
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[9px]">
              Pendiente de detallar
            </Badge>
          </div>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {reportadas} incidencia{reportadas === 1 ? "" : "s"} de salud reportada
            {reportadas === 1 ? "" : "s"} el {formatearDiaCalendario(dia)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Faltan {faltan} caso{faltan === 1 ? "" : "s"} por registrar en el parte numérico.
          </p>
        </div>
        {onCompletar && (
          <Button type="button" size="sm" variant="secondary" onClick={onCompletar}>
            Completar en reporte
          </Button>
        )}
      </div>
    </div>
  );
}

function TarjetaCasoSalud({
  caso,
  puedeEditar,
  editando,
  borrador,
  onBorradorChange,
  onEditar,
  onCancelarEdicion,
  onGuardar,
  onEliminar,
  onCambiarEstatus,
  onArchivar,
  cambiando,
  archivando,
  eliminando,
  guardando,
}: {
  caso: CasoSaludCentro;
  puedeEditar: boolean;
  editando: boolean;
  borrador: { titulo: string; descripcion: string; estatus: EstatusCasoSalud };
  onBorradorChange: (b: { titulo: string; descripcion: string; estatus: EstatusCasoSalud }) => void;
  onEditar: () => void;
  onCancelarEdicion: () => void;
  onGuardar: () => void;
  onEliminar: () => void;
  onCambiarEstatus: (estatus: EstatusCasoSalud) => void;
  onArchivar: () => void;
  cambiando: boolean;
  archivando: boolean;
  eliminando: boolean;
  guardando: boolean;
}) {
  const meta = META_ESTATUS_CASO_SALUD[caso.estatus];
  const ocupado = cambiando || archivando || eliminando || guardando;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/10 px-3 py-3",
        editando ? "border-teal-500/50 ring-1 ring-teal-500/20" : "border-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {!editando && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[9px]"
                  style={{ borderColor: `${meta.color}66`, color: meta.color }}
                >
                  {meta.label}
                </Badge>
                <BadgeAntiguedad
                  reportadoDia={caso.reportado_dia}
                  resueltaTs={caso.resuelta_ts}
                  creadaTs={caso.creada_ts}
                />
                {ocupado && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>
              <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{caso.titulo}</p>
              {caso.descripcion ? (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{caso.descripcion}</p>
              ) : null}
              <p className="mt-1 text-[10px] text-muted-foreground">
                Reportado {formatearDiaCalendario(caso.reportado_dia)}
                {caso.updated_by ? ` · ${caso.updated_by}` : ""}
              </p>
            </>
          )}
        </div>
        {puedeEditar && !editando && caso.estatus !== "archivado" && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={ocupado}
              aria-label="Editar caso"
              onClick={onEditar}
            >
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={ocupado}
                  aria-label="Eliminar caso"
                >
                  {eliminando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar caso de salud?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se archivará «{caso.titulo}». Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {editando && (
        <div className="space-y-3">
          <Input
            className="h-10 text-sm"
            value={borrador.titulo}
            disabled={guardando}
            onChange={(e) => onBorradorChange({ ...borrador, titulo: e.target.value })}
            placeholder="Título del caso"
          />
          <Textarea
            className="min-h-[4rem] text-sm"
            rows={2}
            value={borrador.descripcion}
            disabled={guardando}
            onChange={(e) => onBorradorChange({ ...borrador, descripcion: e.target.value })}
            placeholder="Detalle (opcional)"
          />
          <Select
            value={borrador.estatus}
            onValueChange={(v) =>
              onBorradorChange({ ...borrador, estatus: v as EstatusCasoSalud })
            }
            disabled={guardando}
          >
            <SelectTrigger className={cn(claseSelectReporte, "mt-0")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTATUS_CASO_SALUD.filter((e) => e.valor !== "archivado").map((e) => (
                <SelectItem key={e.valor} value={e.valor}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="sm:flex-1"
              disabled={!borrador.titulo.trim() || guardando}
              onClick={onGuardar}
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={guardando}
              onClick={onCancelarEdicion}
            >
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {puedeEditar && !editando && caso.estatus !== "archivado" && (
        <div className="mt-2.5 space-y-2">
          {caso.estatus !== "resuelto" ? (
            <div className="flex overflow-hidden rounded-lg border border-border/70">
              {(["activo", "en_proceso", "resuelto"] as const).map((est) => {
                const e = META_ESTATUS_CASO_SALUD[est];
                const activo = caso.estatus === est;
                return (
                  <button
                    key={est}
                    type="button"
                    disabled={ocupado || activo}
                    onClick={() => onCambiarEstatus(est)}
                    className={cn(
                      "flex-1 border-r border-border/70 px-2 py-1.5 text-[11px] font-semibold transition-colors last:border-r-0",
                      activo
                        ? "text-white"
                        : "text-muted-foreground hover:bg-muted/40 active:bg-muted/60",
                    )}
                    style={activo ? { backgroundColor: e.color } : undefined}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={ocupado}
              onClick={onArchivar}
            >
              {archivando ? <Loader2 className="size-4 animate-spin" /> : null}
              Archivar caso resuelto
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaNovedad({
  evento,
  puedeEditar,
  editando,
  borrador,
  onBorradorChange,
  onEditar,
  onCancelarEdicion,
  onGuardar,
  onEliminar,
  guardando,
  eliminando,
}: {
  evento: EventoReporte;
  puedeEditar: boolean;
  editando: boolean;
  borrador: { tipo: TipoEventoReporte; hora: string; titulo: string; descripcion: string };
  onBorradorChange: (b: {
    tipo: TipoEventoReporte;
    hora: string;
    titulo: string;
    descripcion: string;
  }) => void;
  onEditar: () => void;
  onCancelarEdicion: () => void;
  onGuardar: () => void;
  onEliminar: () => void;
  guardando: boolean;
  eliminando: boolean;
}) {
  const meta = META_TIPO_EVENTO_REPORTE[evento.tipo];
  const ocupado = guardando || eliminando;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/10 px-3 py-3",
        editando ? "border-teal-500/50 ring-1 ring-teal-500/20" : "border-border/70",
      )}
    >
      <div className="flex items-start gap-2">
        {!editando &&
          (evento.tipo === "positivo" ? (
            <ThumbsUp className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          ) : (
            <ThumbsDown className="mt-0.5 size-4 shrink-0 text-red-400" />
          ))}
        <div className="min-w-0 flex-1">
          {!editando && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[9px]"
                  style={{ borderColor: `${meta.color}66`, color: meta.color }}
                >
                  {meta.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatearDiaCalendario(evento.dia)} · {formatearHora(evento.ts)}
                </span>
                {ocupado && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">{evento.titulo}</p>
              {evento.descripcion ? (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{evento.descripcion}</p>
              ) : null}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {textoParticipantesEvento(evento)}
                {evento.creada_por ? ` · ${evento.creada_por}` : ""}
              </p>
            </>
          )}
        </div>
        {puedeEditar && !editando && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={ocupado}
              aria-label="Editar novedad"
              onClick={onEditar}
            >
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={ocupado}
                  aria-label="Eliminar novedad"
                >
                  {eliminando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar novedad?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará «{evento.titulo}» del reporte del{" "}
                    {formatearDiaCalendario(evento.dia)}. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {editando && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
            <div>
              <Label className="text-[11px] text-muted-foreground">Tipo</Label>
              <Select
                value={borrador.tipo}
                disabled={guardando}
                onValueChange={(v) => onBorradorChange({ ...borrador, tipo: v as TipoEventoReporte })}
              >
                <SelectTrigger className={claseSelectReporte}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOGO_TIPOS_EVENTO_REPORTE.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Hora</Label>
              <Input
                type="time"
                className="mt-1"
                disabled={guardando}
                value={borrador.hora}
                onChange={(e) => onBorradorChange({ ...borrador, hora: e.target.value })}
              />
            </div>
          </div>
          <Input
            value={borrador.titulo}
            disabled={guardando}
            onChange={(e) => onBorradorChange({ ...borrador, titulo: e.target.value })}
            placeholder="Título de la novedad"
          />
          <Textarea
            rows={3}
            value={borrador.descripcion}
            disabled={guardando}
            onChange={(e) => onBorradorChange({ ...borrador, descripcion: e.target.value })}
            placeholder="Descripción (opcional)"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="sm:flex-1"
              disabled={!borrador.titulo.trim() || guardando}
              onClick={onGuardar}
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={guardando} onClick={onCancelarEdicion}>
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeguimientoExpandido({
  centro,
  puedeEditar,
  onIrAReporte,
}: {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onIrAReporte?: (fase?: string) => void;
}) {
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => {
    const [y, m, d] = hoyClave.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 30);
    return claveDia(dt.getTime());
  }, [hoyClave]);

  const todosCasos = useCasosSaludCentros({ centroId: centro.id });
  const eventos = useEventosReportes({ centroId: centro.id, desde });
  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });

  const casos = useMemo(() => casosSaludEnSeguimiento(todosCasos), [todosCasos]);

  const contadores = useMemo(
    () => contadoresSeguimientoCentro(casos, eventos, hoyClave),
    [casos, eventos, hoyClave],
  );
  const marcasPorDia = useMemo(
    () => marcasCalendarioSeguimiento(centro.id, snapshots, eventos),
    [centro.id, snapshots, eventos],
  );

  const [filtro, setFiltro] = useState<FiltroLista>("seguimiento");
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [evolucionAbierta, setEvolucionAbierta] = useState(false);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);
  const [eliminandoCasoId, setEliminandoCasoId] = useState<string | null>(null);
  const [guardandoCasoId, setGuardandoCasoId] = useState<string | null>(null);
  const [editandoCasoId, setEditandoCasoId] = useState<string | null>(null);
  const [borradorCaso, setBorradorCaso] = useState({
    titulo: "",
    descripcion: "",
    estatus: "activo" as EstatusCasoSalud,
  });

  const [editandoNovedadId, setEditandoNovedadId] = useState<string | null>(null);
  const [borradorNovedad, setBorradorNovedad] = useState({
    tipo: "positivo" as TipoEventoReporte,
    hora: "",
    titulo: "",
    descripcion: "",
  });
  const [guardandoNovedadId, setGuardandoNovedadId] = useState<string | null>(null);
  const [eliminandoNovedadId, setEliminandoNovedadId] = useState<string | null>(null);

  const casosSeguimiento = casos;
  const casosPendientes = useMemo(() => casosSaludPendientes(casos), [casos]);
  const casosResueltos = useMemo(
    () => casosSeguimiento.filter((c) => c.estatus === "resuelto"),
    [casosSeguimiento],
  );
  const historialCasos = useMemo(
    () => todosCasos.filter((c) => c.estatus === "archivado"),
    [todosCasos],
  );

  const eventosOrdenados = useMemo(
    () => [...eventos].sort((a, b) => b.dia.localeCompare(a.dia) || b.ts - a.ts),
    [eventos],
  );

  const saludSinDetalle = useMemo(
    () => partesSaludSinDetalle(centro.id, snapshots, todosCasos, hoyClave),
    [centro.id, snapshots, todosCasos, hoyClave],
  );

  const saludSinDetalleVisibles = useMemo(() => {
    if (filtro === "historial" || filtro === "novedades") return [];
    if (filtro === "dia") return diaSel ? saludSinDetalle.filter((p) => p.dia === diaSel) : [];
    return saludSinDetalle;
  }, [filtro, diaSel, saludSinDetalle]);

  function seleccionarFiltro(nuevo: FiltroLista, dia?: string | null) {
    setFiltro(nuevo);
    if (nuevo === "dia") {
      setDiaSel(dia ?? null);
      setEvolucionAbierta(true);
      setCalendarioAbierto(true);
    } else {
      setDiaSel(null);
    }
  }

  const listaCasos = useMemo(() => {
    switch (filtro) {
      case "seguimiento":
        return [...casosPendientes, ...casosResueltos].sort(
          (a, b) => b.reportado_dia.localeCompare(a.reportado_dia) || b.creada_ts - a.creada_ts,
        );
      case "salud":
        return casosSeguimiento.sort(
          (a, b) => b.reportado_dia.localeCompare(a.reportado_dia) || b.creada_ts - a.creada_ts,
        );
      case "historial":
        return historialCasos.sort((a, b) => b.reportado_dia.localeCompare(a.reportado_dia));
      case "dia":
        return diaSel
          ? casosSeguimiento.filter((c) => c.reportado_dia === diaSel)
          : [];
      default:
        return [];
    }
  }, [filtro, casosPendientes, casosResueltos, casosSeguimiento, historialCasos, diaSel]);

  const listaNovedades = useMemo(() => {
    switch (filtro) {
      case "novedades":
        return eventosOrdenados;
      case "dia":
        return diaSel ? eventosOrdenados.filter((e) => e.dia === diaSel) : [];
      case "historial":
        return eventosOrdenados.slice(0, 50);
      case "seguimiento":
        // Todas las novedades del periodo (positivas y negativas), como en el gráfico.
        return eventosOrdenados;
      default:
        return [];
    }
  }, [filtro, eventosOrdenados, diaSel]);

  const mostrarSalud =
    filtro === "seguimiento" || filtro === "salud" || filtro === "historial" || filtro === "dia";
  const mostrarNovedades =
    filtro === "seguimiento" ||
    filtro === "novedades" ||
    filtro === "historial" ||
    filtro === "dia";

  const diaMarcado = useMemo(() => {
    if (filtro === "dia" && diaSel) return diaSel;
    return null;
  }, [filtro, diaSel]);

  async function cambiarEstatus(id: string, estatus: EstatusCasoSalud) {
    setCambiandoId(id);
    try {
      await actualizarCasoSalud(id, { estatus });
    } finally {
      setCambiandoId(null);
    }
  }

  async function archivar(id: string) {
    setArchivandoId(id);
    try {
      await archivarCasoSalud(id);
      if (editandoCasoId === id) cancelarEdicionCaso();
    } finally {
      setArchivandoId(null);
    }
  }

  function cancelarEdicionCaso() {
    setEditandoCasoId(null);
    setBorradorCaso({ titulo: "", descripcion: "", estatus: "activo" });
  }

  function iniciarEdicionCaso(caso: CasoSaludCentro) {
    setEditandoNovedadId(null);
    setEditandoCasoId(caso.id);
    setBorradorCaso({
      titulo: caso.titulo,
      descripcion: caso.descripcion,
      estatus: caso.estatus,
    });
  }

  async function guardarCasoEditado(id: string) {
    if (!borradorCaso.titulo.trim()) return;
    setGuardandoCasoId(id);
    try {
      await actualizarCasoSalud(id, borradorCaso);
      cancelarEdicionCaso();
    } finally {
      setGuardandoCasoId(null);
    }
  }

  async function eliminarCaso(id: string) {
    setEliminandoCasoId(id);
    try {
      await archivarCasoSalud(id);
      if (editandoCasoId === id) cancelarEdicionCaso();
    } finally {
      setEliminandoCasoId(null);
    }
  }

  function cancelarEdicionNovedad() {
    setEditandoNovedadId(null);
    setBorradorNovedad({ tipo: "positivo", hora: "", titulo: "", descripcion: "" });
  }

  function iniciarEdicionNovedad(evento: EventoReporte) {
    setEditandoCasoId(null);
    setEditandoNovedadId(evento.id);
    setBorradorNovedad({
      tipo: evento.tipo,
      hora: horaDesdeTs(evento.ts),
      titulo: evento.titulo,
      descripcion: evento.descripcion,
    });
  }

  async function guardarNovedadEditada(evento: EventoReporte) {
    if (!borradorNovedad.titulo.trim()) return;
    setGuardandoNovedadId(evento.id);
    try {
      await actualizarEventoReporte(evento.id, {
        tipo: borradorNovedad.tipo,
        titulo: borradorNovedad.titulo,
        descripcion: borradorNovedad.descripcion,
        ts: tsDesdeHora(borradorNovedad.hora, evento.dia),
      });
      cancelarEdicionNovedad();
    } finally {
      setGuardandoNovedadId(null);
    }
  }

  async function eliminarNovedad(id: string) {
    setEliminandoNovedadId(id);
    try {
      await eliminarEventoReporte(id);
      if (editandoNovedadId === id) cancelarEdicionNovedad();
    } finally {
      setEliminandoNovedadId(null);
    }
  }

  const hayAlerta = contadores.casosActivos > 0 || contadores.novedadesNegativasRecientes > 0;
  const totalSeguimiento =
    casosPendientes.length +
    casosResueltos.length +
    saludSinDetalle.length +
    eventosOrdenados.length;
  const totalSaludTab = casosSeguimiento.length + saludSinDetalle.length;
  const totalHistorial = historialCasos.length + Math.min(eventosOrdenados.length, 50);

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

  function renderListaSalud(casosLista: CasoSaludCentro[], pendientesDetalle: typeof saludSinDetalle) {
    return (
      <div className="space-y-2">
        {pendientesDetalle.map((p) => (
          <TarjetaSaludPendienteDetalle
            key={`pendiente-${p.dia}`}
            dia={p.dia}
            reportadas={p.reportadas}
            faltan={p.faltan}
            onCompletar={
              puedeEditar && onIrAReporte ? () => onIrAReporte("salud") : undefined
            }
          />
        ))}
        {casosLista.length === 0 && pendientesDetalle.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <Stethoscope className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Sin casos de salud en seguimiento
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Regístralos en la fase Parte del reporte del día.
            </p>
            {puedeEditar && onIrAReporte && (
              <Button
                type="button"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => onIrAReporte("salud")}
              >
                <Stethoscope className="size-3.5" />
                Registrar en reporte
              </Button>
            )}
          </div>
        ) : (
          casosLista.map((c) => (
            <TarjetaCasoSalud
              key={c.id}
              caso={c}
              puedeEditar={puedeEditar}
              editando={editandoCasoId === c.id}
              borrador={borradorCaso}
              onBorradorChange={setBorradorCaso}
              onEditar={() => iniciarEdicionCaso(c)}
              onCancelarEdicion={cancelarEdicionCaso}
              onGuardar={() => void guardarCasoEditado(c.id)}
              onEliminar={() => void eliminarCaso(c.id)}
              cambiando={cambiandoId === c.id}
              archivando={archivandoId === c.id}
              eliminando={eliminandoCasoId === c.id}
              guardando={guardandoCasoId === c.id}
              onCambiarEstatus={(est) => void cambiarEstatus(c.id, est)}
              onArchivar={() => void archivar(c.id)}
            />
          ))
        )}
      </div>
    );
  }

  function renderListaNovedades(lista: EventoReporte[], vacioTitulo: string) {
    if (lista.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <CalendarPlus className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">{vacioTitulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Regístralas en la fase Novedades del reporte del día.
          </p>
          {puedeEditar && onIrAReporte && (
            <Button
              type="button"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => onIrAReporte("novedades")}
            >
              <CalendarPlus className="size-3.5" />
              Registrar en reporte
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {lista.map((e) => (
          <TarjetaNovedad
            key={e.id}
            evento={e}
            puedeEditar={puedeEditar}
            editando={editandoNovedadId === e.id}
            borrador={borradorNovedad}
            onBorradorChange={setBorradorNovedad}
            onEditar={() => iniciarEdicionNovedad(e)}
            onCancelarEdicion={cancelarEdicionNovedad}
            onGuardar={() => void guardarNovedadEditada(e)}
            onEliminar={() => void eliminarNovedad(e.id)}
            guardando={guardandoNovedadId === e.id}
            eliminando={eliminandoNovedadId === e.id}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Franja resumen */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          Salud:{" "}
          <span className={cn("font-medium", contadores.casosActivos > 0 ? "text-rose-400" : "text-foreground")}>
            {contadores.casosActivos > 0
              ? `${contadores.casosActivos} activo${contadores.casosActivos === 1 ? "" : "s"}`
              : "sin activos"}
          </span>
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="text-muted-foreground">
          Novedades:{" "}
          <span className="font-medium text-foreground">
            {eventosOrdenados.length > 0
              ? `${eventosOrdenados.length} (30d)`
              : "ninguna"}
          </span>
        </span>
        {contadores.novedadesNegativasRecientes > 0 && (
          <>
            <span className="hidden text-border sm:inline">·</span>
            <span className="font-medium text-rose-400">
              {contadores.novedadesNegativasRecientes} negativa
              {contadores.novedadesNegativasRecientes === 1 ? "" : "s"}
            </span>
          </>
        )}
        {contadores.casosResueltos > 0 && (
          <>
            <span className="hidden text-border sm:inline">·</span>
            <span className="font-medium text-emerald-400">
              {contadores.casosResueltos} por archivar
            </span>
          </>
        )}
      </div>

      {/* Evolución colapsable */}
      <Collapsible open={evolucionAbierta} onOpenChange={setEvolucionAbierta}>
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium text-foreground hover:text-teal-300"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    evolucionAbierta && "rotate-180",
                  )}
                />
                <span>Evolución diaria</span>
                {hayAlerta && (
                  <span className="size-1.5 shrink-0 rounded-full bg-rose-400" />
                )}
              </button>
            </CollapsibleTrigger>
            <Button
              type="button"
              size="xs"
              variant={calendarioAbierto ? "secondary" : "outline"}
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => setCalendarioAbierto((v) => !v)}
            >
              {calendarioAbierto ? (
                <PanelLeftClose className="size-3" />
              ) : (
                <PanelLeftOpen className="size-3" />
              )}
              <CalendarDays className="size-3" />
              {diaMarcado ? formatearDiaCalendario(diaMarcado) : "Fecha"}
            </Button>
          </div>
          <CollapsibleContent>
            <div className="flex items-stretch gap-2 border-t border-border p-2">
              {calendarioAbierto && (
                <div className="w-[11.5rem] shrink-0 sm:w-[12.5rem]">
                  <CalendarioSelectorDia
                    titulo="Calendario"
                    diaSeleccionado={filtro === "dia" ? diaSel : null}
                    onSeleccionarDia={(dia) => {
                      if (dia) seleccionarFiltro("dia", dia);
                      else if (filtro === "dia") seleccionarFiltro("seguimiento");
                    }}
                    marcasPorDia={marcasPorDia}
                    leyenda={LEYENDA_CALENDARIO}
                    onCerrar={() => setCalendarioAbierto(false)}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <GraficoSeguimientoCentro
                  centroId={centro.id}
                  snapshots={snapshots}
                  eventos={eventos}
                  diaMarcado={diaMarcado}
                  casosAbiertos={contadores.casosAbiertos}
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Tabs
        value={filtro === "dia" ? "seguimiento" : filtro}
        onValueChange={(v) => seleccionarFiltro(v as FiltroLista)}
        className="gap-0"
      >
        <div className="border-b border-border">
          <TabsList
            variant="line"
            className="!grid h-10 w-full grid-cols-4 gap-0 overflow-hidden rounded-none bg-transparent p-0"
          >
            <TabsTrigger value="seguimiento" className={tabTriggerClass}>
              <ClipboardCheck className="size-3.5 shrink-0" />
              <span className="truncate">Seguimiento</span>
              {totalSeguimiento > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] tabular-nums">
                  {totalSeguimiento}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="salud" className={tabTriggerClass}>
              <Stethoscope className="size-3.5 shrink-0" />
              <span className="truncate">Salud</span>
              {totalSaludTab > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 border-rose-500/30 bg-rose-500/10 px-1 text-[9px] tabular-nums text-rose-400"
                >
                  {totalSaludTab}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="novedades" className={tabTriggerClass}>
              <CalendarPlus className="size-3.5 shrink-0" />
              <span className="truncate">Novedades</span>
              {eventosOrdenados.length > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] tabular-nums">
                  {eventosOrdenados.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historial" className={tabTriggerClass}>
              <Clock className="size-3.5 shrink-0" />
              <span className="truncate">Historial</span>
              {totalHistorial > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] tabular-nums">
                  {totalHistorial}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Banner día filtrado */}
        {filtro === "dia" && diaSel && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs">
            <span className="text-sky-300">
              Filtrado por día {formatearDiaCalendario(diaSel)}
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-6"
              onClick={() => seleccionarFiltro("seguimiento")}
            >
              Quitar filtro
            </Button>
          </div>
        )}

        <TabsContent value="seguimiento" className="mt-4 space-y-5">
          {filtro === "dia" && diaSel ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Salud
                </p>
                {renderListaSalud(listaCasos, saludSinDetalleVisibles)}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Novedades
                </p>
                {renderListaNovedades(listaNovedades, "Sin novedades este día")}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Casos de salud activos y novedades del periodo.
                </p>
                {puedeEditar && onIrAReporte && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => onIrAReporte("salud")}
                    >
                      <Stethoscope className="size-3.5" />
                      Salud
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
                      onClick={() => onIrAReporte("novedades")}
                    >
                      <CalendarPlus className="size-3.5" />
                      Novedades
                    </Button>
                  </div>
                )}
              </div>
              {mostrarSalud && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Salud
                    {listaCasos.length + saludSinDetalleVisibles.length > 0
                      ? ` (${listaCasos.length + saludSinDetalleVisibles.length})`
                      : ""}
                  </p>
                  {renderListaSalud(listaCasos, saludSinDetalleVisibles)}
                </div>
              )}
              {mostrarNovedades && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Novedades
                    {listaNovedades.length > 0 ? ` (${listaNovedades.length})` : ""}
                  </p>
                  {renderListaNovedades(listaNovedades, "Sin novedades en el periodo")}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="salud" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Casos de salud del campamento en seguimiento.
            </p>
            {puedeEditar && onIrAReporte && (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
                onClick={() => onIrAReporte("salud")}
              >
                <Stethoscope className="size-3.5" />
                Registrar en reporte
              </Button>
            )}
          </div>
          {renderListaSalud(listaCasos, saludSinDetalleVisibles)}
        </TabsContent>

        <TabsContent value="novedades" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Novedades positivas y negativas de los últimos 30 días.
            </p>
            {puedeEditar && onIrAReporte && (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
                onClick={() => onIrAReporte("novedades")}
              >
                <CalendarPlus className="size-3.5" />
                Registrar en reporte
              </Button>
            )}
          </div>
          {renderListaNovedades(listaNovedades, "Sin novedades registradas")}
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-5">
          <p className="text-xs text-muted-foreground">
            Casos archivados y novedades recientes.
          </p>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Salud archivada
              {listaCasos.length > 0 ? ` (${listaCasos.length})` : ""}
            </p>
            {listaCasos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Sin casos archivados.
              </p>
            ) : (
              listaCasos.map((c) => (
                <TarjetaCasoSalud
                  key={c.id}
                  caso={c}
                  puedeEditar={puedeEditar}
                  editando={editandoCasoId === c.id}
                  borrador={borradorCaso}
                  onBorradorChange={setBorradorCaso}
                  onEditar={() => iniciarEdicionCaso(c)}
                  onCancelarEdicion={cancelarEdicionCaso}
                  onGuardar={() => void guardarCasoEditado(c.id)}
                  onEliminar={() => void eliminarCaso(c.id)}
                  cambiando={cambiandoId === c.id}
                  archivando={archivandoId === c.id}
                  eliminando={eliminandoCasoId === c.id}
                  guardando={guardandoCasoId === c.id}
                  onCambiarEstatus={(est) => void cambiarEstatus(c.id, est)}
                  onArchivar={() => void archivar(c.id)}
                />
              ))
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Novedades
              {listaNovedades.length > 0 ? ` (${listaNovedades.length})` : ""}
            </p>
            {listaNovedades.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Sin novedades en el historial.
              </p>
            ) : (
              listaNovedades.map((e) => (
                <TarjetaNovedad
                  key={e.id}
                  evento={e}
                  puedeEditar={puedeEditar}
                  editando={editandoNovedadId === e.id}
                  borrador={borradorNovedad}
                  onBorradorChange={setBorradorNovedad}
                  onEditar={() => iniciarEdicionNovedad(e)}
                  onCancelarEdicion={cancelarEdicionNovedad}
                  onGuardar={() => void guardarNovedadEditada(e)}
                  onEliminar={() => void eliminarNovedad(e.id)}
                  guardando={guardandoNovedadId === e.id}
                  eliminando={eliminandoNovedadId === e.id}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SeguimientoCompacto({
  centro,
  puedeEditar,
  onIrAReporte,
}: {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onIrAReporte?: (fase?: string) => void;
}) {
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const casos = useCasosSaludCentros({ centroId: centro.id, soloActivos: true });
  const eventos = useEventosReportes({ centroId: centro.id, dia: hoyClave });
  const pendientes = useMemo(() => casosSaludPendientes(casos), [casos]);
  const contadores = useMemo(
    () => contadoresSeguimientoCentro(casos, eventos, hoyClave),
    [casos, eventos, hoyClave],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Stethoscope className="size-4 text-teal-400" />
          Incidencias del reporte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {contadores.casosActivos > 0
            ? `${contadores.casosActivos} caso(s) de salud activo(s)`
            : "Sin casos de salud activos"}
          {eventos.length > 0 ? ` · ${eventos.length} novedad(es) hoy` : ""}
        </p>
        {pendientes.slice(0, 2).map((c) => (
          <div key={c.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
            <span className="font-medium">{c.titulo}</span>
            <BadgeAntiguedad reportadoDia={c.reportado_dia} className="ml-1.5" />
          </div>
        ))}
        {onIrAReporte && puedeEditar && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-1"
            onClick={() => onIrAReporte()}
          >
            Ver seguimiento completo
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SeccionSeguimientoReportesCentro({
  centro,
  puedeEditar,
  variant = "compacto",
  onIrAReporte,
}: Props) {
  if (variant === "expandido") {
    return (
      <SeguimientoExpandido centro={centro} puedeEditar={puedeEditar} onIrAReporte={onIrAReporte} />
    );
  }
  return (
    <SeguimientoCompacto centro={centro} puedeEditar={puedeEditar} onIrAReporte={onIrAReporte} />
  );
}

/** Alias de exportación para sustituir la sección anterior. */
export const SeccionIncidenciasCentro = SeccionSeguimientoReportesCentro;
