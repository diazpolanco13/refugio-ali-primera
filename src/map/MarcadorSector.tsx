import { PreviewSectorDatos } from "./PreviewSectorDatos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Sector } from "@/domain/tipos";

interface Props {
  sector: Pick<
    Sector,
    "nombre" | "carpas" | "familias" | "poblacion_estimada" | "vulnerables"
  >;
  colorSector: string;
}

export function MarcadorSector({ sector, colorSector }: Props) {
  function elevarMarcador(el: HTMLElement, elevar: boolean) {
    const mk = el.closest(".maplibregl-marker") as HTMLElement | null;
    if (!mk) return;
    if (elevar) {
      mk.classList.add("sector-mk-elevado");
      mk.style.zIndex = "9998";
    } else {
      mk.classList.remove("sector-mk-elevado");
      mk.style.zIndex = "";
    }
  }

  return (
    <div
      className="group/sector pointer-events-auto relative"
      onMouseEnter={(e) => elevarMarcador(e.currentTarget, true)}
      onMouseLeave={(e) => elevarMarcador(e.currentTarget, false)}
    >
      <Badge
        variant="outline"
        className={cn(
          "h-auto gap-1.5 rounded-lg border bg-card/80 px-2 py-0.5",
          "text-[11px] font-semibold text-foreground shadow-md backdrop-blur-sm",
        )}
        style={{ borderColor: colorSector, background: `${colorSector}22` }}
      >
        <span
          className="inline-block size-2 shrink-0 rounded-full ring-1 ring-background"
          style={{ background: colorSector }}
          aria-hidden
        />
        {sector.nombre}
      </Badge>

      <div
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-[10001] mb-1.5 w-max max-w-[240px] -translate-x-1/2",
          "rounded-xl border border-border bg-popover p-2.5 text-popover-foreground shadow-xl",
          "opacity-0 transition-opacity group-hover/sector:opacity-100",
          "max-sm:hidden",
        )}
      >
        <PreviewSectorDatos sector={sector} color={colorSector} />
      </div>
    </div>
  );
}
