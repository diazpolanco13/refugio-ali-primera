import { cn } from "@/lib/utils";

interface Props {
  icono: string;
  logo: string | null;
  color: string;
  seleccionado: boolean;
  /** Color del semáforo de ocupación (punto de estado). null = no mostrar. */
  semaforoColor?: string | null;
  onClick: () => void;
}

/**
 * Marcador HTML circular: logo/escudo del cuerpo sobre fondo blanco, con anillo
 * de color por cuerpo y un punto de estado (semáforo de ocupación) en la esquina.
 */
export function MarcadorCentro({ icono, logo, color, seleccionado, semaforoColor, onClick }: Props) {
  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
    >
      <div
        className={cn(
          "flex size-8 items-center justify-center overflow-hidden rounded-full border-2 bg-white shadow-lg transition-transform",
          seleccionado && "scale-125 ring-2 ring-white",
        )}
        style={{ borderColor: color }}
      >
        {logo ? (
          <img src={logo} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <span className="text-base leading-none">{icono}</span>
        )}
      </div>
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
