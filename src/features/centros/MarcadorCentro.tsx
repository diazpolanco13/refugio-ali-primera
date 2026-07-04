import { cn } from "@/lib/utils";

interface Props {
  icono: string;
  logo: string | null;
  color: string;
  seleccionado: boolean;
  /** Refugiados alojados. */
  refugiados?: number;
  /** Personal operativo total desplegado en el centro (funcionarios + médicos + psicólogos + justicia). */
  personalTotal?: number;
  /** Color del semáforo de ocupación (punto de estado). null = no mostrar. */
  semaforoColor?: string | null;
  onClick: () => void;
}

function fmtCompacto(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("es");
}

/**
 * Marcador HTML: píldora horizontal con logo del cuerpo + refugiados / personal_total,
 * o solo el círculo del cuerpo si no hay datos de población ni personal.
 */
export function MarcadorCentro({
  icono,
  logo,
  color,
  seleccionado,
  refugiados = 0,
  personalTotal = 0,
  semaforoColor,
  onClick,
}: Props) {
  const conContador = refugiados > 0 || personalTotal > 0;

  const iconoCuerpo = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white",
        conContador ? "size-7" : "size-8",
      )}
      style={{ borderColor: color }}
    >
      {logo ? (
        <img src={logo} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <span className={cn("leading-none", conContador ? "text-sm" : "text-base")}>{icono}</span>
      )}
    </span>
  );

  const titulo =
    conContador &&
    `${refugiados.toLocaleString("es")} refugiados · ${personalTotal.toLocaleString("es")} personal operativo`;

  return (
    <div
      className={cn(
        "relative cursor-pointer select-none transition-transform",
        seleccionado && "scale-110",
      )}
      title={titulo || undefined}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
    >
      {conContador ? (
        <div
          className={cn(
            "flex items-center gap-1 rounded-full border-2 bg-slate-950/95 py-0.5 pl-0.5 pr-2 shadow-lg",
            seleccionado && "ring-2 ring-white/90",
          )}
          style={{ borderColor: color }}
        >
          {iconoCuerpo}
          <span className="whitespace-nowrap text-[11px] font-bold tabular-nums leading-none text-white">
            {fmtCompacto(refugiados)}
            <span className="mx-0.5 font-normal text-white/55">/</span>
            {fmtCompacto(personalTotal)}
          </span>
        </div>
      ) : (
        <div className={cn("rounded-full shadow-lg", seleccionado && "ring-2 ring-white")}>
          {iconoCuerpo}
        </div>
      )}

      {semaforoColor && (
        <span
          className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white shadow"
          style={{ background: semaforoColor }}
          aria-hidden
        />
      )}
    </div>
  );
}
