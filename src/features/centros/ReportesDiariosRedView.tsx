// Vista agregada de reportes diarios de toda la red de campamentos.

import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FilterX,
  ListFilter,
  Search,
  Stethoscope,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { claveDia } from "@/data/reposSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  META_ESTADO_REPORTE,
  estadoReporteDia,
  racionesDelDia,
  reporteDelDia,
  ultimosDiasReporte,
  type EstadoReporteDia,
  type ReporteDiario,
} from "@/domain/reporteDiario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type OrdenReportes =
  | "pendientes"
  | "completos"
  | "nro_asc"
  | "nro_desc"
  | "nombre_asc"
  | "nombre_desc"
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
  { valor: "raciones", label: "Más raciones" },
  { valor: "atenciones", label: "Más atenciones" },
];

const ORDEN_RESUMEN_ESTADOS: EstadoReporteDia[] = [
  "completo",
  "parcial",
  "solo_parte",
  "pendiente",
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
    raciones: number;
    atenciones: number;
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
    case "raciones":
      return copia.sort(
        (a, b) =>
          b.raciones - a.raciones ||
          ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
          (a.centro.nro ?? 0) - (b.centro.nro ?? 0),
      );
    case "atenciones":
      return copia.sort(
        (a, b) =>
          b.atenciones - a.atenciones ||
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

function TarjetaEstadoReporte({
  estado,
  cantidad,
  total,
  activo,
  onClick,
}: {
  estado: EstadoReporteDia;
  cantidad: number;
  total: number;
  activo: boolean;
  onClick: () => void;
}) {
  const meta = META_ESTADO_REPORTE[estado];
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

function SelectorFechaReporte({
  dia,
  onSeleccionarDia,
  marcasPorDia,
  leyenda,
}: {
  dia: string;
  onSeleccionarDia: (dia: string) => void;
  marcasPorDia: Map<string, string>;
  leyenda: { color: string; label: string }[];
}) {
  const [abierto, setAbierto] = useState(false);

  function seleccionarDia(nuevoDia: string | null) {
    if (!nuevoDia) return;
    onSeleccionarDia(nuevoDia);
    setAbierto(false);
  }

  return (
    <div className="flex h-8 min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card/70">
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
            className="h-full min-w-0 flex-1 rounded-none px-2 text-xs font-semibold tracking-wide tabular-nums"
          >
            {formatearDiaSelector(dia)}
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

/** Tablero global de reportes diarios por campamento. */
export function ReportesDiariosRedView() {
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
  const snapshots = useOcupacionesCentros({ desde });

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

  function estadoCentroDia(centroId: string, dia: string): EstadoReporteDia {
    const reporte = reportesPorCentroDia.get(`${centroId}:${dia}`);
    const tieneParte = diasConPartePorCentro.get(centroId)?.has(dia) ?? false;
    return estadoReporteDia(reporte, tieneParte);
  }

  const [dia, setDia] = useState<string | null>(hoyClave);
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>("todos");
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
        return {
          centro,
          estado,
          raciones: racionesDelDia(reporte),
          atenciones: reporte?.atenciones_medicas ?? 0,
        };
      })
      .filter((f) => estadoFiltro === "todos" || f.estado === estadoFiltro)
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
    grupoFiltro,
    orden,
    reportes,
    reportesPorCentroDia,
    diasConPartePorCentro,
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
  }, [centros, hoyClave, reportes, snapshots]);

  const conteosDiaActivo = useMemo(() => {
    const m: Record<EstadoReporteDia, number> = {
      completo: 0,
      parcial: 0,
      solo_parte: 0,
      pendiente: 0,
    };
    for (const c of centros) {
      m[estadoCentroDia(c.id, diaActivo)]++;
    }
    return m;
  }, [centros, diaActivo, reportes, snapshots]);

  const marcasPorDia = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of ultimosDiasReporte(30, hoyClave)) {
      const estados = centros.map((c) => estadoCentroDia(c.id, d));
      const color = colorRedPorDia(estados);
      if (color) m.set(d, color);
    }
    return m;
  }, [centros, hoyClave, reportes, snapshots]);

  const leyendaCalendario = useMemo(
    () =>
      (Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => ({
        color: META_ESTADO_REPORTE[e].color,
        label: META_ESTADO_REPORTE[e].label,
      })),
    [],
  );

  const racionesDia = useMemo(
    () => filas.reduce((acc, f) => acc + f.raciones, 0),
    [filas],
  );
  const atencionesDia = useMemo(
    () => filas.reduce((acc, f) => acc + f.atenciones, 0),
    [filas],
  );
  const reportadosDia = centros.length - conteosDiaActivo.pendiente;
  const porcentajeCierreDia = porcentajeEntero(reportadosDia, centros.length);

  const hayFiltros =
    estadoFiltro !== "todos" ||
    grupoFiltro !== "todos" ||
    dia !== hoyClave ||
    orden !== "pendientes" ||
    busquedaNombre.trim() !== "";

  function limpiarFiltros() {
    setEstadoFiltro("todos");
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
        titulo="Reportes por campamento"
        descripcion="Corte diario de la red · clic en una fila para abrir la ficha del centro"
        acciones={
          <>
            <Badge variant="outline" className="gap-1.5 border-teal-400/30 bg-teal-400/10 text-teal-200">
              <CalendarDays className="size-3" />
              <span className="tabular-nums">{formatearDiaSelector(diaActivo)}</span>
              {diaActivo === hoyClave ? " · Hoy" : ""}
            </Badge>
            <Badge variant="outline" className="gap-1 tabular-nums">
              <CheckCircle2 className="size-3 text-emerald-400" />
              {porcentajeCierreDia} reportado
            </Badge>
            <Badge variant="outline" className="hidden gap-1 tabular-nums sm:inline-flex">
              <UtensilsCrossed className="size-3 text-teal-400" />
              {racionesDia.toLocaleString("es")} raciones
            </Badge>
            <Badge variant="outline" className="hidden gap-1 tabular-nums sm:inline-flex">
              <Stethoscope className="size-3 text-rose-400" />
              {atencionesDia} atenciones
            </Badge>
          </>
        }
      />

          <div className="border-b border-border bg-muted/10 px-3 py-2.5 sm:px-4 sm:py-4 lg:px-6">
            <div className="space-y-2 sm:space-y-3">
                {/* Móvil: búsqueda + fecha arriba del todo */}
                <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-[minmax(0,1fr)_168px] md:hidden">
                  <BuscadorNombreCampamento
                    valor={busquedaNombre}
                    onChange={setBusquedaNombre}
                    inputRef={inputBusquedaRef}
                  />
                  <SelectorFechaReporte
                    dia={diaActivo}
                    onSeleccionarDia={setDia}
                    marcasPorDia={marcasPorDia}
                    leyenda={leyendaCalendario}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 xl:grid-cols-4">
                  {ORDEN_RESUMEN_ESTADOS.map((e) => (
                    <TarjetaEstadoReporte
                      key={e}
                      estado={e}
                      cantidad={conteosDiaActivo[e]}
                      total={centros.length}
                      activo={estadoFiltro === e}
                      onClick={() => setEstadoFiltro(estadoFiltro === e ? "todos" : e)}
                    />
                  ))}
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

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_180px]">
                    {selectoresFiltro}
                    <SelectorFechaReporte
                      dia={diaActivo}
                      onSeleccionarDia={setDia}
                      marcasPorDia={marcasPorDia}
                      leyenda={leyendaCalendario}
                    />
                  </div>
                </div>

                {/* Escritorio: atajo «Hoy» + buscador */}
                <div className="hidden flex-wrap items-center gap-1.5 md:flex">
                  <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Hoy · {formatearDiaCalendario(hoyClave)}
                  </span>
                  {(Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setDia(hoyClave);
                        setEstadoFiltro(estadoFiltro === e ? "todos" : e);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                        estadoFiltro === e && diaActivo === hoyClave
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-background/80 hover:bg-muted/40",
                      )}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: META_ESTADO_REPORTE[e].color }}
                      />
                      <span className="text-muted-foreground">{META_ESTADO_REPORTE[e].label}</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {conteosHoy[e]}
                      </span>
                    </button>
                  ))}
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
                {filas.map(({ centro, estado, raciones, atenciones }) => (
                  <li key={centro.id}>
                    <Link
                      to={`/centro/${centro.id}`}
                      className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/65 px-2.5 py-2 transition-all active:bg-muted/30 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3 sm:hover:-translate-y-0.5 sm:hover:border-border sm:hover:bg-muted/25 sm:hover:shadow-sm"
                    >
                      <div
                        className="flex size-8 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/30 sm:size-10 sm:rounded-xl"
                        style={{ borderColor: `${META_ESTADO_REPORTE[estado].color}55` }}
                      >
                        <span className="text-[8px] font-medium leading-none text-muted-foreground sm:text-[9px]">
                          N.°
                        </span>
                        <span className="text-xs font-semibold leading-none tabular-nums text-foreground sm:text-sm">
                          {centro.nro}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {centro.nombre}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                          {centro.grupo}
                          {centro.parroquia ? ` · ${centro.parroquia}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 sm:hidden">
                          {(raciones > 0 || atenciones > 0) && (
                            <>
                              {raciones > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-teal-300">
                                  <UtensilsCrossed className="size-2.5" />
                                  {raciones.toLocaleString("es")}
                                </span>
                              )}
                              {atenciones > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-rose-300">
                                  <Stethoscope className="size-2.5" />
                                  {atenciones}
                                </span>
                              )}
                            </>
                          )}
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 text-[10px]"
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
                        <span
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs tabular-nums",
                            raciones > 0
                              ? "border-teal-400/25 bg-teal-400/10 text-teal-100"
                              : "border-border/60 bg-muted/20 text-muted-foreground",
                          )}
                        >
                          <UtensilsCrossed className="size-3 text-teal-400" />
                          <span className="font-semibold">
                            {raciones.toLocaleString("es")}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs tabular-nums",
                            atenciones > 0
                              ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                              : "border-border/60 bg-muted/20 text-muted-foreground",
                          )}
                        >
                          <Stethoscope className="size-3 text-rose-400" />
                          <span className="font-semibold">{atenciones}</span>
                        </span>
                        <Badge
                          variant="outline"
                          className="h-7"
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
                ))}
              </ul>
            )}
          </div>
    </MarcoVista>
  );
}
