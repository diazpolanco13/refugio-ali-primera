import { cn } from "@/lib/utils";
import { diasAbierto } from "@/domain/antiguedadSeguimiento";

interface Props {
  reportadoDia: string;
  resueltaTs?: number | null;
  creadaTs?: number;
  className?: string;
}

/** "2026-07-08" → "08/07". */
function fechaCorta(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** Clave YYYY-MM-DD del día real (no del día seleccionado en el visor). */
function claveHoyReal(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Badge reutilizable: fecha de registro + días desde ese registro (día 1 =
 * día en que se abrió). La antigüedad siempre se calcula contra el día real
 * de hoy, no contra el día que se esté viendo en el visor del reporte.
 */
export function BadgeAntiguedad({ reportadoDia, resueltaTs, creadaTs, className }: Props) {
  const abierto = diasAbierto(reportadoDia, claveHoyReal());
  const fecha = reportadoDia ? fechaCorta(reportadoDia) : "";
  const label =
    resueltaTs && creadaTs
      ? `${fecha} · cerrado en ${Math.max(1, Math.ceil((resueltaTs - creadaTs) / 86_400_000))} d`
      : fecha
        ? `${fecha} · ${abierto} ${abierto === 1 ? "día" : "días"}`
        : `${abierto} ${abierto === 1 ? "día" : "días"}`;

  return (
    <span
      title={reportadoDia ? `Registrado el ${reportadoDia}` : undefined}
      className={cn(
        "inline-flex shrink-0 rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
