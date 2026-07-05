// Pestaña Tallas y dotaciones — kit mínimo recomendado y pendientes.

import { useMemo, useState } from "react";
import { Gift, Info, Loader2, Plus } from "lucide-react";
import {
  calcularPendientes,
  kitRecomendadoParaPersona,
  prioridadEntrega,
  type PendienteKit,
} from "@/domain/kitMinimo";
import { META_ITEM_KIT } from "@/domain/beneficios";
import { otorgarItemKit } from "@/data/reposRefugiados";
import { useBeneficiosRefugiado } from "@/data/useBeneficiosRefugiado";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import { claveDia } from "@/data/reposSupabase";
import { actualizarTallas } from "@/data/reposRefugiados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BeneficiosRefugiadoSection } from "./BeneficiosRefugiadoSection";

interface Props {
  detalle: DetalleAlojamiento;
  puedeEditar: boolean;
  nombresCentros?: Map<string, string>;
}

const COLOR_PRIORIDAD = {
  alta: "text-rose-400 border-rose-500/50",
  media: "text-amber-400 border-amber-500/50",
  baja: "text-muted-foreground",
};

function textoTooltipKit(p: PendienteKit, recomendado?: { cantidad: number; tallaSugerida?: string; notas?: string }) {
  const lineas = [
    `Recomendado: ×${recomendado?.cantidad ?? p.necesario}`,
    recomendado?.tallaSugerida ? `Talla sugerida: ${recomendado.tallaSugerida}` : null,
    `Recibido: ${p.recibido} · Faltante: ${p.faltante}`,
    recomendado?.notas ?? null,
  ].filter(Boolean);
  return lineas.join("\n");
}

export function TallasDotacionesSection({ detalle, puedeEditar, nombresCentros }: Props) {
  const { refugiado } = detalle;
  const { beneficios, cargando, recargar } = useBeneficiosRefugiado(refugiado.id);
  const [editandoTallas, setEditandoTallas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [errorEntrega, setErrorEntrega] = useState<string | null>(null);
  const [pendienteEntrega, setPendienteEntrega] = useState<PendienteKit | null>(null);
  const [cantidadEntrega, setCantidadEntrega] = useState("1");

  const [camisa, setCamisa] = useState(refugiado.tallas.camisa ?? "");
  const [pantalon, setPantalon] = useState(refugiado.tallas.pantalon ?? "");
  const [zapatos, setZapatos] = useState(refugiado.tallas.zapatos ?? "");
  const [ropaInterior, setRopaInterior] = useState(refugiado.tallas.ropa_interior ?? "");
  const [calcetines, setCalcetines] = useState(refugiado.tallas.calcetines ?? "");
  const [notasTallas, setNotasTallas] = useState(refugiado.tallas.notas ?? "");

  const kit = useMemo(
    () => kitRecomendadoParaPersona(refugiado, refugiado.tallas),
    [refugiado],
  );
  const kitPorItem = useMemo(() => new Map(kit.map((k) => [k.item, k])), [kit]);
  const prio = prioridadEntrega(refugiado);
  const pendientes = useMemo(
    () => calcularPendientes(beneficios, kit, prio),
    [beneficios, kit, prio],
  );
  const avance = useMemo(() => {
    const totalNecesario = kit.reduce((sum, item) => sum + item.cantidad, 0);
    const totalFaltante = pendientes.reduce((sum, item) => sum + item.faltante, 0);
    const totalEntregado = Math.max(0, totalNecesario - totalFaltante);
    const porcentaje = totalNecesario > 0 ? Math.round((totalEntregado / totalNecesario) * 100) : 0;
    return { totalNecesario, totalEntregado, totalFaltante, porcentaje };
  }, [kit, pendientes]);

  async function guardarTallas() {
    setGuardando(true);
    try {
      await actualizarTallas(refugiado.id, {
        camisa,
        pantalon,
        zapatos,
        ropa_interior: ropaInterior,
        calcetines,
        notas: notasTallas,
      });
      setEditandoTallas(false);
    } finally {
      setGuardando(false);
    }
  }

  function abrirEntrega(p: PendienteKit) {
    setErrorEntrega(null);
    setPendienteEntrega(p);
    setCantidadEntrega("1");
  }

  async function entregarPendiente(p: PendienteKit, cantidad: number) {
    const cantidadNormalizada = Math.max(1, Math.floor(cantidad));
    setErrorEntrega(null);
    setEntregando(p.item);
    try {
      await otorgarItemKit({
        refugiado_id: refugiado.id,
        centro_id: detalle.centro_id,
        item_kit: p.item,
        talla: p.talla,
        cantidad: cantidadNormalizada,
        fecha: claveDia(Date.now()),
      });
      // Refetch inmediato: no dependemos de que llegue el evento Realtime.
      await recargar();
      setPendienteEntrega(null);
    } catch (err) {
      setErrorEntrega(err instanceof Error ? err.message : "Error al registrar entrega");
    } finally {
      setEntregando(null);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-sm">Tallas registradas</CardTitle>
              <CardDescription className="text-xs">
                Usadas para recomendar dotaciones del kit mínimo
              </CardDescription>
            </div>
            {puedeEditar && !editandoTallas && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditandoTallas(true)}>
                Editar tallas
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editandoTallas ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Camisa", camisa, setCamisa],
                    ["Pantalón", pantalon, setPantalon],
                    ["Zapatos", zapatos, setZapatos],
                    ["Ropa interior", ropaInterior, setRopaInterior],
                    ["Calcetines", calcetines, setCalcetines],
                  ] as const
                ).map(([label, val, set]) => (
                  <div key={label}>
                    <Label className="text-[10px]">{label}</Label>
                    <Input value={val} onChange={(e) => set(e.target.value)} className="mt-1 h-9" placeholder="M, 38, L…" />
                  </div>
                ))}
                <div className="sm:col-span-3">
                  <Label className="text-[10px]">Notas</Label>
                  <Textarea value={notasTallas} onChange={(e) => setNotasTallas(e.target.value)} rows={2} className="mt-1 text-xs" />
                </div>
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditandoTallas(false)}>Cancelar</Button>
                  <Button type="button" size="sm" disabled={guardando} onClick={() => void guardarTallas()}>
                    {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  ["Camisa", refugiado.tallas.camisa],
                  ["Pantalón", refugiado.tallas.pantalon],
                  ["Zapatos", refugiado.tallas.zapatos],
                  ["Ropa int.", refugiado.tallas.ropa_interior],
                  ["Calcetines", refugiado.tallas.calcetines],
                ].map(([l, v]) => (
                  <Badge key={l as string} variant="outline" className="text-[10px]">
                    {l}: {v || "—"}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avance de dotación</CardTitle>
            <CardDescription className="text-xs">
              Porcentaje del kit mínimo recomendado que ya fue entregado a esta persona.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums">{avance.porcentaje}%</p>
                <p className="text-xs text-muted-foreground">
                  {avance.totalEntregado} de {avance.totalNecesario} ítems entregados
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Pendientes: <span className="font-medium text-foreground">{avance.totalFaltante}</span></p>
                <p>Entregados: <span className="font-medium text-foreground">{avance.totalEntregado}</span></p>
              </div>
            </div>
            <Progress value={avance.porcentaje} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gift className="size-4" />
              Kit mínimo — pendientes
            </CardTitle>
            <CardDescription className="text-xs">
              Usa <strong>Entregar</strong> para registrar cada ítem. Prioridad:{" "}
              <Badge variant="outline" className={COLOR_PRIORIDAD[prio]}>{prio}</Badge>
              {" · "}
              Pasa el cursor sobre el ítem para ver la recomendación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorEntrega && (
              <p className="mb-2 text-xs text-destructive">{errorEntrega}</p>
            )}
            {cargando ? (
              <p className="text-xs text-muted-foreground">Calculando…</p>
            ) : pendientes.length === 0 ? (
              <p className="text-sm text-emerald-400">Kit mínimo completo según perfil.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Talla</TableHead>
                      <TableHead>Faltante</TableHead>
                      <TableHead>Prioridad</TableHead>
                      {puedeEditar && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendientes.map((p) => {
                      const recomendado = kitPorItem.get(p.item);
                      return (
                        <TableRow key={p.item}>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-left underline decoration-dotted underline-offset-2 hover:text-foreground"
                                >
                                  {META_ITEM_KIT[p.item]?.label ?? p.item}
                                  <Info className="size-3 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs whitespace-pre-line">
                                {textoTooltipKit(p, recomendado)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{p.talla ?? "—"}</TableCell>
                          <TableCell className="tabular-nums">{p.faltante}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${COLOR_PRIORIDAD[p.prioridad]}`}>
                              {p.prioridad}
                            </Badge>
                          </TableCell>
                          {puedeEditar && (
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-[10px]"
                                disabled={entregando === p.item}
                                onClick={() => abrirEntrega(p)}
                              >
                                <Plus className="size-3" />
                                {entregando === p.item ? "…" : "Entregar"}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <BeneficiosRefugiadoSection
          refugiadoId={refugiado.id}
          centroId={detalle.centro_id}
          puedeEditar={puedeEditar}
          nombresCentros={nombresCentros}
          beneficiosExternos={beneficios}
          cargandoExterno={cargando}
          onMutado={recargar}
          soloHistorial
        />

        <Dialog
          open={Boolean(pendienteEntrega)}
          onOpenChange={(open) => {
            if (!open) setPendienteEntrega(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar entrega</DialogTitle>
              <DialogDescription>
                {pendienteEntrega
                  ? `${META_ITEM_KIT[pendienteEntrega.item]?.label ?? pendienteEntrega.item}${
                      pendienteEntrega.talla ? ` · talla ${pendienteEntrega.talla}` : ""
                    }. Faltan ${pendienteEntrega.faltante}.`
                  : "Indica cuántas unidades estás entregando."}
              </DialogDescription>
            </DialogHeader>
            {pendienteEntrega && (
              <div className="space-y-2 px-4 py-3">
                <Label className="text-xs">Cantidad a entregar</Label>
                <Input
                  type="number"
                  min={1}
                  value={cantidadEntrega}
                  onChange={(e) => setCantidadEntrega(e.target.value)}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Pendiente sugerido para este ítem: {pendienteEntrega.faltante}. Puedes registrar más si la entrega real fue mayor.
                </p>
                {errorEntrega && <p className="text-xs text-destructive">{errorEntrega}</p>}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendienteEntrega(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!pendienteEntrega || entregando === pendienteEntrega.item}
                onClick={() => {
                  if (!pendienteEntrega) return;
                  void entregarPendiente(pendienteEntrega, Number(cantidadEntrega));
                }}
              >
                {pendienteEntrega && entregando === pendienteEntrega.item ? "Guardando…" : "Registrar entrega"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
