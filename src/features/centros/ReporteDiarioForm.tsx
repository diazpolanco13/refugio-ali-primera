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
//
// Si ya existe un reporte del día, el formulario carga sobre lo ya reportado
// (clave lógica `centro_id, dia`: la última edición del día gana).

import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Stethoscope, Users, UtensilsCrossed } from "lucide-react";
import { guardarCentro, claveDia } from "@/data/reposSupabase";
import { guardarReporteDiario } from "@/data/reposReportes";
import { useReportesCentros } from "@/data/useReportesCentros";
import {
  CATALOGO_JORNADAS_REPORTE,
  normalizarComidas,
  reporteDelDia,
  type ComidasDia,
  type JornadaReporte,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  centro: CentroTransitorio;
  onCerrar: () => void;
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
  const [atenciones, setAtenciones] = useState(0);
  const [observaciones, setObservaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

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
    setAtenciones(reporteExistente.atenciones_medicas);
    setObservaciones(reporteExistente.observaciones);
    setPrecargado(true);
  }, [precargado, reporteExistente]);

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

  async function guardar() {
    setErrorGuardado(null);
    setGuardando(true);
    try {
      // 1) Parte numérico → centro (snapshot histórico automático si cambió).
      await guardarCentro({
        ...centro,
        ocupacion,
        personal,
        total_afectados: totalAfectados,
        familias_ocupadas: familias,
      });
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
        atenciones_medicas: atenciones,
        observaciones: observaciones.trim(),
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
        className="flex max-h-[96dvh] flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg">Reporte del día</DialogTitle>
          <DialogDescription className="text-sm">
            N.° {centro.nro} · {centro.nombre} ·{" "}
            {new Date(`${hoy}T12:00:00`).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "long",
            })}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="parte"
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 border-b border-border px-5 pb-3 sm:px-6">
            <TabsList className="w-full">
              <TabsTrigger value="parte">
                <Users className="size-4" />
                <span className="hidden sm:inline">Parte numérico</span>
                <span className="sm:hidden">Parte</span>
              </TabsTrigger>
              <TabsTrigger value="comidas">
                <UtensilsCrossed className="size-4" />
                Comidas
              </TabsTrigger>
              <TabsTrigger value="salud">
                <Stethoscope className="size-4" />
                <span className="hidden sm:inline">Atención médica</span>
                <span className="sm:hidden">Salud</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
            {/* Parte numérico: población, familias, desglose y personal */}
            <TabsContent value="parte" className="space-y-5">
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
                  . Al guardar se registra el snapshot del día en el histórico.
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
            <TabsContent value="comidas" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Registra las raciones recibidas en cada jornada, a qué hora llegó la
                comida y quién la proveyó. Deja en 0 / vacío lo que aún no llega.
              </p>
              {CATALOGO_JORNADAS_REPORTE.map((j) => (
                <Card key={j.valor} size="sm" className="py-2">
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

            {/* Atención médica del día */}
            <TabsContent value="salud" className="space-y-4">
              <div>
                <Label htmlFor="reporte-atenciones" className="text-sm font-semibold">
                  Atenciones médicas del día
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Número de personas atendidas por el personal de salud hoy.
                </p>
                <NumInput
                  id="reporte-atenciones"
                  className="mt-2 w-40"
                  value={atenciones}
                  onChange={setAtenciones}
                />
              </div>
              <div>
                <Label htmlFor="reporte-observaciones">Observaciones del día</Label>
                <Textarea
                  id="reporte-observaciones"
                  className="mt-1.5"
                  rows={4}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej. dos casos de fiebre en niños, se refirió un paciente al hospital…"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          {errorGuardado && (
            <p className="mr-auto max-w-[60%] text-xs leading-snug text-destructive">
              {errorGuardado}
            </p>
          )}
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
