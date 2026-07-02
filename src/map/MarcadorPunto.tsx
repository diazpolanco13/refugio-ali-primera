import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  icono: string;
  color: string;
  ringColor: string;
  numero: string;
  titulo: string;
  detalle: string;
  limpieza: string;
  fueraServicio: boolean;
  compacto: boolean;
  cursor: "pointer" | "move";
  onClick: () => void;
}

export function MarcadorPunto({
  icono,
  color,
  ringColor,
  numero,
  titulo,
  detalle,
  limpieza,
  fueraServicio,
  compacto,
  cursor,
  onClick,
}: Props) {
  const mostrarNumero = !compacto && numero.length > 0;

  return (
    <div
      className={cn(
        "group/mk relative select-none",
        cursor === "move" ? "cursor-move" : "cursor-pointer",
        fueraServicio && "opacity-60",
      )}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
    >
      <Badge
        variant="outline"
        className={cn(
          "h-auto gap-1 rounded-xl border-2 bg-card/95 px-1 py-0.5 shadow-lg backdrop-blur-sm",
          "transition-[padding,gap] duration-150",
          compacto ? "px-0.5 py-0.5" : "pr-1.5",
        )}
        style={{ borderColor: color }}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg leading-none",
            compacto ? "size-5 text-sm" : "size-6 text-base",
          )}
          style={{
            background: `${color}33`,
            boxShadow: `inset 0 0 0 2px ${ringColor}`,
          }}
          aria-hidden
        >
          {icono}
        </span>
        {mostrarNumero && (
          <span className="mk-num tabular-nums text-[11px] font-bold text-foreground">
            {numero}
          </span>
        )}
      </Badge>

      {!compacto && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2",
            "rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-xl",
            "whitespace-nowrap opacity-0 transition-opacity group-hover/mk:opacity-100",
            "max-sm:hidden",
          )}
        >
          <p className="font-semibold text-foreground">{titulo}</p>
          {detalle && <p className="text-muted-foreground">{detalle}</p>}
          {limpieza && <p className="text-muted-foreground">{limpieza}</p>}
        </div>
      )}
    </div>
  );
}
