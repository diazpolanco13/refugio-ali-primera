// Pestaña Salud y bienestar.

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { actualizarSalud } from "@/data/reposRefugiados";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import type { SaludRefugiado } from "@/domain/refugiados";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  detalle: DetalleAlojamiento;
  puedeEditar: boolean;
  puedeVerSaludMental: boolean;
}

export function SaludBienestarSection({ detalle, puedeEditar, puedeVerSaludMental }: Props) {
  const s = detalle.refugiado.salud;
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<SaludRefugiado>({ ...s });

  function set<K extends keyof SaludRefugiado>(k: K, v: SaludRefugiado[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      const payload = { ...form };
      if (!puedeVerSaludMental) delete payload.salud_mental;
      await actualizarSalud(detalle.refugiado.id, payload);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  const soloLectura = !puedeEditar || !editando;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Heart className="size-4 text-rose-400" />
            Salud y bienestar
          </CardTitle>
          <CardDescription className="text-xs">Condiciones médicas y necesidades urgentes</CardDescription>
        </div>
        {puedeEditar && !editando && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setForm({ ...s }); setEditando(true); }}>
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <CampoArea label="Lesiones actuales" value={form.lesiones ?? ""} disabled={soloLectura}
          onChange={(v) => set("lesiones", v)} />
        <CampoArea label="Condiciones crónicas" value={form.condiciones_cronicas ?? ""} disabled={soloLectura}
          onChange={(v) => set("condiciones_cronicas", v)} />
        <CampoArea label="Medicamentos perdidos" value={form.medicamentos_perdidos ?? ""} disabled={soloLectura}
          onChange={(v) => set("medicamentos_perdidos", v)} urgent={form.medicamentos_urgente} />
        {!soloLectura && (
          <div className="flex items-center gap-2">
            <Checkbox id="med-urg" checked={Boolean(form.medicamentos_urgente)}
              onCheckedChange={(v) => set("medicamentos_urgente", Boolean(v))} />
            <Label htmlFor="med-urg" className="text-xs text-rose-400">Medicamentos — urgente</Label>
          </div>
        )}
        <CampoArea label="Discapacidad / ayudas técnicas" value={form.discapacidad_ayudas ?? ""} disabled={soloLectura}
          onChange={(v) => set("discapacidad_ayudas", v)} />
        {puedeVerSaludMental && (
          <CampoArea label="Salud mental / psicosocial" value={form.salud_mental ?? ""} disabled={soloLectura}
            onChange={(v) => set("salud_mental", v)} />
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {!soloLectura ? (
            <div>
              <Label className="text-[10px]">Embarazo (semanas)</Label>
              <Input type="number" min={0} value={form.embarazo_semanas ?? ""}
                onChange={(e) => set("embarazo_semanas", e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-9" />
            </div>
          ) : form.embarazo_semanas != null ? (
            <p className="text-sm">Embarazo: {form.embarazo_semanas} sem.</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox id="lac" checked={Boolean(form.lactancia)} disabled={soloLectura}
              onCheckedChange={(v) => set("lactancia", Boolean(v))} />
            <Label htmlFor="lac">Lactancia</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pue" checked={Boolean(form.puerperio)} disabled={soloLectura}
              onCheckedChange={(v) => set("puerperio", Boolean(v))} />
            <Label htmlFor="pue">Puerperio</Label>
          </div>
        </div>
        {editando && (
          <div className="flex gap-2 pt-2">
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

function CampoArea({
  label, value, disabled, onChange, urgent,
}: {
  label: string; value: string; disabled?: boolean; onChange?: (v: string) => void; urgent?: boolean;
}) {
  if (disabled) {
    if (!value) return null;
    return (
      <div>
        <span className={`text-[10px] ${urgent ? "text-rose-400" : "text-muted-foreground"}`}>{label}</span>
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      </div>
    );
  }
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange?.(e.target.value)} rows={2} className="mt-1 text-xs" />
    </div>
  );
}
