import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PanelFlotanteProps {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  className?: string;
}

/** Panel lateral flotante con estilo shadcn (tablero, usuarios, etc.). */
export function PanelFlotante({
  titulo,
  descripcion,
  icono,
  onCerrar,
  children,
  className,
}: PanelFlotanteProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden border-border bg-card shadow-xl",
        "md:inset-y-auto md:left-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[min(100%,24rem)] md:rounded-xl md:border md:bg-background/95 md:backdrop-blur",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icono}
            <span className="truncate">{titulo}</span>
          </div>
          {descripcion && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{descripcion}</p>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onCerrar} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
