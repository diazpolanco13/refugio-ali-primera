// Diálogo de felicitación al completar las 6 fases del reporte diario.

import { CircleCheck } from "lucide-react";
import { BotonCopiarReporteTelegram } from "./BotonCopiarReporteTelegram";
import { formatearDiaVisorReporte } from "./VisorFechaReporte";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  centro: CentroTransitorio;
  dia: string;
  onCerrar: () => void;
}

export function DialogReporteCompleto({
  abierto,
  onAbiertoChange,
  centro,
  dia,
  onCerrar,
}: Props) {
  const fechaLegible = formatearDiaVisorReporte(dia);

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        overlayClassName="bg-black/60"
        className="inset-x-auto top-1/2 right-auto bottom-auto left-1/2 max-h-[min(90dvh,32rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-0 overflow-y-auto rounded-2xl border border-emerald-500/30 p-5 shadow-xl data-[state=closed]:slide-out-to-bottom-0 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-bottom-0 data-[state=open]:zoom-in-95 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90vh] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl"
      >
        <DialogHeader className="items-center border-0 p-0 text-center sm:items-center sm:pr-0 sm:text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
            <CircleCheck className="size-8 text-emerald-400" aria-hidden />
          </div>
          <DialogTitle className="text-balance text-lg leading-snug">
            Su reporte del día {fechaLegible} está completo
          </DialogTitle>
          <DialogDescription className="mt-2 text-pretty text-sm leading-relaxed">
            ¡Muchas gracias!
            <br />
            Este reporte puede ser actualizado nuevamente por usted si ocurre
            algún cambio.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 flex flex-col gap-2">
          <BotonCopiarReporteTelegram
            centro={centro}
            dia={dia}
            className="h-10 w-full justify-center"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => {
              onAbiertoChange(false);
              onCerrar();
            }}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
