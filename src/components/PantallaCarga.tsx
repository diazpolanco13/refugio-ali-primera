import { Loader2, Tent } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  mensaje?: string;
  className?: string;
}

/** Pantalla de arranque / carga (mismo estilo que el login). */
export function PantallaCarga({ mensaje = "Cargando…", className }: Props) {
  return (
    <div
      className={cn(
        "flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-foreground",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Tent className="size-7" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-semibold">Sala Situacional</h1>
        <p className="mt-1 text-sm text-muted-foreground">Refugio Parque del Oeste</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {mensaje}
      </div>
    </div>
  );
}
