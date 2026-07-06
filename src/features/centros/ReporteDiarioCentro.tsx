// Sección "Reporte del día" del campamento: estado de hoy, calendario
// interactivo e historial. Modo `expandido` para la ficha; `compacto` para el panel.

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  Clock,
  HardHat,
  PanelLeftClose,
  PanelLeftOpen,
  Stethoscope,
  Users,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesReparacionesDia } from "@/data/useReportesReparacionesDia";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  centroRequiereReparaciones,
  META_ESTATUS,
  reparacionesPendientes,
  reporteReparacionesDelDia,
  type Reparacion,
  type ReporteReparacionesDia,
} from "@/domain/reparaciones";
import {
  CATALOGO_JORNADAS_REPORTE,
  META_ESTADO_REPORTE,
  contadoresReportesPorPeriodo,
  contarAtenciones,
  estadosReportePorDia,
  eventosRevisados,
  jornadasReportadas,
  normalizarComidas,
  parsearDiaReporte,
  racionesDelDia,
  reporteCompleto,
  reporteDelDia,
  saludReportada,
  textoResumenTiposAtencion,
  ultimosDiasReporte,
  type EstadoReporteDia,
  type JornadaReporte,
  type ReporteDiario,
} from "@/domain/reporteDiario";
import {
  META_TIPO_EVENTO_REPORTE,
  eventosDelDia,
  textoParticipantesEvento,
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
import {
  CalendarioSelectorDia,
  formatearDiaCalendario,
} from "./CalendarioSelectorDia";
import {
  ParteNumericoResumen,
  ultimoSnapshotAntes,
} from "./ParteNumericoResumen";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  variant?: "compacto" | "expandido";
  /** Si se define, abre el formulario integrado en la ficha (sin modal). */
  onAbrirReporte?: () => void;
}

type FiltroLista = "hoy" | "semana" | "mes" | "dia" | "historial";

function inicioMesClave(ref: string): string {
  const { anio, mes } = parsearDiaReporte(ref);
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
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

function BadgeEstadoReporte({ estado }: { estado: EstadoReporteDia }) {
  const meta = META_ESTADO_REPORTE[estado];
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      {meta.label}
    </Badge>
  );
}

function horaCorta(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Resumen breve de atenciones médicas (conteo + desglose por tipo). */
function ResumenAtencionesMedicas({ reporte }: { reporte: ReporteDiario | undefined }) {
  const casos = reporte?.atenciones_medicas_detalle ?? [];
  const total = contarAtenciones(casos, reporte?.atenciones_medicas);
  const resumenTipos = textoResumenTiposAtencion(casos);
  const obs = reporte?.observaciones?.trim();
  const legacySinDetalle = casos.length === 0 && total > 0;

  if (total === 0 && !obs) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {saludReportada(reporte)
          ? "Se confirmó que no hubo atenciones médicas."
          : "Sin registro de atenciones."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {total > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold tabular-nums text-foreground">{total}</span>{" "}
          {total === 1 ? "atención" : "atenciones"}
          {resumenTipos ? (
            <span className="text-muted-foreground"> · {resumenTipos}</span>
          ) : null}
        </p>
      )}
      {legacySinDetalle && obs && (
        <p className="whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground">
          {obs}
        </p>
      )}
      {casos.length > 0 && obs && (
        <p className="whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground/80">
          Notas: {obs}
        </p>
      )}
    </div>
  );
}

/** Bloque temático de la tarjeta de reporte (una pestaña del formulario). */
function BloqueReporte({
  icono,
  titulo,
  listo,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  listo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 w-full px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-muted-foreground">{icono}</span>
        <span className="text-[11px] font-semibold text-foreground">{titulo}</span>
        {listo !== undefined &&
          (listo ? (
            <CircleCheck className="ml-auto size-3.5 shrink-0 text-emerald-400" />
          ) : (
            <CircleDashed className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          ))}
      </div>
      {children}
    </div>
  );
}

/** Tarjeta de un día en la lista expandida. */
function TarjetaReporteDia({
  dia,
  reporte,
  reporteRep,
  eventosDia,
  snapshot,
  snapshots,
  reparaciones,
  parteNumerico,
  estado,
  grande,
  esHoy,
  puedeEditar,
  onEditar,
}: {
  dia: string;
  reporte: ReporteDiario | undefined;
  reporteRep?: ReporteReparacionesDia;
  eventosDia: EventoReporte[];
  snapshot?: SnapshotOcupacion;
  snapshots?: SnapshotOcupacion[];
  reparaciones?: Reparacion[];
  parteNumerico: boolean;
  estado: EstadoReporteDia;
  grande?: boolean;
  esHoy?: boolean;
  puedeEditar?: boolean;
  onEditar?: () => void;
}) {
  const jornadas = jornadasReportadas(reporte);
  const comidas = normalizarComidas(reporte?.comidas);
  const raciones = racionesDelDia(reporte);
  const casosAtencion = reporte?.atenciones_medicas_detalle ?? [];
  const atenciones = contarAtenciones(casosAtencion, reporte?.atenciones_medicas);
  const obsSalud = reporte?.observaciones?.trim();
  const saludLista = saludReportada(reporte);
  const eventosOk = eventosRevisados(reporte, eventosDia.length);
  const pendientesRep = reparaciones ? reparacionesPendientes(reparaciones) : [];
  const snapshotAnterior = snapshots ? ultimoSnapshotAntes(snapshots, dia) : undefined;
  const hayAlgo =
    parteNumerico ||
    jornadas.length > 0 ||
    saludLista ||
    Boolean(reporteRep) ||
    eventosOk ||
    (esHoy && pendientesRep.length > 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card",
        grande ? "px-4 py-3 shadow-sm" : "rounded-lg px-3 py-2",
        estado === "completo" && "border-emerald-500/30 bg-emerald-500/5",
        estado === "parcial" && "border-amber-500/25 bg-amber-500/5",
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold text-foreground", grande ? "text-sm" : "text-xs")}>
              {formatearDiaCalendario(dia)}
              {esHoy && (
                <span className="ml-1.5 text-[10px] font-normal text-primary">· Hoy</span>
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

          {grande && hayAlgo ? (
            <div className="grid w-full grid-cols-1 gap-2">
              {parteNumerico && snapshot ? (
                <ParteNumericoResumen
                  snapshot={snapshot}
                  snapshotAnterior={snapshotAnterior}
                  confirmado
                />
              ) : (
                <div className="rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-4 text-center">
                  <Users className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-1.5 text-xs font-medium text-foreground">
                    Parte numérico sin confirmar
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Confirma población y personal en el reporte del día.
                  </p>
                </div>
              )}

              {/* Comidas */}
              <BloqueReporte
                icono={<UtensilsCrossed className="size-3.5 text-teal-400" />}
                titulo="Comidas"
                listo={jornadas.length === CATALOGO_JORNADAS_REPORTE.length}
              >
                {jornadas.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-bold tabular-nums text-foreground">
                        {raciones.toLocaleString("es")}
                      </span>{" "}
                      raciones en total
                    </p>
                    <ul className="space-y-1">
                      {CATALOGO_JORNADAS_REPORTE.map((j) => {
                        const c = comidas[j.valor];
                        const reportada = jornadas.includes(j.valor);
                        if (!reportada) return null;
                        const hora = horaCorta(c.hora_llegada);
                        const detalle = [
                          `${c.raciones.toLocaleString("es")} raciones`,
                          hora && `llegó ${hora}`,
                          c.proveedor.trim() && c.proveedor.trim(),
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <li
                            key={j.valor}
                            className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground"
                          >
                            <span className="shrink-0">{j.icono}</span>
                            <span>
                              <span className="font-medium text-foreground">{j.label}</span>
                              {detalle ? ` — ${detalle}` : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {jornadas.length < CATALOGO_JORNADAS_REPORTE.length && (
                      <p className="text-[10px] text-amber-500/90">
                        Falta:{" "}
                        {CATALOGO_JORNADAS_REPORTE.filter(
                          (j) => !jornadas.includes(j.valor),
                        )
                          .map((j) => j.label)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Sin comidas reportadas.</p>
                )}
              </BloqueReporte>

              {/* Atención médica */}
              <BloqueReporte
                icono={<Stethoscope className="size-3.5 text-rose-400" />}
                titulo="Atención médica"
                listo={saludLista}
              >
                <ResumenAtencionesMedicas reporte={reporte} />
              </BloqueReporte>

              {/* Reparaciones */}
              <BloqueReporte
                icono={<Wrench className="size-3.5 text-amber-400" />}
                titulo="Reparaciones"
                listo={
                  reporteRep
                    ? !reporteRep.requiere_trabajos || pendientesRep.length === 0
                    : undefined
                }
              >
                {reporteRep ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                      <span className="text-muted-foreground">
                        Requiere trabajos:{" "}
                        <span className="font-medium text-foreground">
                          {reporteRep.requiere_trabajos ? "Sí" : "No"}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Se trabajó hoy:{" "}
                        <span className="font-medium text-foreground">
                          {reporteRep.se_trabajo_hoy ? "Sí" : "No"}
                        </span>
                      </span>
                    </div>
                    {reporteRep.observaciones && (
                      <p className="whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground">
                        {reporteRep.observaciones}
                      </p>
                    )}
                    {esHoy && pendientesRep.length > 0 && (
                      <ul className="mt-1 space-y-1 border-t border-border/50 pt-1.5">
                        <li className="text-[10px] font-medium text-muted-foreground">
                          {pendientesRep.length}{" "}
                          {pendientesRep.length === 1 ? "trabajo pendiente" : "trabajos pendientes"}
                        </li>
                        {pendientesRep.slice(0, 3).map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center gap-1.5 text-[11px] leading-snug"
                          >
                            <HardHat className="size-3 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate text-foreground">{r.titulo}</span>
                            <Badge
                              variant="outline"
                              className="ml-auto shrink-0 px-1.5 py-0 text-[9px]"
                              style={{
                                borderColor: `${META_ESTATUS[r.estatus].color}66`,
                                color: META_ESTATUS[r.estatus].color,
                              }}
                            >
                              {META_ESTATUS[r.estatus].label}
                            </Badge>
                          </li>
                        ))}
                        {pendientesRep.length > 3 && (
                          <li className="text-[10px] text-muted-foreground">
                            +{pendientesRep.length - 3} más…
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                ) : esHoy && pendientesRep.length > 0 ? (
                  <p className="text-[11px] text-amber-500/90">
                    {pendientesRep.length}{" "}
                    {pendientesRep.length === 1 ? "reparación abierta" : "reparaciones abiertas"}{" "}
                    sin reporte del día.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Sin registro de reparaciones.</p>
                )}
              </BloqueReporte>

              {/* Eventos */}
              <BloqueReporte
                icono={<CalendarPlus className="size-3.5 text-emerald-400" />}
                titulo="Eventos"
                listo={eventosOk}
              >
                {eventosDia.length > 0 ? (
                  <div className="space-y-1.5">
                    {eventosDia.map((evento) => {
                      const meta = META_TIPO_EVENTO_REPORTE[evento.tipo];
                      const hora = horaCorta(evento.ts);
                      return (
                        <div key={evento.id} className="rounded-lg border border-border/60 px-2 py-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[9px]"
                              style={{ borderColor: `${meta.color}66`, color: meta.color }}
                            >
                              {meta.label}
                            </Badge>
                            <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                              {evento.titulo}
                            </span>
                            {hora && (
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {hora}
                              </span>
                            )}
                          </div>
                          {evento.descripcion && (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                              {evento.descripcion}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {textoParticipantesEvento(evento)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : eventosOk ? (
                  <p className="text-[11px] text-muted-foreground">
                    Bloque revisado: sin eventos registrados.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Sin revisión de eventos.</p>
                )}
              </BloqueReporte>
            </div>
          ) : (
            /* Vista compacta (historial / tarjeta pequeña) */
            <>
              <div className="flex flex-wrap gap-1.5">
                <ChipReporte etiqueta="Parte numérico" listo={parteNumerico} />
                {CATALOGO_JORNADAS_REPORTE.map((j) => (
                  <ChipReporte
                    key={j.valor}
                    etiqueta={j.label}
                    listo={jornadas.includes(j.valor as JornadaReporte)}
                  />
                ))}
                <ChipReporte etiqueta="Salud" listo={saludLista} />
                <ChipReporte etiqueta="Reparaciones" listo={Boolean(reporteRep)} />
                <ChipReporte etiqueta="Eventos" listo={eventosOk} />
              </div>
              {(raciones > 0 || atenciones > 0) && (
                <div className="flex flex-wrap gap-4 text-xs">
                  {raciones > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <UtensilsCrossed className="size-3.5 text-teal-400" />
                      <span className="font-bold tabular-nums text-foreground">
                        {raciones.toLocaleString("es")}
                      </span>{" "}
                      raciones
                    </span>
                  )}
                  {atenciones > 0 && (
                    <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                      <Stethoscope className="size-3.5 shrink-0 text-rose-400" />
                      <span className="font-bold tabular-nums text-foreground">{atenciones}</span>{" "}
                      atenciones
                      {casosAtencion.length > 0 && textoResumenTiposAtencion(casosAtencion) ? (
                        <span className="truncate"> · {textoResumenTiposAtencion(casosAtencion)}</span>
                      ) : null}
                    </span>
                  )}
                </div>
              )}
              {parteNumerico && snapshot && (
                <p className="text-[11px] text-muted-foreground">
                  {snapshot.total_afectados.toLocaleString("es")} refug. ·{" "}
                  {snapshot.familias.toLocaleString("es")} fam. ·{" "}
                  {snapshot.personal_total.toLocaleString("es")} personal
                </p>
              )}
              {casosAtencion.length === 0 && obsSalud && (
                <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {obsSalud}
                </p>
              )}
              {reporteRep && (
                <p className="text-[11px] text-muted-foreground">
                  <Wrench className="mr-1 inline size-3 text-amber-400" />
                  Reparaciones: requiere {reporteRep.requiere_trabajos ? "sí" : "no"}, trabajó hoy{" "}
                  {reporteRep.se_trabajo_hoy ? "sí" : "no"}
                </p>
              )}
            </>
          )}

          {estado === "pendiente" && !hayAlgo && (
            <p className="text-[11px] text-muted-foreground">Sin reporte registrado este día.</p>
          )}
      </div>
    </div>
  );
}

function ReporteExpandido({ centro, puedeEditar, onAbrirReporte }: Props) {
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => ultimosDiasReporte(30, hoyClave)[0], [hoyClave]);

  const reportes = useReportesCentros({ centroId: centro.id, desde });
  const reportesRep = useReportesReparacionesDia({ centroId: centro.id, desde });
  const eventos = useEventosReportes({ centroId: centro.id, desde });
  const reparaciones = useReparacionesCentros({ centroId: centro.id });
  const pendientesRep = reparacionesPendientes(reparaciones);
  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });

  const diasConParte = useMemo(
    () => new Set(snapshots.map((s) => s.dia)),
    [snapshots],
  );
  const diasConReparaciones = useMemo(
    () => new Set(reportesRep.map((r) => r.dia)),
    [reportesRep],
  );
  const eventosPorDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const evento of eventos) m.set(evento.dia, (m.get(evento.dia) ?? 0) + 1);
    return m;
  }, [eventos]);
  const estadosPorDia = useMemo(
    () => estadosReportePorDia(reportes, diasConParte, { diasConReparaciones, eventosPorDia }),
    [reportes, diasConParte, diasConReparaciones, eventosPorDia],
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
  const contadores = useMemo(
    () =>
      contadoresReportesPorPeriodo(reportes, diasConParte, hoyClave, {
        diasConReparaciones,
        eventosPorDia,
      }),
    [reportes, diasConParte, diasConReparaciones, eventosPorDia, hoyClave],
  );

  const [filtro, setFiltro] = useState<FiltroLista>("hoy");
  const [diaSel, setDiaSel] = useState<string | null>(hoyClave);
  const [reportando, setReportando] = useState(false);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);

  function abrirFormularioReporte() {
    if (onAbrirReporte) {
      onAbrirReporte();
      return;
    }
    setReportando(true);
  }

  const { anio: hy, mes: hm } = parsearDiaReporte(hoyClave);
  const semInicio = (contadores.semanaDelMes - 1) * 7 + 1;
  const semFin = Math.min(contadores.semanaDelMes * 7, new Date(hy, hm, 0).getDate());
  const inicioMes = inicioMesClave(hoyClave);

  const diasLista = useMemo(() => {
    const todos = new Set<string>([...estadosPorDia.keys()]);
    todos.add(hoyClave);
    let dias = [...todos].filter((d) => d >= inicioMes);

    switch (filtro) {
      case "hoy":
        dias = [hoyClave];
        break;
      case "semana":
        dias = dias.filter((d) => {
          const p = parsearDiaReporte(d);
          return (
            p.anio === hy &&
            p.mes === hm &&
            p.dia >= semInicio &&
            p.dia <= semFin &&
            estadosPorDia.get(d) !== "pendiente"
          );
        });
        break;
      case "mes":
        dias = dias.filter((d) => {
          const p = parsearDiaReporte(d);
          return p.anio === hy && p.mes === hm && estadosPorDia.get(d) !== "pendiente";
        });
        break;
      case "dia":
        dias = diaSel ? [diaSel] : [];
        break;
      case "historial":
        dias = dias
          .filter((d) => estadosPorDia.get(d) !== "pendiente")
          .sort((a, b) => b.localeCompare(a))
          .slice(0, 30);
        break;
    }

    return dias.sort((a, b) => b.localeCompare(a));
  }, [filtro, estadosPorDia, hoyClave, hy, hm, semInicio, semFin, inicioMes, diaSel]);

  function seleccionarFiltro(f: FiltroLista, dia?: string | null) {
    setFiltro(f);
    if (f === "dia" && dia) setDiaSel(dia);
    if (f === "hoy") setDiaSel(hoyClave);
  }

  function tituloLista(): string {
    switch (filtro) {
      case "hoy":
        return `Reporte de hoy · ${formatearDiaCalendario(hoyClave)}`;
      case "semana":
        return `Semana ${contadores.semanaDelMes} · ${contadores.mesLabel} (${diasLista.length} días)`;
      case "mes":
        return `${contadores.mesLabel} · días reportados (${diasLista.length})`;
      case "dia":
        return diaSel ? `Día ${formatearDiaCalendario(diaSel)}` : "Selecciona un día en el calendario";
      case "historial":
        return `Historial reciente (${diasLista.length})`;
    }
  }

  const hoyPendiente = contadores.hoyEstado !== "completo";

  const diaMarcado = useMemo(() => {
    if (filtro === "dia" && diaSel) return diaSel;
    if (filtro === "hoy") return hoyClave;
    return null;
  }, [filtro, diaSel, hoyClave]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ClipboardCheck className="size-5 text-teal-400" />
            Reportes diarios
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Parte numérico, comidas por jornada, atenciones médicas y reparaciones.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {centroRequiereReparaciones(reparaciones) && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-500">
              <Wrench className="size-3" />
              {pendientesRep.length} reparación{pendientesRep.length !== 1 ? "es pendientes" : " pendiente"}
            </Badge>
          )}
          {hoyPendiente && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-500">
              Hoy: {META_ESTADO_REPORTE[contadores.hoyEstado].label}
            </Badge>
          )}
        </div>
      </div>

      {/* Fila 1: gráfico principal + calendario plegable */}
      <div className="flex items-stretch gap-2">
        {calendarioAbierto && (
          <div className="w-[11.5rem] shrink-0 sm:w-[12.5rem]">
            <CalendarioSelectorDia
              diaSeleccionado={filtro === "dia" || filtro === "hoy" ? diaSel : null}
              onSeleccionarDia={(dia) => {
                if (dia) seleccionarFiltro("dia", dia);
                else if (filtro === "dia") seleccionarFiltro("hoy");
              }}
              marcasPorDia={marcasPorDia}
              leyenda={leyendaCalendario}
              onCerrar={() => setCalendarioAbierto(false)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <GraficoReporteCentro
            centroId={centro.id}
            snapshots={snapshots}
            reportes={reportes}
            diaMarcado={diaMarcado}
            accionCalendario={
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
            }
          />
        </div>
      </div>

      {/* Fila 2: acción + detalle a ancho completo */}
      <div className="space-y-3">
        {puedeEditar && filtro === "hoy" && (
          <Card className="border-teal-500/25 bg-teal-500/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">Reporte de hoy</p>
                <p className="text-xs text-muted-foreground">
                  {contadores.hoyEstado === "completo"
                    ? "Parte numérico, comidas, salud y reparaciones registrados."
                    : contadores.hoyEstado === "parcial"
                      ? "Faltan secciones por completar (parte numérico y/o alguna comida)."
                      : contadores.hoyEstado === "solo_parte"
                        ? "Solo está el parte numérico; faltan las comidas del día."
                        : "Aún no se ha registrado nada hoy."}
                </p>
              </div>
              <Button type="button" onClick={abrirFormularioReporte}>
                <ClipboardCheck className="size-4" />
                {contadores.hoyEstado === "pendiente" ? "Reportar hoy" : "Editar reporte"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">{tituloLista()}</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant={filtro === "hoy" ? "secondary" : "outline"}
                  onClick={() => seleccionarFiltro("hoy")}
                >
                  Hoy
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={filtro === "historial" ? "secondary" : "outline"}
                  onClick={() => seleccionarFiltro("historial")}
                >
                  <Clock className="size-3" />
                  Historial
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {diasLista.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {filtro === "hoy"
                    ? "Aún no hay reporte registrado hoy."
                    : "No hay reportes en este periodo."}
                </p>
                {filtro === "hoy" && puedeEditar && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={abrirFormularioReporte}
                  >
                    Registrar reporte de hoy
                  </Button>
                )}
              </div>
            ) : (
              diasLista.map((dia) => (
                <TarjetaReporteDia
                  key={dia}
                  dia={dia}
                  reporte={reportes.find((r) => r.dia === dia)}
                  reporteRep={reporteReparacionesDelDia(reportesRep, centro.id, dia)}
                  eventosDia={eventosDelDia(eventos, centro.id, dia)}
                  snapshot={snapshots.find((s) => s.dia === dia)}
                  snapshots={snapshots}
                  reparaciones={reparaciones}
                  parteNumerico={diasConParte.has(dia)}
                  estado={estadosPorDia.get(dia) ?? "pendiente"}
                  grande
                  esHoy={dia === hoyClave}
                  puedeEditar={puedeEditar}
                  onEditar={abrirFormularioReporte}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {!onAbrirReporte && reportando && (
        <ReporteDiarioForm centro={centro} onCerrar={() => setReportando(false)} />
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
  const reportesRep = useReportesReparacionesDia({ centroId: centro.id, dia: hoy });
  const eventos = useEventosReportes({ centroId: centro.id, dia: hoy });
  const reparaciones = useReparacionesCentros({ centroId: centro.id });
  const reporteRep = reporteReparacionesDelDia(reportesRep, centro.id, hoy);
  const pendientesRep = reparacionesPendientes(reparaciones);
  const reporte = reporteDelDia(reportes, centro.id, hoy);
  const jornadas = jornadasReportadas(reporte);
  const raciones = racionesDelDia(reporte);
  const casosAtencion = reporte?.atenciones_medicas_detalle ?? [];
  const atenciones = contarAtenciones(casosAtencion, reporte?.atenciones_medicas);
  const obsSalud = reporte?.observaciones?.trim();
  const saludLista = saludReportada(reporte);
  const eventosOk = eventosRevisados(reporte, eventos.length);

  const snapshotsHoy = useOcupacionesCentros({ centroId: centro.id, desde: hoy });
  const parteHoy = snapshotsHoy.some((s) => s.dia === hoy);

  const completo = reporteCompleto(reporte, {
    parteNumerico: parteHoy,
    reparacionesRevisadas: Boolean(reporteRep),
    eventosRevisados: eventosOk,
  });
  const nadaReportado =
    !parteHoy &&
    jornadas.length === 0 &&
    !saludLista &&
    !reporteRep &&
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
        {centroRequiereReparaciones(reparaciones) && (
          <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-500">
            <Wrench className="size-3" />
            {pendientesRep.length} rep.
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ChipReporte etiqueta="Parte numérico" listo={parteHoy} />
        {CATALOGO_JORNADAS_REPORTE.map((j) => (
          <ChipReporte
            key={j.valor}
            etiqueta={j.label}
            listo={jornadas.includes(j.valor)}
          />
        ))}
        <ChipReporte etiqueta="Salud" listo={saludLista} />
        <ChipReporte etiqueta="Reparaciones" listo={Boolean(reporteRep)} />
        <ChipReporte etiqueta="Eventos" listo={eventosOk} />
      </div>

      {nadaReportado ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Este campamento aún no reporta nada hoy.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <UtensilsCrossed className="size-3.5 text-teal-400" />
              {raciones.toLocaleString("es")}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Raciones del día
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <Stethoscope className="size-3.5 text-rose-400" />
              {atenciones.toLocaleString("es")}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {saludLista && atenciones === 0 ? "Sin atenciones confirmado" : "Atenciones médicas"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <Wrench className="size-3.5 text-amber-400" />
              {reporteRep ? 1 : 0}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Reparaciones revisadas
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <CalendarPlus className="size-3.5 text-emerald-400" />
              {eventos.length}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {eventosOk && eventos.length === 0 ? "Sin eventos confirmado" : "Eventos"}
            </div>
          </div>
        </div>
      )}

      {casosAtencion.length === 0 && obsSalud && (
        <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
          {obsSalud}
        </p>
      )}
      {casosAtencion.length > 0 && obsSalud && (
        <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground/80">
          Notas: {obsSalud}
        </p>
      )}

      {reporteRep && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Wrench className="mr-1 inline size-3 text-amber-400" />
          Reparaciones: requiere trabajos {reporteRep.requiere_trabajos ? "sí" : "no"}
          {reporteRep.se_trabajo_hoy ? ", se trabajó hoy" : ""}
        </p>
      )}
      {eventos.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <CalendarPlus className="mr-1 inline size-3 text-emerald-400" />
          {eventos.length} evento{eventos.length === 1 ? "" : "s"} registrado
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
export function SeccionReporteDiarioCentro({
  centro,
  puedeEditar,
  variant = "compacto",
  onAbrirReporte,
}: Props) {
  if (variant === "expandido") {
    return (
      <ReporteExpandido
        centro={centro}
        puedeEditar={puedeEditar}
        onAbrirReporte={onAbrirReporte}
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
