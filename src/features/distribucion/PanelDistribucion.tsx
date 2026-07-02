import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  CheckCheck,
  Clock,
  Lock,
  UtensilsCrossed,
} from "lucide-react";
import { db } from "@/data/db";
import { guardarJornada, marcarEntrega, marcarTodos } from "@/data/repos";
import type { Sesion } from "@/data/auth";
import {
  CATALOGO_JORNADAS,
  type Jornada,
  type RegistroDistribucion,
  type Sector,
} from "@/domain/tipos";
import {
  claveDiaLocal,
  formatoHora,
  horaAInput,
  horaDesdeInput,
  resumenDistribucion,
} from "@/domain/distribucion";
import { PanelFlotante } from "@/components/PanelFlotante";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
  onCerrar: () => void;
}

/** Jornada sugerida según la hora del día (para abrir el panel en lo actual). */
function jornadaSugerida(): Jornada {
  const h = new Date().getHours();
  if (h < 10) return "desayuno";
  if (h < 15) return "almuerzo";
  if (h < 18) return "merienda";
  return "cena";
}

export function PanelDistribucion({ sesion, onCerrar }: Props) {
  const rol = sesion.user.rol;
  const esGestor = rol === "admin" || rol === "coordinador";
  const puedeEditar = esGestor || rol === "campo";
  const sectorPropio = sesion.user.sector_asignado ?? null;

  const dia = claveDiaLocal();
  const [jornada, setJornada] = useState<Jornada>(jornadaSugerida);

  const sectores = useLiveQuery(() => db.sectores.toArray(), [], [] as Sector[]);
  const registros = useLiveQuery(
    () => db.distribuciones.toArray(),
    [],
    [] as RegistroDistribucion[],
  );

  const resumenes = useMemo(
    () => resumenDistribucion(dia, registros, sectores),
    [dia, registros, sectores],
  );
  const actual = useMemo(
    () => resumenes.find((r) => r.jornada === jornada) ?? null,
    [resumenes, jornada],
  );

  // Datos de logística editables (raciones / proveedor).
  const [raciones, setRaciones] = useState<string>("");
  const [proveedor, setProveedor] = useState<string>("");
  // Semilla local cuando cambia la jornada seleccionada.
  const cabeceraId = actual?.cabecera?.id ?? jornada;
  const [semilla, setSemilla] = useState<string>("");
  if (semilla !== cabeceraId) {
    setSemilla(cabeceraId);
    setRaciones(actual?.cabecera?.raciones ? String(actual.cabecera.raciones) : "");
    setProveedor(actual?.cabecera?.proveedor ?? "");
  }

  function puedeMarcarSector(sectorId: string): boolean {
    if (!puedeEditar) return false;
    if (esGestor) return true;
    return sectorId === sectorPropio;
  }

  async function registrarLlegada() {
    await guardarJornada(dia, jornada, { hora_llegada: Date.now() });
  }
  async function cambiarHoraManual(hhmm: string) {
    await guardarJornada(dia, jornada, { hora_llegada: horaDesdeInput(dia, hhmm) });
  }
  async function guardarLogistica() {
    await guardarJornada(dia, jornada, {
      raciones: Number(raciones) || 0,
      proveedor: proveedor.trim(),
    });
  }
  async function alternarSector(sector: Sector) {
    const yaServido = actual?.entregas.has(sector.id) ?? false;
    await marcarEntrega(
      { id: sector.id, nombre: sector.nombre },
      dia,
      jornada,
      !yaServido,
    );
  }
  async function marcarTodosSectores() {
    await marcarTodos(
      sectores.map((s) => ({ id: s.id, nombre: s.nombre })),
      dia,
      jornada,
    );
  }

  const esHidratacion = jornada === "hidratacion";

  return (
    <PanelFlotante
      titulo="Distribución de comida"
      descripcion="Registro de alimentación e hidratación del día"
      icono={<UtensilsCrossed className="size-4 text-primary" />}
      onCerrar={onCerrar}
    >
      {/* Selector de jornada */}
      <div className="mb-3 grid grid-cols-5 gap-1.5">
        {CATALOGO_JORNADAS.map((j) => {
          const r = resumenes.find((x) => x.jornada === j.valor);
          const activo = j.valor === jornada;
          return (
            <button
              key={j.valor}
              onClick={() => setJornada(j.valor)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors",
                activo
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span className="text-lg leading-none">{j.icono}</span>
              <span className="text-[10px] font-medium leading-tight">{j.label}</span>
              {r && r.total > 0 && (
                <span
                  className={cn(
                    "text-[9px] tabular-nums",
                    r.completo ? "text-emerald-500" : "text-muted-foreground",
                  )}
                >
                  {r.servidos}/{r.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Cabecera logística de la jornada */}
      <Card size="sm" className="mb-3 py-2">
        <CardContent className="space-y-2.5 px-3 py-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                {esHidratacion ? "Llegada del agua" : "Llegada de la comida"}
              </p>
              {esGestor ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input
                    type="time"
                    aria-label="Hora de llegada"
                    value={horaAInput(actual?.horaLlegada)}
                    onChange={(e) => cambiarHoraManual(e.target.value)}
                    className="h-8 w-[7.5rem] tabular-nums"
                  />
                </div>
              ) : (
                <p className="flex items-center gap-1 text-sm tabular-nums text-foreground">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {actual?.horaLlegada ? formatoHora(actual.horaLlegada) : "Sin registrar"}
                </p>
              )}
            </div>
            {esGestor && (
              <Button
                size="sm"
                variant="outline"
                onClick={registrarLlegada}
                title="Fijar la hora de llegada a la hora actual"
              >
                Ahora
              </Button>
            )}
          </div>

          {esGestor && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="dist-raciones" className="text-[11px]">
                  Raciones
                </Label>
                <Input
                  id="dist-raciones"
                  type="number"
                  min={0}
                  value={raciones}
                  onChange={(e) => setRaciones(e.target.value)}
                  onBlur={guardarLogistica}
                  placeholder="0"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dist-proveedor" className="text-[11px]">
                  Proveedor
                </Label>
                <Input
                  id="dist-proveedor"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  onBlur={guardarLogistica}
                  placeholder="Opcional"
                  className="h-8"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones de gestor */}
      {esGestor && sectores.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mb-3 w-full gap-1.5"
          onClick={marcarTodosSectores}
        >
          <CheckCheck className="size-4" />
          Marcar todos los sectores
        </Button>
      )}

      {/* Lista de sectores */}
      {sectores.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No hay sectores. Dibuja sectores en el mapa para registrar la distribución.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sectores.map((s) => {
            const entrega = actual?.entregas.get(s.id);
            const servido = !!entrega;
            const puede = puedeMarcarSector(s.id);
            const propio = s.id === sectorPropio;
            return (
              <li key={s.id}>
                <Card
                  size="sm"
                  className={cn(
                    "py-2",
                    servido && "border-emerald-500/40 bg-emerald-500/5",
                  )}
                >
                  <CardContent className="flex items-center justify-between gap-2 px-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-full"
                          style={{ background: s.color }}
                        />
                        <span className="truncate text-sm font-medium text-foreground">
                          {s.nombre || s.id}
                        </span>
                        {propio && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-[10px] text-primary"
                          >
                            mi sector
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {servido ? (
                          <span className="text-emerald-500">
                            Servido {formatoHora(entrega?.hora_entrega)}
                            {entrega?.updated_by ? ` · @${entrega.updated_by}` : ""}
                          </span>
                        ) : (
                          "Pendiente"
                        )}
                      </div>
                    </div>
                    {puede ? (
                      <Button
                        size="sm"
                        variant={servido ? "outline" : "default"}
                        className="shrink-0 gap-1"
                        onClick={() => alternarSector(s)}
                      >
                        {servido ? (
                          "Deshacer"
                        ) : (
                          <>
                            <Check className="size-3.5" />
                            Ya comió
                          </>
                        )}
                      </Button>
                    ) : (
                      <Lock className="size-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PanelFlotante>
  );
}
