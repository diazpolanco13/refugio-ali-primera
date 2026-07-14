import type { ReactNode } from "react";
import { Box, Layers2, Map as MapIcon, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import {
  BASE_MAPA_CARTO,
  BASE_MAPA_SATELITE,
  type BaseMapa,
} from "@/map/estiloMapa";
import type { ReglaEscala } from "@/map/escalaVista";
import { cn } from "@/lib/utils";

interface Props {
  baseMapa: BaseMapa;
  modo3d: boolean;
  onCambiarBase: (base: BaseMapa) => void;
  onCambiarModo3d: (activo: boolean) => void;
  /** Ancho de barra + etiqueta de la regla de escala (cambia con el zoom). */
  reglaEscala?: ReglaEscala;
  className?: string;
}

/**
 * Selectores estilo HUD (Osiris): 2D/3D sobre Dark Matter + MAP/SAT (híbrido),
 * con la regla de escala debajo (mismo lugar que en Osiris).
 */
export function SelectoresVistaMapa({
  baseMapa,
  modo3d,
  onCambiarBase,
  onCambiarModo3d,
  reglaEscala,
  className,
}: Props) {
  const enCarto = baseMapa === BASE_MAPA_CARTO;
  const enSatelite = baseMapa === BASE_MAPA_SATELITE;
  // Preferencia 2D/3D de Carto (se conserva al ir a SAT y volver a MAP).
  const tresDActivo = modo3d;
  const dosDActivo = !modo3d;

  function irA2d() {
    onCambiarModo3d(false);
  }

  function irA3d() {
    onCambiarModo3d(true);
    if (!enCarto) onCambiarBase(BASE_MAPA_CARTO);
  }

  function irAMap() {
    onCambiarBase(BASE_MAPA_CARTO);
  }

  function irASat() {
    // No tocar modo3d: al volver a MAP se restaura 2D/3D previo.
    onCambiarBase(BASE_MAPA_SATELITE);
  }

  return (
    <div
      className={cn(
        "map-controls-overlay pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 top-3 bottom-auto md:top-auto md:bottom-10",
        className,
      )}
    >
      <div
        className="flex items-center gap-1.5"
        role="toolbar"
        aria-label="Vista del mapa"
      >
        <ButtonGroup
          orientation="horizontal"
          className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-card/90 shadow-lg backdrop-blur-xl"
        >
          <BotonSegmento
            activo={tresDActivo}
            acento="primary"
            etiqueta="Vista 3D (edificios)"
            onClick={irA3d}
          >
            <Box className="size-3.5" />
            <span className="hidden sm:inline">3D</span>
          </BotonSegmento>
          <ButtonGroupSeparator orientation="vertical" className="bg-border" />
          <BotonSegmento
            activo={dosDActivo}
            acento="secondary"
            etiqueta="Vista 2D (plana)"
            onClick={irA2d}
          >
            <Layers2 className="size-3.5" />
            <span className="hidden sm:inline">2D</span>
          </BotonSegmento>
        </ButtonGroup>

        <ButtonGroup
          orientation="horizontal"
          className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-card/90 shadow-lg backdrop-blur-xl"
        >
          <BotonSegmento
            activo={enCarto}
            acento="primary"
            etiqueta="Carto Dark Matter"
            onClick={irAMap}
          >
            <MapIcon className="size-3.5" />
            <span className="hidden sm:inline">MAP</span>
          </BotonSegmento>
          <ButtonGroupSeparator orientation="vertical" className="bg-border" />
          <BotonSegmento
            activo={enSatelite}
            acento="emerald"
            etiqueta="Satélite híbrido (calles)"
            onClick={irASat}
          >
            <Satellite className="size-3.5" />
            <span className="hidden sm:inline">SAT</span>
          </BotonSegmento>
        </ButtonGroup>
      </div>

      <ReglaEscalaMapa regla={reglaEscala} />
    </div>
  );
}

/**
 * Regla de escala cartográfica (idéntica a `ScaleBar` de Osiris): la barra
 * representa una distancia redonda y su ancho cambia con el zoom — no un
 * texto de ancho de viewport en una caja de tamaño fijo.
 */
function ReglaEscalaMapa({ regla }: { regla?: ReglaEscala }) {
  if (!regla) return null;
  return (
    <div
      className="pointer-events-none flex select-none items-center gap-1.5"
      aria-hidden="true"
      title={`Escala: ${regla.etiqueta}`}
    >
      <div className="relative" style={{ width: regla.anchoPx }}>
        <div className="absolute left-0 top-0 h-[5px] w-px bg-muted-foreground/50" />
        <div className="absolute right-0 top-0 h-[5px] w-px bg-muted-foreground/50" />
        <div className="mt-[4px] h-px w-full bg-muted-foreground/60" />
      </div>
      <span className="font-mono text-[9px] leading-none tracking-widest text-muted-foreground/80">
        {regla.etiqueta}
      </span>
    </div>
  );
}

function BotonSegmento({
  activo,
  acento,
  etiqueta,
  onClick,
  children,
}: {
  activo: boolean;
  acento: "primary" | "secondary" | "emerald";
  etiqueta: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const acentoActivo =
    acento === "primary"
      ? "bg-primary/15 text-primary"
      : acento === "emerald"
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-400";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className={cn(
        "h-9 gap-1.5 rounded-none border-0 bg-transparent px-3 font-mono text-[9px] tracking-wider shadow-none hover:bg-muted/60",
        activo ? acentoActivo : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Button>
  );
}
