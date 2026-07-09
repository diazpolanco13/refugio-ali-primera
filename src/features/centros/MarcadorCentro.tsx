import { LogoCuerpo } from "@/components/LogoCuerpo";
import { COLOR_MARCADOR_ATENUADO } from "@/domain/unidadesSebin";
import { cn } from "@/lib/utils";

export type ModoMarcadorCentro = "logo" | "color";

interface Props {
  modo: ModoMarcadorCentro;
  /** Número de campamento (índice operativo). */
  nro: number;
  icono: string;
  logo: string | null;
  color: string;
  seleccionado: boolean;
  /** Si false, el marcador se muestra gris (filtro por otra dirección). */
  resaltado?: boolean;
  /**
   * Cuando hay un filtro de dirección activo y este marcador está resaltado,
   * el núcleo muestra "?" en lugar del N.°.
   */
  simboloFiltro?: boolean;
  mostrarParte: boolean;
  /** Damnificados alojados. */
  refugiados?: number;
  /** Personal operativo total desplegado en el centro. */
  personalTotal?: number;
  /** Color del semáforo de ocupación. null = no mostrar. */
  semaforoColor?: string | null;
  onClick: () => void;
}

function fmtCompacto(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("es");
}

function ParteNumerico({
  refugiados,
  compacto = false,
}: {
  refugiados: number;
  compacto?: boolean;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap font-bold tabular-nums leading-none text-white",
        compacto ? "text-[10px]" : "text-[11px]",
      )}
    >
      {fmtCompacto(refugiados)}
    </span>
  );
}

function SemaforoEstado({ color }: { color: string }) {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white shadow"
      style={{ background: color }}
      aria-hidden
    />
  );
}

/** Núcleo circular con el N.° del campamento (o "?" si hay filtro activo). */
function NucleoNumero({
  nro,
  color,
  resaltado,
  seleccionado,
  simboloFiltro = false,
}: {
  nro: number;
  color: string;
  resaltado: boolean;
  seleccionado: boolean;
  simboloFiltro?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 shadow-md",
        resaltado && "marcador-latido-nucleo",
        seleccionado && resaltado && "ring-2 ring-white/90",
      )}
      style={{ backgroundColor: color }}
    >
      <span
        className={cn(
          "font-bold leading-none text-white",
          simboloFiltro ? "text-[11px]" : "text-[9px] tabular-nums",
        )}
      >
        {simboloFiltro ? "?" : nro}
      </span>
    </span>
  );
}

/** Marcador HTML del campamento: logo SEBIN o punto de color con latido. */
export function MarcadorCentro({
  modo,
  nro,
  icono,
  logo,
  color,
  seleccionado,
  resaltado = true,
  simboloFiltro = false,
  mostrarParte,
  refugiados = 0,
  personalTotal = 0,
  semaforoColor,
  onClick,
}: Props) {
  const colorMarcador = resaltado ? color : COLOR_MARCADOR_ATENUADO;
  const mostrarSimbolo = simboloFiltro && resaltado;
  const titulo =
    `N.° ${nro} · ${refugiados.toLocaleString("es")} damnificados · ${personalTotal.toLocaleString("es")} personal operativo`;

  function manejarClick(ev: React.MouseEvent) {
    ev.stopPropagation();
    onClick();
  }

  if (modo === "color") {
    return (
      <div
        className={cn(
          "relative cursor-pointer select-none transition-all duration-300",
          seleccionado && resaltado && "scale-125",
          !resaltado && "scale-90 opacity-25",
        )}
        title={titulo}
        onClick={manejarClick}
      >
        <div className="relative flex flex-col items-center">
          <div className="relative flex size-6 items-center justify-center">
            {resaltado && (
              <span
                className="marcador-latido-aura absolute size-6 rounded-full"
                style={{ backgroundColor: colorMarcador }}
                aria-hidden
              />
            )}
            <NucleoNumero
              nro={nro}
              color={colorMarcador}
              resaltado={resaltado}
              seleccionado={seleccionado}
              simboloFiltro={mostrarSimbolo}
            />
          </div>
          {mostrarParte && resaltado && (
            <span className="mt-1 rounded-md bg-background/90 px-1.5 py-0.5 shadow-md backdrop-blur-sm">
              <ParteNumerico refugiados={refugiados} compacto />
            </span>
          )}
        </div>
        {semaforoColor && resaltado && (
          <span className="absolute -bottom-0.5 -right-0.5">
            <SemaforoEstado color={semaforoColor} />
          </span>
        )}
      </div>
    );
  }

  const iconoCuerpo = (
    <span className="relative flex size-7 shrink-0 items-center justify-center">
      <span
        className="flex size-7 items-center justify-center overflow-hidden rounded-full border-2 bg-white"
        style={{ borderColor: colorMarcador }}
      >
        {logo ? (
          <LogoCuerpo src={logo} priority="high" />
        ) : (
          <span className="text-sm leading-none">{icono}</span>
        )}
      </span>
      <span
        className="absolute -bottom-1 left-1/2 flex h-3.5 min-w-3.5 -translate-x-1/2 items-center justify-center rounded-full border border-white px-0.5 shadow"
        style={{ backgroundColor: colorMarcador }}
        aria-hidden
      >
        <span
          className={cn(
            "font-bold leading-none text-white",
            mostrarSimbolo ? "text-[9px]" : "text-[8px] tabular-nums",
          )}
        >
          {mostrarSimbolo ? "?" : nro}
        </span>
      </span>
    </span>
  );

  if (!mostrarParte) {
    return (
      <div
        className={cn(
          "relative cursor-pointer select-none transition-all duration-300",
          seleccionado && resaltado && "scale-110",
          !resaltado && "scale-90 opacity-25 grayscale",
        )}
        title={titulo}
        onClick={manejarClick}
      >
        <div
          className={cn(
            "rounded-full border-2 bg-background/95 p-0.5 pb-1.5 shadow-lg",
            seleccionado && resaltado && "ring-2 ring-white/90",
          )}
          style={{ borderColor: colorMarcador }}
        >
          {iconoCuerpo}
        </div>
        {semaforoColor && resaltado && <SemaforoEstado color={semaforoColor} />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative cursor-pointer select-none transition-all duration-300",
        seleccionado && resaltado && "scale-110",
        !resaltado && "scale-90 opacity-25 grayscale",
      )}
      title={titulo}
      onClick={manejarClick}
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-full border-2 bg-background/95 py-0.5 pl-0.5 pr-2 pb-1.5 shadow-lg",
          seleccionado && resaltado && "ring-2 ring-white/90",
        )}
        style={{ borderColor: colorMarcador }}
      >
        {iconoCuerpo}
        {resaltado && <ParteNumerico refugiados={refugiados} />}
      </div>
      {semaforoColor && resaltado && <SemaforoEstado color={semaforoColor} />}
    </div>
  );
}
