import { cn } from "@/lib/utils";

/** Select visible en formularios del reporte diario (fondo y borde contrastados). */
export const claseSelectReporte = cn(
  "mt-1 h-10 w-full",
  "border-border bg-card text-foreground shadow-sm",
  "ring-1 ring-border/60",
  "hover:bg-muted/30 hover:ring-border",
  "data-[state=open]:border-teal-500/50 data-[state=open]:ring-teal-500/30",
  "[&_[data-slot=select-value]]:text-foreground",
  "[&_svg]:size-4 [&_svg]:opacity-70",
);
