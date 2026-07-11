// Sección "Reporte del día" del campamento: visor de fecha, gráfico y detalle
// del día seleccionado. Modo `expandido` para la ficha; `compacto` para el panel.

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  HardHat,
  Package,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesControlDia } from "@/data/useReportesControlDia";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  casosAbiertosSeguimiento,
  META_ESTATUS_CASO_SALUD,
  type CasoSaludCentro,
} from "@/domain/casosSalud";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import {
  centroRequiereReparaciones,
} from "@/domain/reparaciones";
import { BotonCopiarReporteTelegram } from "./BotonCopiarReporteTelegram";
import { MetaActualizacionBloque, metaMasReciente } from "./MetaActualizacionBloque";
import {
  META_ESTADO_REPORTE,
  estadosReportePorDia,
  eventosRevisados,
  reporteCompleto,
  reporteDelDia,
  ultimosDiasReporte,
  type EstadoReporteDia,
  type ReporteDiario,
} from "@/domain/reporteDiario";
import { controlReportado, reporteControlDelDia, type ReporteControlDia } from "@/domain/controlReporte";
import { META_ESTATUS_TRABAJO, type TrabajoCentro } from "@/domain/reparaciones";
import {
  eventosDelDia,
  type EventoReporte,
} from "@/domain/eventosReportes";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReporteDiarioForm } from "./ReporteDiarioForm";
import { GraficoReporteCentro } from "./GraficoReporteCentro";
import { formatearDiaCalendario } from "./CalendarioSelectorDia";
import { VisorFechaReporte } from "./VisorFechaReporte";
import {
  ParteNumericoResumen,
  ultimoSnapshotAntes,
} from "./ParteNumericoResumen";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  variant?: "compacto" | "expandido";
  /** Admin/analista SAE: pueden corregir reportes de fechas anteriores. */
  puedeEditarPasado?: boolean;
  /** Si se define, abre el formulario integrado en la ficha (sin modal).
   *  Recibe opcionalmente la fase (pestaña) con la que debe abrir. */
  onAbrirReporte?: (fase?: string) => void;
  /** Día controlado desde la cabecera de la ficha (pestaña Reporte). */
  diaSeleccionado?: string;
  onDiaChange?: (dia: string) => void;
  /** Oculta título + visor de fecha (ya están en el header global). */
  ocultarCabecera?: boolean;
}

function ChipReporte({ etiqueta, listo }: { etiqueta: string; listo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        listo
          ? "border-emerald-500/40 text-emerald-400"
          : "border-border text-muted-foreground",
      )}
    >
      {listo ? <CircleCheck className="size-3" /> : <CircleDashed className="size-3" />}
      {etiqueta}
    </span>
  );
}

export function BadgeEstadoReporte({
  estado,
  destacado,
}: {
  estado: EstadoReporteDia;
  destacado?: boolean;
}) {
  const meta = META_ESTADO_REPORTE[estado];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px] font-medium",
        destacado && "px-2.5 py-1",
      )}
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      {estado === "completo" ? (
        <CircleCheck className="size-3" />
      ) : estado === "pendiente" ? (
        <CircleDashed className="size-3" />
      ) : (
        <CircleDashed className="size-3" />
      )}
      {meta.label}
    </Badge>
  );
}

/** Bloque temático de la tarjeta de reporte (una pestaña del formulario).
 *  Con `onClick` se vuelve botón y abre esa fase del formulario. */
function BloqueReporte({
  icono,
  titulo,
  listo,
  onClick,
  meta,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  listo?: boolean;
  onClick?: () => void;
  /** Fecha/hora/usuario de la última actualización del bloque. */
  meta?: { ts?: number | null; by?: string | null } | null;
  children: ReactNode;
}) {
  const contenido = (
    <>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-muted-foreground">{icono}</span>
        <span className="text-[11px] font-semibold text-foreground">{titulo}</span>
        {listo !== undefined &&
          (listo ? (
            <CircleCheck className="ml-auto size-3.5 shrink-0 text-emerald-400" />
          ) : (
            <CircleDashed className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          ))}
        {onClick && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
      </div>
      {children}
      {meta && <MetaActualizacionBloque ts={meta.ts} by={meta.by} />}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 active:bg-muted/40"
      >
        {contenido}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 w-full px-3 py-2.5">{contenido}</div>
  );
}

/** Tarjeta de un día en la lista expandida (formato Telegram). */
function TarjetaReporteDia({
  dia,
  reporte,
  controlDia,
  eventosDia,
  snapshot,
  snapshots,
  trabajosActivosDia,
  parteNumerico,
  estado,
  grande,
  esHoy,
  puedeEditar,
  onEditar,
  onAbrirFase,
  casosSaludAbiertos = [],
  omitirCabecera,
}: {
  dia: string;
  reporte: ReporteDiario | undefined;
  controlDia?: ReporteControlDia;
  eventosDia: EventoReporte[];
  snapshot?: SnapshotOcupacion;
  snapshots?: SnapshotOcupacion[];
  trabajosActivosDia?: TrabajoCentro[];
  parteNumerico: boolean;
  estado: EstadoReporteDia;
  grande?: boolean;
  esHoy?: boolean;
  puedeEditar?: boolean;
  onEditar?: () => void;
  /** Abre el formulario del reporte directo en una fase (clic en un bloque). */
  onAbrirFase?: (fase: string) => void;
  /** Casos de salud abiertos (activo / en proceso) del campamento. */
  casosSaludAbiertos?: CasoSaludCentro[];
  /** Oculta fecha/estado duplicados cuando la tarjeta padre ya los muestra. */
  omitirCabecera?: boolean;
}) {
  const eventosOk = eventosRevisados(reporte, eventosDia.length);
  const controlOk = controlReportado(controlDia);
  const trabajosOk = reporte?.trabajos_revisados ?? false;
  const reqOk = reporte?.requerimientos_revisados ?? false;
  const snapshotAnterior = snapshots ? ultimoSnapshotAntes(snapshots, dia) : undefined;
  const hayAlgo =
    parteNumerico || controlOk || trabajosOk || reqOk || eventosOk || eventosDia.length > 0;

  const metaParte = parteNumerico && snapshot
    ? {
        ts: snapshot.updated_at || snapshot.ts,
        by: snapshot.updated_by,
      }
    : null;
  const metaSalud = metaMasReciente(
    reporte?.salud_reportada || (snapshot?.incidencias_salud ?? 0) > 0 || casosSaludAbiertos.length > 0
      ? {
          ts: reporte?.salud_updated_at || reporte?.updated_at || snapshot?.updated_at || snapshot?.ts,
          by: reporte?.salud_updated_by || reporte?.updated_by || snapshot?.updated_by,
        }
      : null,
    ...casosSaludAbiertos.map((c) => ({ ts: c.updated_at, by: c.updated_by })),
  );
  const metaControl = controlOk
    ? { ts: controlDia?.updated_at, by: controlDia?.updated_by }
    : null;
  const metaTrabajos = trabajosOk
    ? {
        ts: reporte?.trabajos_updated_at || reporte?.updated_at,
        by: reporte?.trabajos_updated_by || reporte?.updated_by,
      }
    : null;
  const metaReq = reqOk
    ? {
        ts: reporte?.requerimientos_updated_at || reporte?.updated_at,
        by: reporte?.requerimientos_updated_by || reporte?.updated_by,
      }
    : null;
  const metaNovedades = metaMasReciente(
    eventosOk
      ? {
          ts: reporte?.eventos_updated_at || reporte?.updated_at,
          by: reporte?.eventos_updated_by || reporte?.updated_by,
        }
      : null,
    ...eventosDia.map((e) => ({ ts: e.updated_at, by: e.updated_by })),
  );

  return (
    <div
      className={cn(
        !omitirCabecera && "rounded-xl border border-border bg-card",
        !omitirCabecera && (grande ? "px-4 py-3 shadow-sm" : "rounded-lg px-3 py-2"),
        !omitirCabecera && estado === "completo" && "border-emerald-500/30 bg-emerald-500/5",
        !omitirCabecera && estado === "parcial" && "border-amber-500/25 bg-amber-500/5",
      )}
    >
      <div className="space-y-3">
        {!omitirCabecera && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("font-semibold text-foreground", grande ? "text-sm" : "text-xs")}>
                {formatearDiaCalendario(dia)}
                {esHoy && (
                  <span className="ml-1.5 text-[10px] font-normal text-emerald-400">· Hoy</span>
                )}
              </span>
              <BadgeEstadoReporte estado={estado} />
            </div>
            {esHoy && puedeEditar && onEditar && (
              <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={onEditar}>
                <ClipboardCheck className="size-3.5" />
                {reporte || parteNumerico ? "Editar" : "Reportar"}
              </Button>
            )}
          </div>
        )}

        {grande && hayAlgo ? (
          <div className="grid w-full grid-cols-1 gap-2">
            {parteNumerico && snapshot ? (
              <ParteNumericoResumen
                snapshot={snapshot}
                snapshotAnterior={snapshotAnterior}
                confirmado
                onAbrir={onAbrirFase ? () => onAbrirFase("parte") : undefined}
                meta={metaParte}
              />
            ) : onAbrirFase ? (
              <button
                type="button"
                onClick={() => onAbrirFase("parte")}
                className="w-full rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-4 text-center transition-colors hover:border-sky-500/50 hover:bg-sky-500/10 active:bg-sky-500/15"
              >
                <Users className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-1.5 text-xs font-medium text-foreground">Parte sin confirmar</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Toque para confirmar</p>
              </button>
            ) : (
              <div className="rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-4 text-center">
                <Users className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-1.5 text-xs font-medium text-foreground">Parte sin confirmar</p>
              </div>
            )}

            <BloqueReporte
              icono={<Stethoscope className="size-3.5 text-rose-400" />}
              titulo="Incidencias salud"
              listo={Boolean(reporte?.salud_reportada) || (snapshot?.incidencias_salud ?? 0) > 0 || casosSaludAbiertos.length > 0}
              onClick={onAbrirFase ? () => onAbrirFase("salud") : undefined}
              meta={
                Boolean(reporte?.salud_reportada) ||
                (snapshot?.incidencias_salud ?? 0) > 0 ||
                casosSaludAbiertos.length > 0
                  ? metaSalud
                  : null
              }
            >
              <p className="text-[11px] text-muted-foreground">
                <span className="font-bold tabular-nums text-foreground">
                  {Math.max(
                    snapshot?.incidencias_salud ?? 0,
                    casosSaludAbiertos.length,
                  ).toLocaleString("es")}
                </span>{" "}
                incidencias reportadas
              </p>
              {casosSaludAbiertos.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {casosSaludAbiertos.slice(0, 3).map((c) => (
                    <li key={c.id} className="flex items-center gap-1.5 text-[11px]">
                      <span className="min-w-0 truncate">{c.titulo}</span>
                      <BadgeAntiguedad reportadoDia={c.reportado_dia} className="ml-auto" />
                      <Badge
                        variant="outline"
                        className="text-[9px]"
                        style={{
                          borderColor: `${META_ESTATUS_CASO_SALUD[c.estatus].color}66`,
                          color: META_ESTATUS_CASO_SALUD[c.estatus].color,
                        }}
                      >
                        {META_ESTATUS_CASO_SALUD[c.estatus].label}
                      </Badge>
                    </li>
                  ))}
                  {casosSaludAbiertos.length > 3 && (
                    <li className="text-[10px] text-muted-foreground">
                      +{casosSaludAbiertos.length - 3} caso{casosSaludAbiertos.length - 3 === 1 ? "" : "s"} más
                    </li>
                  )}
                </ul>
              )}
            </BloqueReporte>

            <BloqueReporte icono={<ShieldCheck className="size-3.5 text-sky-400" />} titulo="Control" listo={controlOk} onClick={onAbrirFase ? () => onAbrirFase("control") : undefined} meta={metaControl}>
              {controlOk ? (
                <p className="text-[11px] text-muted-foreground">Control operativo revisado.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Sin revisión de control.</p>
              )}
            </BloqueReporte>

            <BloqueReporte icono={<Wrench className="size-3.5 text-amber-400" />} titulo="Trabajos" listo={trabajosOk} onClick={onAbrirFase ? () => onAbrirFase("trabajos") : undefined} meta={metaTrabajos}>
              {trabajosActivosDia && trabajosActivosDia.length > 0 ? (
                <ul className="space-y-1">
                  {trabajosActivosDia.slice(0, 3).map((t) => (
                    <li key={t.id} className="flex items-center gap-1.5 text-[11px]">
                      <HardHat className="size-3 shrink-0" />
                      <span className="min-w-0 truncate">{t.titulo}</span>
                      <BadgeAntiguedad reportadoDia={t.reportada_dia} className="ml-auto" />
                      <Badge variant="outline" className="text-[9px]" style={{ borderColor: `${META_ESTATUS_TRABAJO[t.estatus].color}66`, color: META_ESTATUS_TRABAJO[t.estatus].color }}>
                        {META_ESTATUS_TRABAJO[t.estatus].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {trabajosOk ? "Bloque revisado." : "Sin revisión de trabajos."}
                </p>
              )}
            </BloqueReporte>

            <BloqueReporte icono={<Package className="size-3.5 text-violet-400" />} titulo="Requerimientos" listo={reqOk} onClick={onAbrirFase ? () => onAbrirFase("requerimientos") : undefined} meta={metaReq}>
              <p className="text-[11px] text-muted-foreground">
                {reqOk ? "Bloque revisado." : "Sin revisión de requerimientos."}
              </p>
            </BloqueReporte>

            <BloqueReporte icono={<CalendarPlus className="size-3.5 text-emerald-400" />} titulo="Novedades" listo={eventosOk} onClick={onAbrirFase ? () => onAbrirFase("novedades") : undefined} meta={eventosOk || eventosDia.length > 0 ? metaNovedades : null}>
              {eventosDia.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {eventosDia.length} novedad{eventosDia.length === 1 ? "" : "es"}
                </p>
              ) : eventosOk ? (
                <p className="text-[11px] text-muted-foreground">Revisado sin novedades.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Sin revisión.</p>
              )}
            </BloqueReporte>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <ChipReporte etiqueta="Parte" listo={parteNumerico} />
            <ChipReporte etiqueta="Control" listo={controlOk} />
            <ChipReporte etiqueta="Trabajos" listo={trabajosOk} />
            <ChipReporte etiqueta="Req." listo={reqOk} />
            <ChipReporte etiqueta="Noved." listo={eventosOk} />
          </div>
        )}

        {estado === "pendiente" && !hayAlgo && (
          <p className="text-[11px] text-muted-foreground">Sin reporte registrado este día.</p>
        )}
      </div>
    </div>
  );
}

function ReporteExpandido({
  centro,
  puedeEditar,
  onAbrirReporte,
  diaSeleccionado,
  onDiaChange,
  ocultarCabecera = false,
  puedeEditarPasado,
}: Props) {
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => ultimosDiasReporte(30, hoyClave)[0], [hoyClave]);

  const reportes = useReportesCentros({ centroId: centro.id, desde });
  const controles = useReportesControlDia({ centroId: centro.id, desde });
  const { eventos } = useEventosReportes({ centroId: centro.id, desde });
  const { trabajos } = useReparacionesCentros({ centroId: centro.id, soloActivos: true });
  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });

  const diasConParte = useMemo(
    () => new Set(snapshots.map((s) => s.dia)),
    [snapshots],
  );
  const diasConControl = useMemo(
    () => new Set(controles.filter((c) => c.revisado).map((c) => c.dia)),
    [controles],
  );
  const diasConTrabajos = useMemo(
    () => new Set(reportes.filter((r) => r.trabajos_revisados).map((r) => r.dia)),
    [reportes],
  );
  const diasConRequerimientos = useMemo(
    () => new Set(reportes.filter((r) => r.requerimientos_revisados).map((r) => r.dia)),
    [reportes],
  );
  const eventosPorDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const evento of eventos) m.set(evento.dia, (m.get(evento.dia) ?? 0) + 1);
    return m;
  }, [eventos]);
  const estadosPorDia = useMemo(
    () =>
      estadosReportePorDia(reportes, diasConParte, {
        diasConControl,
        diasConTrabajos,
        diasConRequerimientos,
        eventosPorDia,
      }),
    [reportes, diasConParte, diasConControl, diasConTrabajos, diasConRequerimientos, eventosPorDia],
  );
  const marcasPorDia = useMemo(() => {
    const m = new Map<string, string>();
    for (const [dia, estado] of estadosPorDia) {
      if (estado !== "pendiente") m.set(dia, META_ESTADO_REPORTE[estado].color);
    }
    return m;
  }, [estadosPorDia]);
  const leyendaCalendario = useMemo(
    () =>
      (Object.keys(META_ESTADO_REPORTE) as EstadoReporteDia[]).map((e) => ({
        color: META_ESTADO_REPORTE[e].color,
        label: META_ESTADO_REPORTE[e].label,
      })),
    [],
  );

  const [diaInterno, setDiaInterno] = useState(hoyClave);
  const diaSel = diaSeleccionado ?? diaInterno;
  const setDiaSel = onDiaChange ?? setDiaInterno;
  const [reportando, setReportando] = useState(false);
  const [faseFormulario, setFaseFormulario] = useState<string | undefined>(undefined);
  const { casos: casosSalud } = useCasosSaludCentros({ centroId: centro.id, soloActivos: true });
  const casosSaludAbiertos = casosAbiertosSeguimiento(casosSalud);

  function abrirFormularioReporte(fase?: string) {
    if (onAbrirReporte) {
      onAbrirReporte(fase);
      return;
    }
    setFaseFormulario(fase);
    setReportando(true);
  }

  const esHoy = diaSel === hoyClave;
  const permiteEditarDia = puedeEditar && (esHoy || puedeEditarPasado === true);
  const estadoSel = estadosPorDia.get(diaSel) ?? "pendiente";
  const parteSel = diasConParte.has(diaSel);

  return (
    <div className="space-y-4">
      {!ocultarCabecera && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ClipboardCheck className="size-5 text-teal-400" />
              Reportes diarios
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Parte, control, trabajos, requerimientos y novedades (formato Telegram).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <VisorFechaReporte
              dia={diaSel}
              onDiaChange={setDiaSel}
              hoyClave={hoyClave}
              marcasPorDia={marcasPorDia}
              leyenda={leyendaCalendario}
            />
            <BadgeEstadoReporte estado={estadoSel} destacado />
            {centroRequiereReparaciones(trabajos) && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                <Wrench className="size-3" />
                {trabajos.length} trabajo{trabajos.length !== 1 ? "s" : ""} activo{trabajos.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {permiteEditarDia && (
              <Button type="button" size="sm" onClick={() => abrirFormularioReporte()}>
                <ClipboardCheck className="size-4" />
                {esHoy
                  ? estadoSel === "pendiente" && !parteSel
                    ? "Reportar hoy"
                    : "Editar reporte"
                  : "Editar este día"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* En móvil el gráfico consume media pantalla antes del reporte del día;
          la evolución se consulta desde escritorio. */}
      <div className="hidden md:block">
        <GraficoReporteCentro
          centroId={centro.id}
          snapshots={snapshots}
          diaMarcado={diaSel}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">
              {esHoy ? "Reporte de hoy" : "Reporte del día"} · {formatearDiaCalendario(diaSel)}
            </CardTitle>
            <BotonCopiarReporteTelegram centro={centro} dia={diaSel} />
          </div>
        </CardHeader>
        <CardContent>
          {!parteSel && estadoSel === "pendiente" ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {esHoy
                  ? "Aún no hay reporte registrado hoy."
                  : "Sin reporte registrado este día."}
              </p>
              {permiteEditarDia && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => abrirFormularioReporte()}
                >
                  {esHoy ? "Registrar reporte de hoy" : "Registrar reporte de este día"}
                </Button>
              )}
            </div>
          ) : (
            <TarjetaReporteDia
              dia={diaSel}
              reporte={reportes.find((r) => r.dia === diaSel)}
              controlDia={reporteControlDelDia(controles, centro.id, diaSel)}
              eventosDia={eventosDelDia(eventos, centro.id, diaSel)}
              snapshot={snapshots.find((s) => s.dia === diaSel)}
              snapshots={snapshots}
              trabajosActivosDia={esHoy ? trabajos : undefined}
              parteNumerico={parteSel}
              estado={estadoSel}
              grande
              omitirCabecera
              casosSaludAbiertos={casosSaludAbiertos}
              onAbrirFase={
                permiteEditarDia ? (fase) => abrirFormularioReporte(fase) : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {!onAbrirReporte && reportando && (
        <ReporteDiarioForm
          centro={centro}
          diaReporte={diaSel}
          faseInicial={faseFormulario}
          onCerrar={() => {
            setReportando(false);
            setFaseFormulario(undefined);
          }}
        />
      )}
    </div>
  );
}

function ReporteCompacto({ centro, puedeEditar, onAbrirReporte }: Props) {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const [reportando, setReportando] = useState(false);

  function abrirFormularioReporte() {
    if (onAbrirReporte) {
      onAbrirReporte();
      return;
    }
    setReportando(true);
  }

  const reportes = useReportesCentros({ centroId: centro.id, dia: hoy });
  const controles = useReportesControlDia({ centroId: centro.id, dia: hoy });
  const { eventos } = useEventosReportes({ centroId: centro.id, dia: hoy });
  const { trabajos } = useReparacionesCentros({ centroId: centro.id, soloActivos: true });
  const controlHoy = reporteControlDelDia(controles, centro.id, hoy);
  const reporte = reporteDelDia(reportes, centro.id, hoy);
  const eventosOk = eventosRevisados(reporte, eventos.length);

  const snapshotsHoy = useOcupacionesCentros({ centroId: centro.id, desde: hoy });
  const snapHoy = snapshotsHoy.find((s) => s.dia === hoy);
  const parteHoy = Boolean(snapHoy);

  const completo = reporteCompleto(reporte, {
    parteNumerico: parteHoy,
    saludReportada:
      reporte?.salud_reportada === true || (snapHoy?.incidencias_salud ?? 0) > 0,
    controlRevisado: controlReportado(controlHoy),
    trabajosRevisados: reporte?.trabajos_revisados ?? false,
    requerimientosRevisados: reporte?.requerimientos_revisados ?? false,
    eventosRevisados: eventosOk,
  });
  const nadaReportado =
    !parteHoy &&
    !controlReportado(controlHoy) &&
    !reporte?.trabajos_revisados &&
    !reporte?.requerimientos_revisados &&
    !eventosOk;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ClipboardCheck className="size-3.5" />
          Reporte del día
        </p>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            completo
              ? "border-emerald-500/40 text-emerald-400"
              : "border-amber-500/40 text-amber-500",
          )}
        >
          {completo ? "Completo" : "Pendiente"}
        </Badge>
        {centroRequiereReparaciones(trabajos) && (
          <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-500">
            <Wrench className="size-3" />
            {trabajos.length} trab.
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ChipReporte etiqueta="Parte" listo={parteHoy} />
        <ChipReporte etiqueta="Control" listo={controlReportado(controlHoy)} />
        <ChipReporte etiqueta="Trabajos" listo={reporte?.trabajos_revisados ?? false} />
        <ChipReporte etiqueta="Requerimientos" listo={reporte?.requerimientos_revisados ?? false} />
        <ChipReporte etiqueta="Novedades" listo={eventosOk} />
      </div>

      {nadaReportado ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Este campamento aún no reporta nada hoy.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <Stethoscope className="size-3.5 text-rose-400" />
              {(snapHoy?.incidencias_salud ?? 0).toLocaleString("es")}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Incidencias salud
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <CalendarPlus className="size-3.5 text-violet-400" />
              {eventos.length.toLocaleString("es")}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Novedades hoy
            </div>
          </div>
        </div>
      )}

      {eventos.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <CalendarPlus className="mr-1 inline size-3 text-emerald-400" />
          {eventos.length} novedad{eventos.length === 1 ? "" : "es"} registrada
          {eventos.length === 1 ? "" : "s"}
        </p>
      )}

      {puedeEditar && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={abrirFormularioReporte}
        >
          <ClipboardCheck className="size-4" />
          {reporte || parteHoy ? "Editar reporte del día" : "Reporte del día"}
        </Button>
      )}

      {!onAbrirReporte && reportando && (
        <ReporteDiarioForm centro={centro} onCerrar={() => setReportando(false)} />
      )}
    </div>
  );
}

/** Estado del reporte diario del campamento. */
export function SeccionReporteDiarioCentro(props: Props) {
  const { variant = "compacto", centro, puedeEditar, onAbrirReporte, ...expandidoExtra } = props;
  if (variant === "expandido") {
    return (
      <ReporteExpandido
        centro={centro}
        puedeEditar={puedeEditar}
        onAbrirReporte={onAbrirReporte}
        {...expandidoExtra}
      />
    );
  }
  return (
    <ReporteCompacto
      centro={centro}
      puedeEditar={puedeEditar}
      onAbrirReporte={onAbrirReporte}
    />
  );
}
