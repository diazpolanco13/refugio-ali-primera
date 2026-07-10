import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  accion?: ReactNode;
  className?: string;
}

/** Estado vacío presentacional (sin datos). */
export function EstadoVacio({
  titulo,
  descripcion,
  icono,
  accion,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-full min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icono ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        {descripcion && (
          <p className="text-xs text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {accion}
    </div>
  );
}
