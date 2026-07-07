import { CheckCircle2, ShieldCheck } from "lucide-react";
import {
  CAMPOS_CONTROL_REPORTE,
  type ReporteControlDia,
} from "@/domain/controlReporte";
import { SelectorRespuesta } from "@/features/centros/LevantamientoCentro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  control: Omit<ReporteControlDia, "id">;
  heredadoDeAyer: boolean;
  onChange: (patch: Partial<Omit<ReporteControlDia, "id">>) => void;
  onConfirmarRevision: () => void;
  deshabilitado?: boolean;
  guardando?: boolean;
}

export function ControlReporteTab({
  control,
  heredadoDeAyer,
  onChange,
  onConfirmarRevision,
  deshabilitado,
  guardando,
}: Props) {
  return (
    <div className="space-y-4">
      {heredadoDeAyer && !control.revisado && (
        <div className="rounded-lg border border-sky-500/35 bg-sky-500/5 px-3 py-2.5 text-xs text-muted-foreground">
          Valores heredados de ayer — confirma o actualiza antes de cerrar el bloque.
        </div>
      )}

      <div
        className={cn(
          "rounded-lg border px-3 py-3",
          control.revisado
            ? "border-emerald-500/35 bg-emerald-500/5"
            : "border-sky-500/35 bg-sky-500/5",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-sky-400" />
            Control operativo
          </p>
          <Badge variant="outline" className="text-[10px]">
            {control.revisado ? "Revisado" : "Pendiente"}
          </Badge>
        </div>
      </div>

      {CAMPOS_CONTROL_REPORTE.map(({ clave, nota, label }) => (
        <Card key={clave} size="sm" className="border-border/80 py-0">
          <CardContent className="space-y-2 px-3 py-3">
            <Label className="text-xs font-medium">{label}</Label>
            <SelectorRespuesta
              valor={control[clave]}
              onChange={(v) => onChange({ [clave]: v })}
              deshabilitado={deshabilitado}
            />
            <Textarea
              className="min-h-[3rem] text-xs"
              rows={2}
              placeholder="Nota (opcional)"
              value={control[nota]}
              disabled={deshabilitado}
              onChange={(e) => onChange({ [nota]: e.target.value })}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={deshabilitado || guardando}
          onClick={onConfirmarRevision}
        >
          <CheckCircle2 className="size-4" />
          Confirmar revisión del bloque
        </Button>
      </div>
    </div>
  );
}
