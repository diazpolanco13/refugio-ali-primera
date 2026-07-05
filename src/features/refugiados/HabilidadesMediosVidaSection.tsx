// Sección Empleo y habilidades (medios de vida), apilada en la pestaña Personal.

import { useState } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { CATALOGO_HABILIDADES, type HabilidadRefugiado, type HabilidadesRefugiado } from "@/domain/refugiados";
import { actualizarHabilidades } from "@/data/reposRefugiados";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  detalle: DetalleAlojamiento;
  puedeEditar: boolean;
}

export function HabilidadesMediosVidaSection({ detalle, puedeEditar }: Props) {
  const h = detalle.refugiado.habilidades;
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<HabilidadesRefugiado>({ ...h, habilidades: h.habilidades ?? [] });

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarHabilidades(detalle.refugiado.id, form);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  function toggleHabilidad(nombre: string) {
    setForm((prev) => {
      const lista = prev.habilidades ?? [];
      const existe = lista.find((x) => x.nombre === nombre);
      if (existe) {
        return { ...prev, habilidades: lista.filter((x) => x.nombre !== nombre) };
      }
      return { ...prev, habilidades: [...lista, { nombre, nivel: "intermedio" }] };
    });
  }

  function cambiarNivel(nombre: string, nivel: HabilidadRefugiado["nivel"]) {
    setForm((prev) => ({
      ...prev,
      habilidades: (prev.habilidades ?? []).map((x) => x.nombre === nombre ? { ...x, nivel } : x),
    }));
  }

  const soloLectura = !puedeEditar || !editando;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Briefcase className="size-4" />
            Empleo y habilidades
          </CardTitle>
          <CardDescription className="text-xs">Ocupación previa y disponibilidad en campamento</CardDescription>
        </div>
        {puedeEditar && !editando && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setForm({ ...h, habilidades: h.habilidades ?? [] }); setEditando(true); }}>
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-[10px] text-muted-foreground">Ocupación previa</Label>
          {soloLectura ? (
            <p className="text-sm">{form.ocupacion_previa || "—"}</p>
          ) : (
            <Textarea value={form.ocupacion_previa ?? ""} onChange={(e) => setForm((p) => ({ ...p, ocupacion_previa: e.target.value }))}
              rows={2} className="mt-1 text-xs" />
          )}
        </div>

        <div>
          <Label className="text-[10px]">Habilidades</Label>
          {!soloLectura && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Marca las habilidades que aplica; al seleccionar, elige el nivel.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {CATALOGO_HABILIDADES.map((nombre) => {
              const sel = (form.habilidades ?? []).find((x) => x.nombre === nombre);
              if (soloLectura) {
                if (!sel) return null;
                return (
                  <Badge key={nombre} variant="outline" className="text-[10px]">
                    {nombre} · {sel.nivel}
                  </Badge>
                );
              }
              const id = `hab-${nombre.replace(/\s+/g, "-").toLowerCase()}`;
              return (
                <label
                  key={nombre}
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors",
                    sel
                      ? "border-primary/50 bg-primary/10"
                      : "border-muted-foreground/50 bg-muted/20 hover:border-muted-foreground/80 hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={Boolean(sel)}
                    onCheckedChange={() => toggleHabilidad(nombre)}
                  />
                  <span className="text-xs">{nombre}</span>
                  {sel && (
                    <Select
                      value={sel.nivel}
                      onValueChange={(v) => cambiarNivel(nombre, v as HabilidadRefugiado["nivel"])}
                    >
                      <SelectTrigger
                        className="h-6 w-24 text-[10px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basico">Básico</SelectItem>
                        <SelectItem value="intermedio">Intermedio</SelectItem>
                        <SelectItem value="avanzado">Avanzado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="disp" checked={form.disponible_campamento !== false} disabled={soloLectura}
            onCheckedChange={(v) => setForm((p) => ({ ...p, disponible_campamento: Boolean(v) }))} />
          <Label htmlFor="disp">Disponible para tareas en campamento</Label>
        </div>

        <div>
          <Label className="text-[10px]">Herramientas / medios perdidos</Label>
          {soloLectura ? (
            <p className="text-sm">{form.herramientas_perdidas || "—"}</p>
          ) : (
            <Textarea value={form.herramientas_perdidas ?? ""} onChange={(e) => setForm((p) => ({ ...p, herramientas_perdidas: e.target.value }))}
              rows={2} className="mt-1 text-xs" />
          )}
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
  );
}
