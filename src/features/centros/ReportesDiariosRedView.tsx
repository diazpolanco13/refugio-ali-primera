// Vista agregada de reportes diarios de toda la red de campamentos.

import { useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Copy,
  Download,
  FilterX,
  ListFilter,
  Loader2,
  Search,
  Share2,
  ShieldCheck,
  Package,
  Stethoscope,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesControlDia } from "@/data/useReportesControlDia";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useCensoRedResumen } from "@/data/useCensoRedResumen";
import { estadoCensoCentro } from "@/domain/censoResumen";
import { casosAbiertosSeguimiento } from "@/domain/casosSalud";
import { textoParteGeneralRed } from "@/domain/reporteTelegramRed";
import { claveDia } from "@/data/reposSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import {
  META_MARCADOR_OCUPACION,
  marcadorOcupacionCentro,
  metaCuerpoDe,
  ORDEN_MARCADOR_OCUPACION,
  type CentroTransitorio,
  type MarcadorOcupacionCentro,
} from "@/domain/centrosTransitorios";
import { aplicarParteActualACentro } from "@/domain/parteActualCentros";
import {
  refugiadosEnSnapshot,
  type SnapshotOcupacion,
} from "@/domain/serieOcupacionCentros";
import {
  META_ESTADO_REPORTE,
  estadoReporteDia,
  eventosRevisados,
  reporteDelDia,
  ultimosDiasReporte,
  type EstadoReporteDia,
  type ReporteDiario,
} from "@/domain/reporteDiario";
import { construirReporteEjecutivoCampamentos } from "@/domain/reporteEjecutivoCampamentos";
import type { Sesion } from "@/data/authSupabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogoCuerpo } from "@/components/LogoCuerpo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CalendarioSelectorDia,
  formatearDiaCalendario,
} from "./CalendarioSelectorDia";
import { normalizarTextoBusqueda } from "./CentrosListaItems";

type FiltroEstado = EstadoReporteDia | "todos";
type FiltroOcupacion = MarcadorOcupacionCentro | "todos";

interface OutletContext {
  sesion: Sesion;
}

type OrdenReportes =
  | "pendientes"
  | "completos"
  | "nro_asc"
  | "nro_desc"
  | "nombre_asc"
  | "nombre_desc"
  | "refugiados"
  | "raciones"
  | "atenciones";

const ORDEN_ESTADO: Record<EstadoReporteDia, number> = {
  pendiente: 0,
  solo_parte: 1,
  parcial: 2,
  completo: 3,
};

const OPCIONES_ORDEN: { valor: OrdenReportes; label: string }[] = [
  { valor: "pendientes", label: "Pendientes primero" },
  { valor: "completos", label: "Completos primero" },
  { valor: "nro_asc", label: "N.° ascendente" },
  { valor: "nro_desc", label: "N.° descendente" },
  { valor: "nombre_asc", label: "Nombre A → Z" },
  { valor: "nombre_desc", label: "Nombre Z → A" },
  { valor: "refugiados", label: "Más refugiados" },
  { valor: "raciones", label: "Más raciones" },
  { valor: "atenciones", label: "Más atenciones" },
];

function colorRedPorDia(estados: EstadoReporteDia[]): string | undefined {
  if (estados.length === 0) return undefined;
  const total = estados.length;
  const completos = estados.filter((e) => e === "completo").length;
  const pendientes = estados.filter((e) => e === "pendiente").length;
  if (completos === total) return META_ESTADO_REPORTE.completo.color;
  if (pendientes === total) return META_ESTADO_REPORTE.pendiente.color;
  if (completos > 0 || estados.some((e) => e === "parcial" || e === "solo_parte")) {
    return META_ESTADO_REPORTE.parcial.color;
  }
  return META_ESTADO_REPORTE.pendiente.color;
}

function ordenarFilas<
  T extends {
    centro: CentroTransitorio;
    estado: EstadoReporteDia;
    damnificados: number;
    incidenciasSalud: number;
    eventos: number;
  },
>(filas: T[], orden: OrdenReportes): T[] {
  const copia = [...filas];
  switch (orden) {
    case "completos":
      return copia.sort(
        (a, b) =>
          ORDEN_ESTADO[b.estado] - ORDEN_ESTADO[a.estado] ||
          (a.centro.nro ?? 0) - (b.centro.nro ?? 0),
      );
    case "nro_asc":
      return copia.sort((a, b) => (a.centro.nro ?? 0) - (b.centro.nro ?? 0));
    case "nro_desc":
      return copia.sort((a, b) => (b.centro.nro ?? 0) - (a.centro.nro ?? 0));
    case "nombre_asc":
      return copia.sort((a, b) =>
        a.centro.nombre.localeCompare(b.centro.nombre, "es"),
      );
    case "nombre_desc":
      return copia.sort((a, b) =>
        b.centro.nombre.localeCompare(a.centro.nombre, "es"),
      );
    case "refugiados":
      return copia.sort(
        (a, b) =>
          b.damnificados - a.damnificados ||
          (a.centro.nro ?? 0) - (b.centro.nro ?? 0),
      );
    case "raciones":
      return copia.sort(
        (a, b) =>
          b.incidenciasSalud - a.incidenciasSalud ||
          ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
          (a.centro.nro ?? 0) - (b.centro.nro ?? 0),
      );
    case "atenciones":
      return copia.sort(
        (a, b) =>
          b.eventos - a.eventos ||
          ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
          (a.centro.nro ?? 0) - (b.centro.nro ?? 0),
      );
    case "pendientes":
    default:
      return copia.sort(
        (a, b) =>
          ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
          (a.centro.nro ?? 0) - (b.centro.nro ?? 0),
      );
  }
}

function porcentajeEntero(valor: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((valor / total) * 100)}%`;
}

function parsearDiaReporte(dia: string): Date {
  const [year, month, day] = dia.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function moverDiaReporte(dia: string, dias: number): string {
  const fecha = parsearDiaReporte(dia);
  fecha.setDate(fecha.getDate() + dias);
  return claveDia(fecha.getTime());
}

function formatearDiaSelector(dia: string): string {
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
    .format(parsearDiaReporte(dia))
    .replace(/\./g, "");
}

function TarjetaTotalIndicadorReporte({
  titulo,
  icono,
  valor,
  completados,
  total,
  color,
}: {
  titulo: string;
  icono: React.ReactNode;
  valor: React.ReactNode;
  completados: number;
  total: number;
  color: string;
}) {
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;
  const faltan = Math.max(0, total - completados);

  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/80 p-2 sm:rounded-xl sm:p-3">
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-muted-foreground sm:gap-1.5 sm:text-xs">
          {icono}
          <span className="truncate leading-tight">{titulo}</span>
        </span>
        <span
          className="shrink-0 rounded-full px-1 py-0.5 text-[9px] font-medium tabular-nums sm:px-1.5 sm:text-[10px]"
          style={{ background: `${color}22`, color }}
        >
          {porcentajeEntero(completados, total)}
        </span>
      </div>
      <div className="mt-1 sm:mt-2">
        <span className="text-lg font-semibold leading-none tabular-nums text-foreground sm:text-2xl">
          {valor}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
        {completados.toLocaleString("es")} de {total.toLocaleString("es")} campamentos
        {faltan > 0 ? (
          <span className="text-muted-foreground/80"> · faltan {faltan.toLocaleString("es")}</span>
        ) : (
          <span style={{ color }}> · completo</span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%`, background: color }}
        />
      </div>
    </div>
  );
}

function TarjetaTotalRefugios({
  total,
  activo,
  onClick,
}: {
  total: number;
  activo: boolean;
  onClick: () => void;
}) {
  const color = "#38bdf8";
  const porcentaje = 100;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group min-w-0 rounded-lg border bg-background/80 p-2 text-left transition-all sm:rounded-xl sm:p-3 sm:hover:-translate-y-0.5 sm:hover:bg-muted/20",
        activo ? "border-primary/60 ring-2 ring-primary/15" : "border-border/70",
      )}
      style={{
        borderColor: activo ? `${color}99` : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-muted-foreground sm:gap-1.5 sm:text-xs">
          <Building2 className="size-3 shrink-0" style={{ color }} />
          <span className="truncate leading-tight">Total de refugios</span>
        </span>
        <span className="shrink-0 rounded-full bg-muted/60 px-1 py-0.5 text-[9px] font-medium tabular-nums text-muted-foreground sm:px-1.5 sm:text-[10px]">
          100%
        </span>
      </div>
      <div className="mt-1 flex items-end gap-1 sm:mt-2 sm:gap-1.5">
        <span className="text-lg font-semibold leading-none tabular-nums text-foreground sm:text-2xl">
          {total.toLocaleString("es")}
        </span>
        <span className="pb-0.5 text-[10px] text-muted-foreground sm:text-[11px]">ctros</span>
      </div>
      <div className="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-muted sm:block">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${porcentaje}%`, background: color }}
        />
      </div>
    </button>
  );
}

function TarjetaMarcadorOcupacion({
  marcador,
  cantidad,
  total,
  activo,
  onClick,
}: {
  marcador: MarcadorOcupacionCentro;
  cantidad: number;
  total: number;
  activo: boolean;
  onClick: () => void;
}) {
  const meta = META_MARCADOR_OCUPACION[marcador];
  const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group min-w-0 rounded-lg border bg-background/80 p-2 text-left transition-all sm:rounded-xl sm:p-3 sm:hover:-translate-y-0.5 sm:hover:bg-muted/20",
        activo ? "border-primary/60 ring-2 ring-primary/15" : "border-border/70",
      )}
      style={{
        borderColor: activo ? `${meta.color}99` : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-muted-foreground sm:gap-1.5 sm:text-xs">
          <span
            className="size-1.5 shrink-0 rounded-full sm:size-2"
            style={{ background: meta.color }}
          />
          <span className="truncate leading-tight">{meta.label}</span>
        </span>
        <span className="shrink-0 rounded-full bg-muted/60 px-1 py-0.5 text-[9px] font-medium tabular-nums text-muted-foreground sm:px-1.5 sm:text-[10px]">
          {porcentajeEntero(cantidad, total)}
        </span>
      </div>
      <div className="mt-1 flex items-end gap-1 sm:mt-2 sm:gap-1.5">
        <span className="text-lg font-semibold leading-none tabular-nums text-foreground sm:text-2xl">
          {cantidad}
        </span>
        <span className="pb-0.5 text-[10px] text-muted-foreground sm:text-[11px]">ctros</span>
      </div>
      <div className="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-muted sm:block">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${porcentaje}%`, background: meta.color }}
        />
      </div>
    </button>
  );
}

function claseChipFiltro(activo: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
    activo
      ? "ring-1 ring-primary/25"
      : "hover:bg-muted/45",
  );
}

function estiloChipFiltro(activo: boolean, color: string): React.CSSProperties {
  return activo
    ? { borderColor: `${color}99`, background: `${color}18`, color }
    : { borderColor: `${color}44`, background: `${color}0d` };
}

function BadgeMarcadorOcupacion({ marcador }: { marcador: MarcadorOcupacionCentro }) {
  const meta = META_MARCADOR_OCUPACION[marcador];
  return (
    <Badge
      variant="outline"
      className="h-5 shrink-0 px-1.5 text-[10px] font-medium sm:h-7 sm:px-2 sm:text-xs"
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      {meta.label}
    </Badge>
  );
}

function marcadorCentroDia(
  centro: CentroTransitorio,
  snap: SnapshotOcupacion | undefined,
): MarcadorOcupacionCentro {
  const base = snap ? aplicarParteActualACentro(centro, snap) : centro;
  return marcadorOcupacionCentro(base);
}

function SelectorFechaReporte({
  dia,
  onSeleccionarDia,
  marcasPorDia,
  leyenda,
  hoyClave,
  className,
}: {
  dia: string;
  onSeleccionarDia: (dia: string) => void;
  marcasPorDia: Map<string, string>;
  leyenda: { color: string; label: string }[];
  hoyClave?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const esHoy = hoyClave !== undefined && dia === hoyClave;

  function seleccionarDia(nuevoDia: string | null) {
    if (!nuevoDia) return;
    onSeleccionarDia(nuevoDia);
    setAbierto(false);
  }

  return (
    <div
      className={cn(
        "flex h-8 min-w-0 overflow-hidden rounded-lg border",
        esHoy
          ? "border-emerald-500/50 bg-emerald-500/10"
          : "border-border/60 bg-card/70",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="h-full rounded-none border-r border-border/60"
        title="Día anterior"
        onClick={() => onSeleccionarDia(moverDiaReporte(dia, -1))}
      >
        <ChevronLeft className="size-3.5" />
      </Button>

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-full min-w-0 flex-1 rounded-none px-2 text-xs font-semibold tracking-wide tabular-nums",
              esHoy && "text-emerald-400",
            )}
          >
            {formatearDiaSelector(dia)}
            {esHoy ? " · Hoy" : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[260px] overflow-hidden p-0">
          <CalendarioSelectorDia
            embebido
            diaSeleccionado={dia}
            onSeleccionarDia={seleccionarDia}
            marcasPorDia={marcasPorDia}
            leyenda={leyenda}
            titulo="Seleccionar día"
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="h-full rounded-none border-l border-border/60"
        title="Día siguiente"
        onClick={() => onSeleccionarDia(moverDiaReporte(dia, 1))}
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

function BuscadorNombreCampamento({
  valor,
  onChange,
  inputRef,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por nombre…"
        aria-label="Buscar campamento por nombre"
        className="h-8 border-border/60 bg-background/80 pl-7 pr-7 text-xs sm:h-7"
      />
      {valor && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef?.current?.focus();
          }}
          title="Limpiar búsqueda"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

type DatosCompletitudReporte = {
  estado: EstadoReporteDia;
  parte: boolean;
  controlRevisado: boolean;
  trabajosRevisados: boolean;
  requerimientosRevisados: boolean;
  eventosRevisados: boolean;
};

const BLOQUES_COMPLETITUD_REPORTE: {
  fase: string;
  label: string;
  labelCorto: string;
  listo: (datos: DatosCompletitudReporte) => boolean;
}[] = [
  { fase: "parte", label: "Parte numérico", labelCorto: "Parte", listo: (d) => d.parte },
  {
    fase: "control",
    label: "Control operativo",
    labelCorto: "Control",
    listo: (d) => d.controlRevisado,
  },
  {
    fase: "trabajos",
    label: "Trabajos",
    labelCorto: "Trabajos",
    listo: (d) => d.trabajosRevisados,
  },
  {
    fase: "requerimientos",
    label: "Requerimientos",
    labelCorto: "Req.",
    listo: (d) => d.requerimientosRevisados,
  },
  {
    fase: "novedades",
    label: "Novedades",
    labelCorto: "Noved.",
    listo: (d) => d.eventosRevisados,
  },
];

function bloquesPendientesReporte(datos: DatosCompletitudReporte) {
  if (datos.estado === "completo") return [];
  return BLOQUES_COMPLETITUD_REPORTE.filter((bloque) => !bloque.listo(datos));
}

function fasePendienteReporte(datos: DatosCompletitudReporte): string | undefined {
  return bloquesPendientesReporte(datos)[0]?.fase;
}

function tituloFaltantesReporte(pendientes: typeof BLOQUES_COMPLETITUD_REPORTE): string | undefined {
  if (pendientes.length === 0) return undefined;
  return `Falta confirmar: ${pendientes.map((b) => b.label).join(", ")}`;
}

function IndicadorBloqueReporte({
  titulo,
  icono,
  valor,
  listo,
  destacarFaltante = false,
  compacto = false,
  className,
}: {
  titulo: string;
  icono: React.ReactNode;
  valor: React.ReactNode;
  listo: boolean;
  destacarFaltante?: boolean;
  compacto?: boolean;
  className?: string;
}) {
  const falta = destacarFaltante && !listo;
  const tituloTooltip = falta ? `${titulo} · pendiente de confirmar` : titulo;

  return (
    <span
      title={tituloTooltip}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-lg border tabular-nums",
        compacto ? "h-5 gap-0.5 px-1 text-[10px]" : "h-7 gap-1 px-2 text-xs",
        listo
          ? cn("border-teal-400/25 bg-teal-400/10 text-teal-100", className)
          : cn(
              "border-border/60 bg-muted/20 text-muted-foreground",
              falta && "border-dashed opacity-80",
            ),
      )}
    >
      {falta ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-1 rounded-full bg-amber-500/80"
        />
      ) : null}
      {icono}
      <span className="font-semibold">{valor}</span>
    </span>
  );
}

/** Tablero global de reportes diarios por campamento. */
export function ReportesDiariosRedView() {
  const { sesion } = useOutletContext<OutletContext>();
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => ultimosDiasReporte(30, hoyClave)[0], [hoyClave]);

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

  const reportes = useReportesCentros({ desde });
  const controles = useReportesControlDia({ desde });
  const eventos = useEventosReportes({ desde });
  const snapshots = useOcupacionesCentros({ desde });
  const { trabajos: trabajosRed } = useReparacionesCentros({ soloActivos: true });
  const { requerimientos: requerimientosRed } = useRequerimientosSeguimiento({ soloActivos: true });
  const casosSaludRed = useCasosSaludCentros({ soloActivos: true });
  const { resumenes: censoResumenes } = useCensoRedResumen();
  const censoEstados = useMemo(() => {
    if (!censoResumenes.length) return null;
    const conteo = { completados: 0, enCurso: 0, sinIniciar: 0 };
    for (const r of censoResumenes) {
      const estado = estadoCensoCentro(r);
      if (estado === "completado_declarado" || estado === "sin_ocupantes") conteo.completados += 1;
      else if (estado === "en_curso") conteo.enCurso += 1;
      else conteo.sinIniciar += 1;
    }
    return conteo;
  }, [censoResumenes]);

  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [menuCompartirAbierto, setMenuCompartirAbierto] = useState(false);

  async function descargarPdfEjecutivo() {
    setGenerandoPdf(true);
    try {
      const [{ pdf }, { ReporteEjecutivoCampamentosPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./reporte-ejecutivo/ReporteEjecutivoCampamentosPdf"),
      ]);
      const blob = await pdf(
        <ReporteEjecutivoCampamentosPdf reporte={reporteEjecutivo} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `parte-global-campamentos-${diaActivo}.pdf`;
      enlace.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerandoPdf(false);
    }
  }

  const [parteCompartir, setParteCompartir] = useState<string | null>(null);
  const [copiadoDialogo, setCopiadoDialogo] = useState(false);
  const areaParteRef = useRef<HTMLTextAreaElement>(null);

  function abrirParteRed() {
    setParteCompartir(
      textoParteGeneralRed({
        centros,
        dia: diaActivo,
        snapshots,
        controlesDia: controles.filter((c) => c.dia === diaActivo),
        casosSaludAbiertos: casosAbiertosSeguimiento(casosSaludRed),
        trabajosActivos: trabajosRed,
        requerimientosActivos: requerimientosRed,
        eventosDia: eventos.filter((e) => e.dia === diaActivo),
        incidenciasAbiertas: casosAbiertosSeguimiento(casosSaludRed).length,
      }),
    );
    setCopiadoDialogo(false);
    setMenuCompartirAbierto(false);
  }

  /** Copia desde el textarea visible: única vía fiable en despliegues http. */
  async function copiarDesdeDialogo() {
    let ok = false;
    if (window.isSecureContext && navigator.clipboard && parteCompartir) {
      try {
        await navigator.clipboard.writeText(parteCompartir);
        ok = true;
      } catch {
        /* cae al fallback */
      }
    }
    const area = areaParteRef.current;
    if (!ok && area) {
      area.focus();
      area.select();
      ok = document.execCommand("copy");
    }
    setCopiadoDialogo(ok);
    if (ok) window.setTimeout(() => setCopiadoDialogo(false), 2000);
  }

  const reportesPorCentroDia = useMemo(() => {
    const m = new Map<string, ReporteDiario>();
    for (const r of reportes) m.set(`${r.centro_id}:${r.dia}`, r);
    return m;
  }, [reportes]);

  const diasConPartePorCentro = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of snapshots) {
      if (!m.has(s.centro_id)) m.set(s.centro_id, new Set());
      m.get(s.centro_id)!.add(s.dia);
    }
    return m;
  }, [snapshots]);

  const controlesPorCentroDia = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of controles) {
      if (c.revisado) m.set(`${c.centro_id}:${c.dia}`, true);
    }
    return m;
  }, [controles]);

  const reportesRepPorCentroDia = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of reportes) {
      if (r.trabajos_revisados) m.set(`${r.centro_id}:${r.dia}`, true);
    }
    return m;
  }, [reportes]);

  const requerimientosPorCentroDia = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of reportes) {
      if (r.requerimientos_revisados) m.set(`${r.centro_id}:${r.dia}`, true);
    }
    return m;
  }, [reportes]);

  const trabajosActivosPorCentro = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trabajosRed) m.set(t.centro_id, (m.get(t.centro_id) ?? 0) + 1);
    return m;
  }, [trabajosRed]);

  const requerimientosActivosPorCentro = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requerimientosRed) m.set(r.centro_id, (m.get(r.centro_id) ?? 0) + 1);
    return m;
  }, [requerimientosRed]);

  const eventosPorCentroDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventos) {
      const key = `${e.centro_id}:${e.dia}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [eventos]);

  function estadoCentroDia(centroId: string, dia: string): EstadoReporteDia {
    const reporte = reportesPorCentroDia.get(`${centroId}:${dia}`);
    const tieneParte = diasConPartePorCentro.get(centroId)?.has(dia) ?? false;
    const key = `${centroId}:${dia}`;
    return estadoReporteDia(reporte, tieneParte, {
      controlRevisado: controlesPorCentroDia.has(key),
      trabajosRevisados:
        reportesRepPorCentroDia.has(key) || reporte?.trabajos_revisados === true,
      requerimientosRevisados:
        requerimientosPorCentroDia.has(key) || reporte?.requerimientos_revisados === true,
      eventosRevisados: eventosRevisados(reporte, eventosPorCentroDia.get(key) ?? 0),
    });
  }

  const [dia, setDia] = useState<string | null>(hoyClave);
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>("todos");
  const [ocupacionFiltro, setOcupacionFiltro] = useState<FiltroOcupacion>("todos");
  const [grupoFiltro, setGrupoFiltro] = useState<string>("todos");
  const [orden, setOrden] = useState<OrdenReportes>("pendientes");
  const [busquedaNombre, setBusquedaNombre] = useState("");
  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const grupos = useMemo(
    () => [...new Set(centros.map((c) => c.grupo).filter(Boolean))].sort(),
    [centros],
  );

  const diaActivo = dia ?? hoyClave;

  const terminoBusqueda = useMemo(
    () => normalizarTextoBusqueda(busquedaNombre.trim()),
    [busquedaNombre],
  );

  const filas = useMemo(() => {
    const base = centros
      .filter((c) => grupoFiltro === "todos" || c.grupo === grupoFiltro)
      .map((centro) => {
        const estado = estadoCentroDia(centro.id, diaActivo);
        const reporte = reporteDelDia(reportes, centro.id, diaActivo);
        const key = `${centro.id}:${diaActivo}`;
        const controlOk = controlesPorCentroDia.has(key);
        const eventosCount = eventosPorCentroDia.get(key) ?? 0;
        const snap = snapshots.find((s) => s.centro_id === centro.id && s.dia === diaActivo);
        const parte = diasConPartePorCentro.get(centro.id)?.has(diaActivo) ?? false;
        const marcadorOcupacion = marcadorCentroDia(centro, snap);
        return {
          centro,
          estado,
          marcadorOcupacion,
          parte,
          controlRevisado: controlOk,
          trabajosRevisados:
            reportesRepPorCentroDia.has(key) || reporte?.trabajos_revisados === true,
          requerimientosRevisados:
            requerimientosPorCentroDia.has(key) || reporte?.requerimientos_revisados === true,
          eventosRevisados: eventosRevisados(reporte, eventosCount),
          incidenciasSalud: snap?.incidencias_salud ?? 0,
          eventos: eventosCount,
          damnificados: snap ? refugiadosEnSnapshot(snap) : 0,
          trabajosActivos: trabajosActivosPorCentro.get(centro.id) ?? 0,
          requerimientosActivos: requerimientosActivosPorCentro.get(centro.id) ?? 0,
        };
      })
      .filter((f) => estadoFiltro === "todos" || f.estado === estadoFiltro)
      .filter((f) => ocupacionFiltro === "todos" || f.marcadorOcupacion === ocupacionFiltro)
      .filter(
        (f) =>
          !terminoBusqueda ||
          normalizarTextoBusqueda(f.centro.nombre).includes(terminoBusqueda),
      );

    return ordenarFilas(base, orden);
  }, [
    centros,
    diaActivo,
    estadoFiltro,
    ocupacionFiltro,
    grupoFiltro,
    orden,
    reportes,
    controles,
    controlesPorCentroDia,
    reportesPorCentroDia,
    reportesRepPorCentroDia,
    requerimientosPorCentroDia,
    eventosPorCentroDia,
    trabajosActivosPorCentro,
    requerimientosActivosPorCentro,
    diasConPartePorCentro,
    snapshots,
    terminoBusqueda,
  ]);

  const conteosHoy = useMemo(() => {
    const m: Record<EstadoReporteDia, number> = {
      completo: 0,
      parcial: 0,
      solo_parte: 0,
      pendiente: 0,
    };
    for (const c of centros) {
      m[estadoCentroDia(c.id, hoyClave)]++;
    }
    return m;
  }, [centros, hoyClave, reportes, controles, eventos, snapshots]);

  const marcasPorDia = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of ultimosDiasReporte(30, hoyClave)) {
      const estados = centros.map((c) => estadoCentroDia(c.id, d));
      const color = colorRedPorDia(estados);
      if (color) m.set(d, color);
    }
    return m;
  }, [centros, hoyClave, reportes, controles, eventos, snapshots]);

  const leyendaCalendario = useMemo(
    () =>
      (Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => ({
        color: META_ESTADO_REPORTE[e].color,
        label: META_ESTADO_REPORTE[e].label,
      })),
    [],
  );

  const conteosOcupacionDiaActivo = useMemo(() => {
    const m: Record<MarcadorOcupacionCentro, number> = {
      activo: 0,
      sin_refugiados: 0,
    };
    for (const c of centros) {
      const snap = snapshots.find((s) => s.centro_id === c.id && s.dia === diaActivo);
      m[marcadorCentroDia(c, snap)]++;
    }
    return m;
  }, [centros, diaActivo, snapshots]);

  const conteosOcupacionHoy = useMemo(() => {
    const m: Record<MarcadorOcupacionCentro, number> = {
      activo: 0,
      sin_refugiados: 0,
    };
    for (const c of centros) {
      const snap = snapshots.find((s) => s.centro_id === c.id && s.dia === hoyClave);
      m[marcadorCentroDia(c, snap)]++;
    }
    return m;
  }, [centros, hoyClave, snapshots]);

  const totalesIndicadoresDia = useMemo(() => {
    let partes = 0;
    let controlOk = 0;
    let trabajosOk = 0;
    let requerimientosOk = 0;
    let eventosOk = 0;
    let incidenciasSalud = 0;
    let eventos = 0;
    let refugiados = 0;

    for (const centro of centros) {
      const key = `${centro.id}:${diaActivo}`;
      const reporte = reporteDelDia(reportes, centro.id, diaActivo);
      const tieneParte = diasConPartePorCentro.get(centro.id)?.has(diaActivo) ?? false;
      const eventosCount = eventosPorCentroDia.get(key) ?? 0;

      if (tieneParte) {
        partes++;
        const snap = snapshots.find(
          (s) => s.centro_id === centro.id && s.dia === diaActivo,
        );
        if (snap) {
          refugiados += refugiadosEnSnapshot(snap);
          incidenciasSalud += snap.incidencias_salud ?? 0;
        }
      }
      if (controlesPorCentroDia.has(key)) controlOk++;
      if (reportesRepPorCentroDia.has(key) || reporte?.trabajos_revisados) trabajosOk++;
      if (requerimientosPorCentroDia.has(key) || reporte?.requerimientos_revisados) {
        requerimientosOk++;
      }
      if (eventosRevisados(reporte, eventosCount)) eventosOk++;
      eventos += eventosCount;
    }

    return {
      partes,
      controlOk,
      trabajosOk,
      requerimientosOk,
      eventosOk,
      incidenciasSalud,
      eventos,
      refugiados,
    };
  }, [
    centros,
    diaActivo,
    reportes,
    controlesPorCentroDia,
    reportesRepPorCentroDia,
    requerimientosPorCentroDia,
    snapshots,
    diasConPartePorCentro,
    eventosPorCentroDia,
  ]);


  const hayFiltros =
    estadoFiltro !== "todos" ||
    ocupacionFiltro !== "todos" ||
    grupoFiltro !== "todos" ||
    dia !== hoyClave ||
    orden !== "pendientes" ||
    busquedaNombre.trim() !== "";

  const reporteEjecutivo = useMemo(
    () =>
      construirReporteEjecutivoCampamentos({
        centros,
        snapshots,
        reportes,
        eventos,
        incidencias: [],
        controles,
        trabajosActivos: trabajosRed,
        requerimientosActivos: requerimientosRed,
        casosSaludAbiertos: casosAbiertosSeguimiento(casosSaludRed),
        eventosDetalle: eventos,
        censoEstados,
        dia: diaActivo,
        generadoPor: sesion.user.nombre ?? sesion.user.username,
      }),
    [
      centros,
      snapshots,
      reportes,
      eventos,
      controles,
      trabajosRed,
      requerimientosRed,
      casosSaludRed,
      censoEstados,
      diaActivo,
      sesion.user.nombre,
      sesion.user.username,
    ],
  );

  function limpiarFiltros() {
    setEstadoFiltro("todos");
    setOcupacionFiltro("todos");
    setGrupoFiltro("todos");
    setDia(hoyClave);
    setOrden("pendientes");
    setBusquedaNombre("");
    setFiltrosAbiertos(false);
  }

  const selectoresFiltro = (
    <>
      <Select
        value={estadoFiltro}
        onValueChange={(v) => setEstadoFiltro(v as FiltroEstado)}
      >
        <SelectTrigger className="h-8 w-full bg-card/70 text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {(Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => (
            <SelectItem key={e} value={e}>
              <span
                className="mr-1.5 inline-block size-2 rounded-full"
                style={{ background: META_ESTADO_REPORTE[e].color }}
              />
              {META_ESTADO_REPORTE[e].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={ocupacionFiltro}
        onValueChange={(v) => setOcupacionFiltro(v as FiltroOcupacion)}
      >
        <SelectTrigger className="h-8 w-full bg-card/70 text-xs">
          <SelectValue placeholder="Ocupación" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos (activos y vacíos)</SelectItem>
          {ORDEN_MARCADOR_OCUPACION.map((m) => (
            <SelectItem key={m} value={m}>
              <span
                className="mr-1.5 inline-block size-2 rounded-full"
                style={{ background: META_MARCADOR_OCUPACION[m].color }}
              />
              {META_MARCADOR_OCUPACION[m].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={grupoFiltro} onValueChange={setGrupoFiltro}>
        <SelectTrigger className="h-8 w-full bg-card/70 text-xs">
          <SelectValue placeholder="Grupo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los grupos</SelectItem>
          {grupos.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={orden} onValueChange={(v) => setOrden(v as OrdenReportes)}>
        <SelectTrigger className="h-8 w-full bg-card/70 text-xs">
          <SelectValue placeholder="Orden" />
        </SelectTrigger>
        <SelectContent>
          {OPCIONES_ORDEN.map(({ valor, label }) => (
            <SelectItem key={valor} value={valor}>
              {(valor === "nombre_asc" || valor === "nombre_desc") && (
                <span className="mr-1.5 inline-flex">
                  {valor === "nombre_asc" ? (
                    <ArrowDownAZ className="size-3" />
                  ) : (
                    <ArrowUpAZ className="size-3" />
                  )}
                </span>
              )}
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
      <VistaEncabezado
        icono={ClipboardList}
        acento="teal"
        compacto
        titulo="Reportes por campamento"
        descripcion="Corte diario de la red · clic en una fila para abrir la ficha del centro"
        acciones={
          <>
            <Badge variant="outline" className="hidden gap-1.5 border-teal-400/30 bg-teal-400/10 text-teal-200 sm:inline-flex">
              <CalendarDays className="size-3" />
              <span className="tabular-nums">{formatearDiaSelector(diaActivo)}</span>
              {diaActivo === hoyClave ? " · Hoy" : ""}
            </Badge>
            <DropdownMenu open={menuCompartirAbierto} onOpenChange={setMenuCompartirAbierto}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 bg-teal-600 text-xs hover:bg-teal-500"
                >
                  {generandoPdf ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Share2 className="size-3.5" />
                  )}
                  Compartir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => abrirParteRed()}>
                  <Copy className="size-4" />
                  Copiar parte (Telegram)
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={generandoPdf}
                  onSelect={(e) => {
                    e.preventDefault();
                    void descargarPdfEjecutivo().then(() => setMenuCompartirAbierto(false));
                  }}
                >
                  <Download className="size-4" />
                  {generandoPdf ? "Generando PDF…" : "Descargar PDF ejecutivo"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

          <div className="border-b border-border bg-muted/10 px-3 py-2.5 sm:px-4 sm:py-4 lg:px-6">
            <div className="space-y-2 sm:space-y-3">
                {/* Móvil: fecha a todo el ancho (verde cuando es hoy) */}
                <div className="md:hidden">
                  <SelectorFechaReporte
                    dia={diaActivo}
                    onSeleccionarDia={setDia}
                    marcasPorDia={marcasPorDia}
                    leyenda={leyendaCalendario}
                    hoyClave={hoyClave}
                    className="h-9 w-full"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <TarjetaTotalRefugios
                    total={centros.length}
                    activo={ocupacionFiltro === "todos"}
                    onClick={() => setOcupacionFiltro("todos")}
                  />
                  {ORDEN_MARCADOR_OCUPACION.map((m) => (
                    <TarjetaMarcadorOcupacion
                      key={m}
                      marcador={m}
                      cantidad={conteosOcupacionDiaActivo[m]}
                      total={centros.length}
                      activo={ocupacionFiltro === m}
                      onClick={() => setOcupacionFiltro(ocupacionFiltro === m ? "todos" : m)}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-3 xl:grid-cols-5">
                  <TarjetaTotalIndicadorReporte
                    titulo="Total refugiados"
                    icono={<Users className="size-3 shrink-0 text-sky-400" />}
                    valor={totalesIndicadoresDia.refugiados.toLocaleString("es")}
                    completados={totalesIndicadoresDia.partes}
                    total={centros.length}
                    color="#38bdf8"
                  />
                  <TarjetaTotalIndicadorReporte
                    titulo="Control"
                    icono={<ShieldCheck className="size-3 shrink-0 text-violet-400" />}
                    valor={totalesIndicadoresDia.controlOk.toLocaleString("es")}
                    completados={totalesIndicadoresDia.controlOk}
                    total={centros.length}
                    color="#a78bfa"
                  />
                  <TarjetaTotalIndicadorReporte
                    titulo="Trabajos"
                    icono={<Wrench className="size-3 shrink-0 text-amber-400" />}
                    valor={trabajosRed.length.toLocaleString("es")}
                    completados={totalesIndicadoresDia.trabajosOk}
                    total={centros.length}
                    color="#fbbf24"
                  />
                  <TarjetaTotalIndicadorReporte
                    titulo="Requerimientos"
                    icono={<Package className="size-3 shrink-0 text-orange-400" />}
                    valor={requerimientosRed.length.toLocaleString("es")}
                    completados={totalesIndicadoresDia.requerimientosOk}
                    total={centros.length}
                    color="#fb923c"
                  />
                  <TarjetaTotalIndicadorReporte
                    titulo="Novedades"
                    icono={<CalendarPlus className="size-3 shrink-0 text-emerald-400" />}
                    valor={totalesIndicadoresDia.eventos.toLocaleString("es")}
                    completados={totalesIndicadoresDia.eventosOk}
                    total={centros.length}
                    color="#34d399"
                  />
                </div>

                {/* Móvil: filtros colapsables */}
                <Collapsible
                  open={filtrosAbiertos}
                  onOpenChange={setFiltrosAbiertos}
                  className="md:hidden"
                >
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 justify-between gap-2 text-xs"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <ListFilter className="size-3.5 text-muted-foreground" />
                          Filtros y orden
                          {hayFiltros && (
                            <span className="size-1.5 rounded-full bg-primary" />
                          )}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform",
                            filtrosAbiertos && "rotate-180",
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    {hayFiltros && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0"
                        title="Limpiar filtros"
                        onClick={limpiarFiltros}
                      >
                        <FilterX className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {selectoresFiltro}
                    </div>
                    <p className="text-center text-[11px] text-muted-foreground">
                      {filas.length} de {centros.length} centros visibles
                    </p>
                  </CollapsibleContent>
                </Collapsible>

                {/* Móvil: búsqueda debajo de los filtros */}
                <div className="md:hidden">
                  <BuscadorNombreCampamento
                    valor={busquedaNombre}
                    onChange={setBusquedaNombre}
                    inputRef={inputBusquedaRef}
                  />
                </div>

                {/* Escritorio: panel de filtros completo */}
                <div className="hidden rounded-xl border border-border/70 bg-background/80 p-3 md:block">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60">
                        <ListFilter className="size-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Filtros de vista</p>
                        <p className="text-[11px] text-muted-foreground">
                          {filas.length} de {centros.length} centros visibles
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {diaActivo !== hoyClave && (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setDia(hoyClave)}
                        >
                          Ver hoy
                        </Button>
                      )}
                      {hayFiltros && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 gap-1 px-2 text-[11px]"
                          onClick={limpiarFiltros}
                        >
                          <FilterX className="size-3" />
                          Limpiar
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_180px]">
                    {selectoresFiltro}
                    <SelectorFechaReporte
                      dia={diaActivo}
                      onSeleccionarDia={setDia}
                      marcasPorDia={marcasPorDia}
                      leyenda={leyendaCalendario}
                      hoyClave={hoyClave}
                    />
                  </div>
                </div>

                {/* Escritorio: atajo «Hoy» + buscador */}
                <div className="hidden flex-wrap items-center gap-2 md:flex">
                  <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Hoy · {formatearDiaCalendario(hoyClave)}
                  </span>
                  {(Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => {
                    const activo = estadoFiltro === e && diaActivo === hoyClave;
                    const color = META_ESTADO_REPORTE[e].color;
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setDia(hoyClave);
                          setEstadoFiltro(estadoFiltro === e ? "todos" : e);
                        }}
                        className={claseChipFiltro(activo)}
                        style={estiloChipFiltro(activo, color)}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ background: color }}
                        />
                        <span className={activo ? "text-foreground" : "text-muted-foreground"}>
                          {META_ESTADO_REPORTE[e].label}
                        </span>
                        <span className="font-bold tabular-nums text-foreground">
                          {conteosHoy[e]}
                        </span>
                      </button>
                    );
                  })}
                  <span className="mx-0.5 hidden h-5 w-px bg-border sm:inline-block" aria-hidden />
                  {ORDEN_MARCADOR_OCUPACION.map((m) => {
                    const activo = ocupacionFiltro === m && diaActivo === hoyClave;
                    const color = META_MARCADOR_OCUPACION[m].color;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setDia(hoyClave);
                          setOcupacionFiltro(ocupacionFiltro === m ? "todos" : m);
                        }}
                        className={claseChipFiltro(activo)}
                        style={estiloChipFiltro(activo, color)}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ background: color }}
                        />
                        <span className={activo ? "text-foreground" : "text-muted-foreground"}>
                          {META_MARCADOR_OCUPACION[m].label}
                        </span>
                        <span className="font-bold tabular-nums text-foreground">
                          {conteosOcupacionHoy[m]}
                        </span>
                      </button>
                    );
                  })}
                  <BuscadorNombreCampamento
                    valor={busquedaNombre}
                    onChange={setBusquedaNombre}
                    inputRef={inputBusquedaRef}
                    className="ml-auto w-52"
                  />
                </div>

                {/* Móvil: atajo «Ver hoy» si se consulta otro día */}
                {diaActivo !== hoyClave && (
                  <div className="flex items-center justify-between gap-2 md:hidden">
                    <p className="text-[11px] text-muted-foreground">
                      Consultando {formatearDiaCalendario(diaActivo)}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => setDia(hoyClave)}
                    >
                      Ver hoy
                    </Button>
                  </div>
                )}
            </div>
          </div>

          <div className="px-3 pt-3 pb-4 sm:px-4 sm:pt-4 lg:px-6">
            <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Centros del día
                  <span className="ml-1.5 font-normal text-muted-foreground sm:hidden">
                    · {filas.length}
                  </span>
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Ordenados por prioridad del reporte seleccionado
                </p>
              </div>
              <Badge variant="outline" className="hidden gap-1 tabular-nums sm:inline-flex">
                <CircleDashed className="size-3 text-muted-foreground" />
                {filas.length} visible(s)
              </Badge>
            </div>

            {filas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                {busquedaNombre.trim()
                  ? `Ningún campamento coincide con «${busquedaNombre.trim()}».`
                  : "Ningún campamento coincide con los filtros seleccionados."}
              </p>
            ) : (
              <ul className="space-y-1.5 sm:space-y-2">
                {filas.map(
                  ({
                    centro,
                    estado,
                    marcadorOcupacion,
                    parte,
                    controlRevisado,
                    trabajosRevisados,
                    requerimientosRevisados,
                    eventosRevisados: eventosOk,
                    incidenciasSalud,
                    eventos,
                    damnificados,
                    trabajosActivos,
                    requerimientosActivos,
                  }) => {
                    const meta = metaCuerpoDe(centro.cuerpo);
                    const datosCompletitud: DatosCompletitudReporte = {
                      estado,
                      parte,
                      controlRevisado,
                      trabajosRevisados,
                      requerimientosRevisados,
                      eventosRevisados: eventosOk,
                    };
                    const pendientes = bloquesPendientesReporte(datosCompletitud);
                    const destacarFaltante = estado !== "completo";
                    const faseLink = fasePendienteReporte(datosCompletitud);
                    const tooltipFaltantes = tituloFaltantesReporte(pendientes);
                    const urlReporte = `/centros/reportes/${centro.id}?vista=reporte${
                      faseLink ? `&fase=${faseLink}` : ""
                    }`;
                    return (
                  <li key={centro.id}>
                    <Link
                      to={urlReporte}
                      className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/65 px-2.5 py-2 transition-all active:bg-muted/30 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3 sm:hover:-translate-y-0.5 sm:hover:border-border sm:hover:bg-muted/25 sm:hover:shadow-sm"
                    >
                      <div
                        className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white text-base sm:size-10 sm:rounded-xl"
                        title={`N.° ${centro.nro ?? "—"} · ${meta.label}`}
                        style={{ borderColor: `${meta.color}66` }}
                      >
                        {meta.logo ? (
                          <LogoCuerpo src={meta.logo} priority="low" />
                        ) : (
                          <span className="leading-none">{meta.icono}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {centro.nombre}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                          N.° {centro.nro ?? "—"} · {centro.grupo}
                          {centro.parroquia ? ` · ${centro.parroquia}` : ""}
                        </p>
                        <div className="mt-1 sm:hidden">
                          <BadgeMarcadorOcupacion marcador={marcadorOcupacion} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 sm:hidden">
                          <IndicadorBloqueReporte
                            titulo="Parte numérico (damnificados)"
                            icono={<Users className="size-2.5 text-sky-400" />}
                            valor={damnificados.toLocaleString("es")}
                            listo={parte}
                            destacarFaltante={destacarFaltante}
                            compacto
                            className={parte ? "border-sky-400/25 bg-sky-400/10 text-sky-100" : ""}
                          />
                          <IndicadorBloqueReporte
                            titulo="Control"
                            icono={<ShieldCheck className="size-2.5 text-sky-400" />}
                            valor={controlRevisado ? 1 : 0}
                            listo={controlRevisado}
                            destacarFaltante={destacarFaltante}
                            compacto
                          />
                          <IndicadorBloqueReporte
                            titulo="Trabajos activos"
                            icono={<Wrench className="size-2.5 text-amber-400" />}
                            valor={trabajosActivos}
                            listo={trabajosRevisados}
                            destacarFaltante={destacarFaltante}
                            compacto
                          />
                          <IndicadorBloqueReporte
                            titulo="Requerimientos abiertos"
                            icono={<Package className="size-2.5 text-violet-400" />}
                            valor={requerimientosActivos}
                            listo={requerimientosRevisados}
                            destacarFaltante={destacarFaltante}
                            compacto
                          />
                          <IndicadorBloqueReporte
                            titulo="Novedades"
                            icono={<CalendarPlus className="size-2.5 text-emerald-400" />}
                            valor={eventos}
                            listo={eventosOk}
                            destacarFaltante={destacarFaltante}
                            compacto
                            className={
                              eventosOk ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : ""
                            }
                          />
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 text-[10px]"
                            title={tooltipFaltantes}
                            style={{
                              borderColor: `${META_ESTADO_REPORTE[estado].color}66`,
                              color: META_ESTADO_REPORTE[estado].color,
                            }}
                          >
                            {META_ESTADO_REPORTE[estado].label}
                          </Badge>
                        </div>
                      </div>
                      <div className="hidden min-w-0 shrink-0 items-center gap-2 sm:flex sm:justify-end">
                        <BadgeMarcadorOcupacion marcador={marcadorOcupacion} />
                        <IndicadorBloqueReporte
                          titulo="Parte numérico (damnificados)"
                          icono={<Users className="size-3 text-sky-400" />}
                          valor={damnificados}
                          listo={parte}
                          destacarFaltante={destacarFaltante}
                          className={parte ? "border-sky-400/25 bg-sky-400/10 text-sky-100" : ""}
                        />
                        <IndicadorBloqueReporte
                          titulo="Control"
                          icono={<ShieldCheck className="size-3 text-sky-400" />}
                          valor={controlRevisado ? 1 : 0}
                          listo={controlRevisado}
                          destacarFaltante={destacarFaltante}
                        />
                        <IndicadorBloqueReporte
                          titulo="Incid. salud"
                          icono={<Stethoscope className="size-3 text-rose-400" />}
                          valor={incidenciasSalud}
                          listo={parte}
                          className={parte ? "border-rose-400/25 bg-rose-400/10 text-rose-100" : ""}
                        />
                        <IndicadorBloqueReporte
                          titulo="Trabajos activos"
                          icono={<Wrench className="size-3 text-amber-400" />}
                          valor={trabajosActivos}
                          listo={trabajosRevisados}
                          destacarFaltante={destacarFaltante}
                        />
                        <IndicadorBloqueReporte
                          titulo="Requerimientos abiertos"
                          icono={<Package className="size-3 text-violet-400" />}
                          valor={requerimientosActivos}
                          listo={requerimientosRevisados}
                          destacarFaltante={destacarFaltante}
                        />
                        <IndicadorBloqueReporte
                          titulo="Novedades"
                          icono={<CalendarPlus className="size-3 text-emerald-400" />}
                          valor={eventos}
                          listo={eventosOk}
                          destacarFaltante={destacarFaltante}
                          className={eventosOk ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : ""}
                        />
                        <Badge
                          variant="outline"
                          className="h-7"
                          title={tooltipFaltantes}
                          style={{
                            borderColor: `${META_ESTADO_REPORTE[estado].color}66`,
                            color: META_ESTADO_REPORTE[estado].color,
                          }}
                        >
                          {META_ESTADO_REPORTE[estado].label}
                        </Badge>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                    );
                  },
                )}
              </ul>
            )}
          </div>
      <Dialog
        open={parteCompartir !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setParteCompartir(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Parte de la red · {formatearDiaSelector(diaActivo)}</DialogTitle>
            <DialogDescription>
              Revisa el texto y cópialo para pegarlo en Telegram u otra red.
            </DialogDescription>
          </DialogHeader>
          <textarea
            ref={areaParteRef}
            readOnly
            value={parteCompartir ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="h-72 w-full resize-none rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/50"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setParteCompartir(null)}>
              Cerrar
            </Button>
            <Button
              type="button"
              className="gap-1.5 bg-teal-600 hover:bg-teal-500"
              onClick={() => void copiarDesdeDialogo()}
            >
              {copiadoDialogo ? (
                <>
                  <Check className="size-4" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copiar todo
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MarcoVista>
  );
}
