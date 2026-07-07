import { cn } from "@/lib/utils";
import { diasAbierto } from "@/domain/antiguedadSeguimiento";

interface Props {
  reportadoDia: string;
  hoyClave: string;
  resueltaTs?: number | null;
  creadaTs?: number;
  className?: string;
}

/** Badge reutilizable: días abierto o días hasta cierre. */
export function BadgeAntiguedad({
  reportadoDia,
  hoyClave,
  resueltaTs,
  creadaTs,
  className,
}: Props) {
  const abierto = diasAbierto(reportadoDia, hoyClave);
  const label =
    resueltaTs && creadaTs
      ? `${Math.max(1, Math.ceil((resueltaTs - creadaTs) / 86_400_000))} d cerrado`
      : abierto === 0
        ? "Hoy"
        : abierto === 1
          ? "1 día"
          : `${abierto} días`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
