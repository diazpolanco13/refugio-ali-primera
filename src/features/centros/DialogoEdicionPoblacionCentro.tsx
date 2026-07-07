import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { normalizarCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import type { Vulnerables } from "@/domain/tipos";
import { DesgloseDemografico } from "@/features/censo/DesgloseDemografico";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { cn } from "@/lib/utils";

export interface DatosPoblacionCentro {
  total_afectados: number;
  familias_ocupadas: number;
  censo_en_proceso: boolean;
  ocupacion: Vulnerables;
}

interface Props {
  abierto: boolean;
  centro: CentroTransitorio;
  guardando?: boolean;
  error?: string | null;
  onCerrar: () => void;
  onGuardar: (datos: DatosPoblacionCentro) => void;
}

function datosDesdeCentro(centro: CentroTransitorio): DatosPoblacionCentro {
  const c = normalizarCentro(centro);
  return {
    total_afectados: c.total_afectados,
    familias_ocupadas: c.familias_ocupadas,
    censo_en_proceso: c.censo_en_proceso,
    ocupacion: { ...c.ocupacion },
  };
}

/** Diálogo flotante para editar población afectada y desglose demográfico. */
export function DialogoEdicionPoblacionCentro({
  abierto,
  centro,
  guardando = false,
  error = null,
  onCerrar,
  onGuardar,
}: Props) {
  const [datos, setDatos] = useState<DatosPoblacionCentro>(() => datosDesdeCentro(centro));

  useEffect(() => {
    if (!abierto) return;
    setDatos(datosDesdeCentro(centro));
  }, [abierto, centro]);

  function patch(partial: Partial<DatosPoblacionCentro>) {
    setDatos((prev) => ({ ...prev, ...partial }));
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="text-base">Editar población</DialogTitle>
          <DialogDescription className="text-xs">
            Población afectada y desglose demográfico del campamento.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,32rem)] space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          <section className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Población afectada</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Damnificados</Label>
                <NumInput
                  className="mt-1"
                  value={datos.total_afectados}
                  onChange={(n) => patch({ total_afectados: n })}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Familias</Label>
                <NumInput
                  className="mt-1"
                  value={datos.familias_ocupadas}
                  onChange={(n) => patch({ familias_ocupadas: n })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-amber-500"
                checked={datos.censo_en_proceso}
                onChange={(e) => patch({ censo_en_proceso: e.target.checked })}
              />
              Censo demográfico en proceso (desglose pendiente)
            </label>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Desglose demográfico</p>
            <p className="text-[11px] text-muted-foreground">
              Por edad y sexo. Completa cuando el censo avance.
            </p>
            <div className={cn(datos.censo_en_proceso && "opacity-90")}>
              <DesgloseDemografico
                vulnerables={datos.ocupacion}
                onCampo={(campo, valor) =>
                  patch({ ocupacion: { ...datos.ocupacion, [campo]: valor } })
                }
              />
            </div>
          </section>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-row gap-2 border-t border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" size="sm" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-teal-600 hover:bg-teal-500"
            disabled={guardando}
            onClick={() => onGuardar(datos)}
          >
            {guardando ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
