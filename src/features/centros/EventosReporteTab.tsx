// Pestaña Eventos del reporte diario: eventos positivos/negativos y
// participantes vinculados a fichas nominales o capturados manualmente.

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import { nuevoId } from "@/data/reposSupabase";
import {
  CATALOGO_TIPOS_EVENTO_REPORTE,
  META_TIPO_EVENTO_REPORTE,
  textoParticipantesEvento,
  type EventoReporte,
  type ParticipanteEventoReporte,
  type TipoEventoReporte,
} from "@/domain/eventosReportes";
import { formatearCedula, nombreCompleto, type AlojamientoEnriquecido } from "@/domain/refugiados";
import { BloqueConfirmacionReporte } from "@/features/centros/BloqueConfirmacionReporte";
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizarTextoBusqueda } from "./CentrosListaItems";

interface Props {
  centroId: string;
  dia: string;
  eventos: EventoReporte[];
  eventosRevisados: boolean;
  modificado: boolean;
  onEventosChange: (eventos: EventoReporte[]) => void;
  onEventosRevisadosChange: (valor: boolean) => void;
  onBorradorPendienteChange?: (pendiente: boolean) => void;
  onConfirmarRevision?: () => void;
  onDesmarcarRevision?: () => void;
  deshabilitado?: boolean;
  guardando?: boolean;
}

interface BorradorEvento {
  tipo: TipoEventoReporte;
  hora: string;
  titulo: string;
  descripcion: string;
  participantes: ParticipanteEventoReporte[];
}

const BORRADOR_INICIAL: BorradorEvento = {
  tipo: "positivo",
  hora: "",
  titulo: "",
  descripcion: "",
  participantes: [],
};

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

function participanteDesdeAlojamiento(a: AlojamientoEnriquecido): ParticipanteEventoReporte {
  const refugiado = a.refugiado;
  const cedula = formatearCedula(refugiado.cedula, refugiado.tipo_doc);
  return {
    refugiado_id: refugiado.id,
    nombre: nombreCompleto(refugiado),
    cedula: cedula === "—" ? "" : cedula,
    codigo_ficha: refugiado.codigo_ficha,
  };
}

function etiquetaParticipante(p: ParticipanteEventoReporte): string {
  return p.nombre_manual?.trim() || p.nombre;
}

function IconoTipoEvento({ tipo }: { tipo: TipoEventoReporte }) {
  return tipo === "positivo" ? (
    <ThumbsUp className="size-3.5 text-emerald-400" />
  ) : (
    <ThumbsDown className="size-3.5 text-red-400" />
  );
}

export function EventosReporteTab({
  centroId,
  dia,
  eventos,
  eventosRevisados,
  modificado,
  onEventosChange,
  onEventosRevisadosChange,
  onBorradorPendienteChange,
  onConfirmarRevision,
  onDesmarcarRevision,
  deshabilitado,
  guardando,
}: Props) {
  const { alojamientos, cargando } = useAlojamientosCentro({ centroId, estado: "activo" });
  const [borrador, setBorrador] = useState<BorradorEvento>(BORRADOR_INICIAL);
  const [consulta, setConsulta] = useState("");
  const [nombreManual, setNombreManual] = useState("");
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const borradorPendiente =
    borrador.titulo.trim() !== "" ||
    borrador.descripcion.trim() !== "" ||
    borrador.hora.trim() !== "" ||
    borrador.participantes.length > 0;

  useEffect(() => {
    onBorradorPendienteChange?.(borradorPendiente);
  }, [borradorPendiente, onBorradorPendienteChange]);

  const idsSeleccionados = useMemo(
    () => new Set(borrador.participantes.map((p) => p.refugiado_id).filter(Boolean)),
    [borrador.participantes],
  );

  const resultados = useMemo(() => {
    const q = normalizarTextoBusqueda(consulta.trim());
    return alojamientos
      .filter((a) => !idsSeleccionados.has(a.refugiado_id))
      .filter((a) => {
        if (!q) return true;
        const r = a.refugiado;
        const texto = normalizarTextoBusqueda(
          [
            nombreCompleto(r),
            r.cedula,
            r.cedula_norm,
            r.codigo_ficha,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return texto.includes(q);
      })
      .slice(0, 20);
  }, [alojamientos, consulta, idsSeleccionados]);

  function agregarParticipante(participante: ParticipanteEventoReporte) {
    setBorrador((prev) => ({
      ...prev,
      participantes: [...prev.participantes, participante],
    }));
    setConsulta("");
    setNombreManual("");
    setSelectorAbierto(false);
  }

  function agregarManual() {
    const nombre = nombreManual.trim();
    if (!nombre) return;
    agregarParticipante({
      nombre,
      nombre_manual: nombre,
      refugiado_id: null,
    });
  }

  function quitarParticipante(idx: number) {
    setBorrador((prev) => ({
      ...prev,
      participantes: prev.participantes.filter((_, i) => i !== idx),
    }));
  }

  function agregarEvento() {
    if (!borrador.titulo.trim()) return;
    const evento: EventoReporte = {
      id: nuevoId(),
      centro_id: centroId,
      dia,
      ts: tsDesdeHora(borrador.hora, dia),
      tipo: borrador.tipo,
      titulo: borrador.titulo.trim(),
      descripcion: borrador.descripcion.trim(),
      participantes: borrador.participantes,
      creada_por: "",
      updated_at: Date.now(),
      updated_by: "",
    };
    onEventosChange([...eventos, evento]);
    onEventosRevisadosChange(true);
    setBorrador(BORRADOR_INICIAL);
  }

  function quitarEvento(id: string) {
    const restantes = eventos.filter((evento) => evento.id !== id);
    onEventosChange(restantes);
    if (restantes.length === 0) onEventosRevisadosChange(false);
  }


  return (
    <div className="min-w-0 space-y-4">
      <BloqueConfirmacionReporte
        titulo="Novedades y eventos"
        tituloRevisado="Novedades revisadas hoy"
        descripcion="Registra actividades, novedades positivas o situaciones negativas relevantes para el cierre diario."
        icono={CalendarPlus}
        acento="teal"
        revisado={eventosRevisados}
        modificado={modificado}
        guardando={guardando}
        deshabilitado={deshabilitado}
        onConfirmar={() => onConfirmarRevision?.()}
        onDesmarcar={onDesmarcarRevision}
        etiquetaGuardar="Guardar todos los cambios"
        etiquetaConfirmar={
          eventos.length === 0 ? "Confirmar sin novedades" : "Confirmar sin cambios"
        }
        etiquetaActualizar="Actualizar novedades"
        confirmacionBloqueada={borradorPendiente}
        mensajeConfirmacionBloqueada={
          borradorPendiente
            ? "Guarda la novedad en edición antes de guardar todos los cambios."
            : undefined
        }
        badgeExtra={
          <Badge variant="outline" className="w-fit shrink-0 gap-1 tabular-nums">
            {eventos.length} evento{eventos.length === 1 ? "" : "s"}
          </Badge>
        }
      />

      {eventos.length > 0 && (
        <div className="space-y-2">
          {eventos.map((evento) => {
            const meta = META_TIPO_EVENTO_REPORTE[evento.tipo];
            return (
              <Card key={evento.id} size="sm" className="border-border/80 py-0">
                <CardContent className="flex min-w-0 items-start gap-2 px-3 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                    <IconoTipoEvento tipo={evento.tipo} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">
                        {evento.titulo}
                      </p>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px]"
                        style={{ borderColor: `${meta.color}66`, color: meta.color }}
                      >
                        {meta.label}
                      </Badge>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {horaDesdeTs(evento.ts) || "Sin hora"}
                      </span>
                    </div>
                    {evento.descripcion && (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-snug text-muted-foreground">
                        {evento.descripcion}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      <Users className="mr-1 inline size-3" />
                      {textoParticipantesEvento(evento)}
                    </p>
                    {evento.participantes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {evento.participantes.map((p, i) => (
                          <Badge key={`${evento.id}-${i}`} variant="secondary" className="text-[10px]">
                            {etiquetaParticipante(p)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={deshabilitado}
                    onClick={() => quitarEvento(evento.id)}
                    aria-label="Eliminar evento"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card size="sm" className="border-border/80">
        <CardHeader className="px-3 py-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Plus className="size-3.5 text-teal-400" />
            Nuevo evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
            <div>
              <Label className="text-[11px] text-muted-foreground">Tipo</Label>
              <Select
                value={borrador.tipo}
                disabled={deshabilitado}
                onValueChange={(v) =>
                  setBorrador((prev) => ({ ...prev, tipo: v as TipoEventoReporte }))
                }
              >
                <SelectTrigger className={claseSelectReporte}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOGO_TIPOS_EVENTO_REPORTE.map((tipo) => (
                    <SelectItem key={tipo.valor} value={tipo.valor}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="evento-hora" className="text-[11px] text-muted-foreground">
                Hora
              </Label>
              <Input
                id="evento-hora"
                type="time"
                className="mt-1"
                disabled={deshabilitado}
                value={borrador.hora}
                onChange={(e) => setBorrador((prev) => ({ ...prev, hora: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="evento-titulo" className="text-[11px] text-muted-foreground">
              Título
            </Label>
            <Input
              id="evento-titulo"
              className="mt-1"
              disabled={deshabilitado}
              value={borrador.titulo}
              onChange={(e) => setBorrador((prev) => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ej. jornada recreativa, conflicto, visita institucional…"
            />
          </div>

          <div>
            <Label htmlFor="evento-desc" className="text-[11px] text-muted-foreground">
              Descripción
            </Label>
            <Textarea
              id="evento-desc"
              className="mt-1"
              rows={3}
              disabled={deshabilitado}
              value={borrador.descripcion}
              onChange={(e) =>
                setBorrador((prev) => ({ ...prev, descripcion: e.target.value }))
              }
              placeholder="Resumen breve de lo ocurrido y acciones tomadas…"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">Participantes</Label>
              <Popover open={selectorAbierto} onOpenChange={setSelectorAbierto}>
                <PopoverTrigger asChild>
                  <Button type="button" size="xs" variant="outline" disabled={deshabilitado}>
                    <UserRound className="size-3" />
                    Agregar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="end">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={consulta}
                      onValueChange={setConsulta}
                      placeholder="Buscar por nombre o cédula…"
                    />
                    <CommandList>
                      <CommandEmpty>
                        {cargando ? "Cargando…" : "Sin resultados en este campamento."}
                      </CommandEmpty>
                      <CommandGroup>
                        {resultados.map((a) => {
                          const r = a.refugiado;
                          return (
                            <CommandItem
                              key={a.id}
                              value={r.id}
                              onSelect={() => agregarParticipante(participanteDesdeAlojamiento(a))}
                              className="items-start py-2"
                            >
                              <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {nombreCompleto(r)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {r.codigo_ficha ?? formatearCedula(r.cedula, r.tipo_doc)}
                                </p>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-t border-border p-2">
                    <Label htmlFor="evento-participante-manual" className="text-[10px]">
                      Agregar nombre manual
                    </Label>
                    <div className="mt-1 flex gap-1.5">
                      <Input
                        id="evento-participante-manual"
                        className="h-8"
                        value={nombreManual}
                        onChange={(e) => setNombreManual(e.target.value)}
                        placeholder="Nombre y apellido"
                      />
                      <Button
                        type="button"
                        size="xs"
                        disabled={!nombreManual.trim()}
                        onClick={agregarManual}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {borrador.participantes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Puedes dejarlo vacío si el evento no involucra damnificados específicos.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {borrador.participantes.map((p, i) => (
                  <Badge key={`${etiquetaParticipante(p)}-${i}`} variant="secondary" className="gap-1 pr-1">
                    {etiquetaParticipante(p)}
                    <button
                      type="button"
                      disabled={deshabilitado}
                      onClick={() => quitarParticipante(i)}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            disabled={deshabilitado || !borrador.titulo.trim()}
            onClick={agregarEvento}
          >
            <Plus className="size-4" />
            Guardar esta novedad
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
