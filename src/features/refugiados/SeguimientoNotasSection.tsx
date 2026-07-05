// Pestaña Seguimiento — notas, derivaciones, plan de egreso, timeline.

import { useEffect, useState } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { actualizarSeguimiento } from "@/data/reposRefugiados";
import { useHistorial, type EntradaHistorial } from "@/data/historial";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import type { DerivacionSeguimiento, SeguimientoAlojamiento } from "@/domain/refugiados";
import { claveDia, nuevoId } from "@/data/reposSupabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  detalle: DetalleAlojamiento;
  puedeEditar: boolean;
}

export function SeguimientoNotasSection({ detalle, puedeEditar }: Props) {
  const seg = detalle.seguimiento;
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<SeguimientoAlojamiento>({
    ...seg,
    derivaciones: seg.derivaciones ?? [],
    plan_egreso: seg.plan_egreso ?? {},
  });

  const { entradas } = useHistorial({ entidadId: detalle.refugiado.id });

  useEffect(() => {
    setForm({
      ...detalle.seguimiento,
      derivaciones: detalle.seguimiento.derivaciones ?? [],
      plan_egreso: detalle.seguimiento.plan_egreso ?? {},
    });
  }, [detalle.seguimiento]);

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarSeguimiento(detalle.id, form);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function agregarDerivacion() {
    const nueva: DerivacionSeguimiento = {
      id: nuevoId(),
      fecha: claveDia(Date.now()),
      destino: "",
      motivo: "",
      estado: "pendiente",
    };
    setForm((p) => ({ ...p, derivaciones: [...(p.derivaciones ?? []), nueva] }));
  }

  const soloLectura = !puedeEditar || !editando;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4" />
              Seguimiento del caso
            </CardTitle>
            <CardDescription className="text-xs">Notas, derivaciones y plan de egreso</CardDescription>
          </div>
          {puedeEditar && !editando && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-[10px]">Notas del caso</Label>
            {soloLectura ? (
              <p className="text-sm whitespace-pre-wrap">{form.notas_caso || "—"}</p>
            ) : (
              <Textarea value={form.notas_caso ?? ""} onChange={(e) => setForm((p) => ({ ...p, notas_caso: e.target.value }))}
                rows={3} className="mt-1 text-xs" />
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Derivaciones</Label>
            {(form.derivaciones ?? []).map((d, i) => (
              <div key={d.id} className="mt-2 grid gap-2 rounded border p-2 sm:grid-cols-2">
                {soloLectura ? (
                  <p className="text-sm sm:col-span-2">{d.fecha}: {d.destino} — {d.motivo}</p>
                ) : (
                  <>
                    <Input value={d.destino} placeholder="Destino" className="h-9"
                      onChange={(e) => {
                        const arr = [...(form.derivaciones ?? [])];
                        arr[i] = { ...arr[i], destino: e.target.value };
                        setForm((p) => ({ ...p, derivaciones: arr }));
                      }} />
                    <Input value={d.motivo} placeholder="Motivo" className="h-9"
                      onChange={(e) => {
                        const arr = [...(form.derivaciones ?? [])];
                        arr[i] = { ...arr[i], motivo: e.target.value };
                        setForm((p) => ({ ...p, derivaciones: arr }));
                      }} />
                  </>
                )}
              </div>
            ))}
            {!soloLectura && (
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={agregarDerivacion}>
                <Plus className="size-3.5" /> Derivación
              </Button>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Plan de egreso</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {soloLectura ? (
                <>
                  <p className="text-sm">Motivo: {form.plan_egreso?.motivo || "—"}</p>
                  <p className="text-sm">Destino: {form.plan_egreso?.destino_probable || detalle.destino_egreso || "—"}</p>
                </>
              ) : (
                <>
                  <Input value={form.plan_egreso?.motivo ?? ""} placeholder="Motivo egreso" className="h-9"
                    onChange={(e) => setForm((p) => ({ ...p, plan_egreso: { ...p.plan_egreso, motivo: e.target.value } }))} />
                  <Input value={form.plan_egreso?.destino_probable ?? ""} placeholder="Destino probable" className="h-9"
                    onChange={(e) => setForm((p) => ({ ...p, plan_egreso: { ...p.plan_egreso, destino_probable: e.target.value } }))} />
                  <div className="sm:col-span-2">
                    <Textarea value={form.plan_egreso?.apoyos_necesarios ?? ""} placeholder="Apoyos necesarios" rows={2} className="text-xs"
                      onChange={(e) => setForm((p) => ({ ...p, plan_egreso: { ...p.plan_egreso, apoyos_necesarios: e.target.value } }))} />
                  </div>
                </>
              )}
            </div>
          </div>

          {editando && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditando(false)}>Cancelar</Button>
              <Button size="sm" disabled={guardando} onClick={() => void guardar()}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Timeline reciente</CardTitle>
          <CardDescription className="text-xs">Acciones en bitácora sobre esta persona</CardDescription>
        </CardHeader>
        <CardContent>
          {entradas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin entradas en bitácora.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
              {entradas.slice(0, 20).map((e: EntradaHistorial) => (
                <li key={e.id} className="rounded border border-border/50 px-2 py-1">
                  <span className="text-muted-foreground">{new Date(e.ts).toLocaleString("es")}</span>
                  {" · "}
                  <span className="font-medium">{e.accion}</span>
                  {e.usuario && <span className="text-muted-foreground"> — {e.usuario}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
