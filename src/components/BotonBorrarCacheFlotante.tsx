import { TooltipProvider } from "@/components/ui/tooltip";
import { BotonBorrarCache } from "./BotonBorrarCache";

/**
 * FAB esquina inferior derecha. En móvil + mapa el padre no lo monta:
 * ahí el botón va en `ControlesMapaCentros`.
 */
export function BotonBorrarCacheFlotante() {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="pointer-events-none fixed bottom-0 end-0 z-[9990] p-3 pe-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        role="presentation"
      >
        <BotonBorrarCache variante="flotante" />
      </div>
    </TooltipProvider>
  );
}
