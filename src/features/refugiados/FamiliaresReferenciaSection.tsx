// Familiares de referencia y separados (jsonb en familias_centro).

import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import {
  resumenFamiliaVulnerable,
  type FamiliarReferencia,
  type FamiliarSeparado,
} from "@/domain/refugiados";
import { guardarFamiliaresReferencia } from "@/data/reposRefugiados";
import { nuevoId } from "@/data/reposSupabase";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  detalle: DetalleAlojamiento;
  puedeEditar: boolean;
}

export function FamiliaresReferenciaSection({ detalle, puedeEditar }: Props) {
  const familia = detalle.familia;
  const [referencia, setReferencia] = useState<FamiliarReferencia[]>(
    familia?.familiares_referencia ?? [],
  );
  const [separados, setSeparados] = useState<FamiliarSeparado[]>(
    familia?.familiares_separados ?? [],
  );
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setReferencia(familia?.familiares_referencia ?? []);
    setSeparados(familia?.familiares_separados ?? []);
  }, [familia?.id, familia?.familiares_referencia, familia?.familiares_separados]);

  if (!familia) {
    return (
      <p className="text-sm text-muted-foreground">
        Asigna un hogar para registrar contactos familiares de referencia.
      </p>
    );
  }

  const resumen = resumenFamiliaVulnerable(detalle.miembrosFamilia, referencia);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarFamiliaresReferencia(familia!.id, referencia, separados);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{resumen.menores5} menores &lt;5</Badge>
        <Badge variant="secondary">{resumen.adultosMayores} adultos mayores</Badge>
        <Badge variant="secondary">{resumen.discapacidad} casos urgentes</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4" />
            Familiares fuera del refugio / contactos de referencia
          </CardTitle>
          <CardDescription className="text-xs">
            Personas relacionadas que no están alojadas en este centro. Úsalo solo para contacto o trazabilidad, no como miembros del hogar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {referencia.map((f, i) => (
            <div key={f.id} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo label="Nombres" value={f.nombres} disabled={!puedeEditar}
                  onChange={(v) => setReferencia((prev) => prev.map((x, j) => j === i ? { ...x, nombres: v } : x))} />
                <Campo label="Parentesco" value={f.parentesco} disabled={!puedeEditar}
                  onChange={(v) => setReferencia((prev) => prev.map((x, j) => j === i ? { ...x, parentesco: v } : x))} />
                <Campo label="Ubicación" value={f.ubicacion ?? ""} disabled={!puedeEditar}
                  onChange={(v) => setReferencia((prev) => prev.map((x, j) => j === i ? { ...x, ubicacion: v } : x))} />
                <Campo label="Contacto" value={f.contacto ?? ""} disabled={!puedeEditar}
                  onChange={(v) => setReferencia((prev) => prev.map((x, j) => j === i ? { ...x, contacto: v } : x))} />
              </div>
              {puedeEditar && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-rose-400"
                  onClick={() => setReferencia((prev) => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" /> Quitar
                </Button>
              )}
            </div>
          ))}
          {puedeEditar && (
            <Button type="button" variant="outline" size="sm" className="gap-1"
              onClick={() => setReferencia((prev) => [...prev, { id: nuevoId(), nombres: "", parentesco: "" }])}>
              <Plus className="size-3.5" /> Agregar referencia
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Separados / desaparecidos</CardTitle>
          <CardDescription className="text-xs">
            Casos de reunificación familiar o contacto perdido fuera del hogar actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {separados.map((f, i) => (
            <div key={f.id} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo label="Nombre" value={f.nombre} disabled={!puedeEditar}
                  onChange={(v) => setSeparados((prev) => prev.map((x, j) => j === i ? { ...x, nombre: v } : x))} />
                <Campo label="Parentesco" value={f.parentesco} disabled={!puedeEditar}
                  onChange={(v) => setSeparados((prev) => prev.map((x, j) => j === i ? { ...x, parentesco: v } : x))} />
                {puedeEditar ? (
                  <div>
                    <Label className="text-[10px]">Estado</Label>
                    <Select value={f.estado} onValueChange={(v) =>
                      setSeparados((prev) => prev.map((x, j) => j === i ? { ...x, estado: v as FamiliarSeparado["estado"] } : x))}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="separado">Separado</SelectItem>
                        <SelectItem value="desaparecido">Desaparecido</SelectItem>
                        <SelectItem value="contacto_perdido">Contacto perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <Campo label="Estado" value={f.estado} disabled />
                )}
                <Campo label="Última ubicación" value={f.ultima_ubicacion ?? ""} disabled={!puedeEditar}
                  onChange={(v) => setSeparados((prev) => prev.map((x, j) => j === i ? { ...x, ultima_ubicacion: v } : x))} />
              </div>
              {puedeEditar && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-rose-400"
                  onClick={() => setSeparados((prev) => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" /> Quitar
                </Button>
              )}
            </div>
          ))}
          {puedeEditar && (
            <Button type="button" variant="outline" size="sm" className="gap-1"
              onClick={() => setSeparados((prev) => [...prev, { id: nuevoId(), nombre: "", parentesco: "", estado: "separado" }])}>
              <Plus className="size-3.5" /> Agregar separado
            </Button>
          )}
        </CardContent>
      </Card>

      {puedeEditar && (
        <Button type="button" disabled={guardando} onClick={() => void guardar()}>
          {guardando ? "Guardando…" : "Guardar familiares de referencia"}
        </Button>
      )}
    </div>
  );
}

function Campo({
  label, value, disabled, onChange,
}: { label: string; value: string; disabled?: boolean; onChange?: (v: string) => void }) {
  if (disabled || !onChange) {
    return (
      <div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <p className="text-sm">{value || "—"}</p>
      </div>
    );
  }
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9" />
    </div>
  );
}
