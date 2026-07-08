import { ShieldCheck } from "lucide-react";
import {
  CAMPOS_CONTROL_REPORTE,
  type ReporteControlDia,
} from "@/domain/controlReporte";
import { SelectorRespuesta } from "@/features/centros/LevantamientoCentro";
import { BloqueConfirmacionReporte } from "@/features/centros/BloqueConfirmacionReporte";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  control: Omit<ReporteControlDia, "id">;
  heredadoDeAyer: boolean;
  revisado: boolean;
  modificado: boolean;
  onChange: (patch: Partial<Omit<ReporteControlDia, "id">>) => void;
  onConfirmarRevision: () => void;
  onDesmarcarRevision?: () => void;
  deshabilitado?: boolean;
  guardando?: boolean;
}

export function ControlReporteTab({
  control,
  heredadoDeAyer,
  revisado,
  modificado,
  onChange,
  onConfirmarRevision,
  onDesmarcarRevision,
  deshabilitado,
  guardando,
}: Props) {
  return (
    <div className="space-y-4">
      <BloqueConfirmacionReporte
        titulo="Control operativo"
        tituloRevisado="Control revisado hoy"
        descripcion="Captahuella, juez de paz, servicio médico y ambulancia del día."
        icono={ShieldCheck}
        acento="sky"
        revisado={revisado}
        modificado={modificado}
        guardando={guardando}
        deshabilitado={deshabilitado}
        onConfirmar={onConfirmarRevision}
        onDesmarcar={onDesmarcarRevision}
        etiquetaGuardar="Guardar control"
        etiquetaConfirmar="Confirmar sin cambios"
        etiquetaActualizar="Actualizar control"
      />

      {heredadoDeAyer && !revisado && (
        <div className="rounded-lg border border-sky-500/35 bg-sky-500/5 px-3 py-2.5 text-xs text-muted-foreground">
          Valores heredados de ayer — confirma o actualiza antes de cerrar el bloque.
        </div>
      )}

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
    </div>
  );
}
