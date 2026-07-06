import { LogoCuerpo } from "@/components/LogoCuerpo";
import { Camera, Home, Navigation, PawPrint, ShieldCheck, Users } from "lucide-react";
import {
  metaCuerpoDe,
  normalizarCentro,
  poblacionCentro,
  totalPersonalOperativo,
  ubicacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { alertasCentro, analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { IconosAlerta } from "./IconosAlerta";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  className?: string;
  /** Indica si el panel DetalleCentro está abierto (estado "presionado" del botón). */
  detalleAbierto?: boolean;
  /** Alternar (abrir/cerrar) el panel de detalle completo del centro. */
  onToggleDetalle?: () => void;
}

/**
 * Construye la URL de navegación GPS hacia el centro según el dispositivo.
 *
 * - Móvil real (Android/iOS): esquema `geo:` que abre la app de mapas nativa
 *   del SO (Google Maps en Android, Apple Maps en iOS). El SO maneja el
 *   esquema y abre la app correspondiente.
 * - Desktop: Google Maps `https://www.google.com/maps/dir/...` (funciona en
 *   todos los navegadores; abre en nueva pestaña con `target="_blank"`).
 *
 * Devuelve `null` si el centro no tiene coordenadas (`geom`); el botón que la
 * usa se deshabilita en ese caso.
 *
 * Nota: se detecta móvil por `userAgent` (no por `maxTouchPoints`/`ontouchstart`),
 * porque muchos laptops modernos con pantalla táctil reportan `maxTouchPoints >
 * 0` y romperían la detección intentando `geo:` en desktop (donde no se maneja).
 */
function urlNavegacion(centro: CentroTransitorio): string | null {
  if (!centro.geom) return null;
  // GeoJSON.Point = [lng, lat].
  const [lng, lat] = centro.geom.coordinates as [number, number];
  const nombre = encodeURIComponent(centro.nombre);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const esMovil = /android|iphone|ipad|ipod/i.test(ua);
  if (esMovil) {
    // geo: abre la app de mapas por defecto (Google Maps en Android, Apple Maps en iOS).
    return `geo:${lat},${lng}?q=${lat},${lng}(${nombre})`;
  }
  // Desktop: Google Maps. Más simple y robusto que distinguir Safari/Apple Maps.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Ficha básica de un centro transitorio: cuerpo asignado, ubicación y estado. */
export function InfoCentro({ centro, className, detalleAbierto, onToggleDetalle }: Props) {
  const meta = metaCuerpoDe(centro.cuerpo);
  const analisis = analisisCentro(centro);
  const alertas = alertasCentro(centro);
  const centroNormalizado = normalizarCentro(centro);
  const refugiados = poblacionCentro(centroNormalizado);
  const familias = centroNormalizado.familias_ocupadas;
  const funcionarios = totalPersonalOperativo(centroNormalizado.personal);
  const mascotas = centroNormalizado.ocupacion.mascotas;
  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];
  const tieneCoord = !!centro.geom;
  const url = urlNavegacion(centro);
  const ubicacion = ubicacionCentro(centro);
  const fotoUrl = centroNormalizado.foto_url;
  const kpis = [
    {
      etiqueta: "Familias",
      valor: familias,
      icono: <Home className="size-3.5 shrink-0 text-primary" />,
    },
    {
      etiqueta: "Damnificados",
      valor: refugiados,
      icono: <Users className="size-3.5 shrink-0 text-primary" />,
    },
    {
      etiqueta: "Funcionarios",
      valor: funcionarios,
      icono: <ShieldCheck className="size-3.5 shrink-0 text-primary" />,
    },
    {
      etiqueta: "Mascotas",
      valor: mascotas,
      icono: <PawPrint className="size-3.5 shrink-0 text-primary" />,
    },
  ];

  return (
    <div className={cn("min-w-[240px] max-w-[300px] space-y-2 text-left", className)}>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-stretch gap-2.5">
        <div
          className="relative h-full min-h-[4.5rem] overflow-hidden rounded-lg border border-border bg-muted/20"
          title={fotoUrl ? "Foto del campamento" : "Sin foto del campamento"}
        >
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full min-h-[4.5rem] items-center justify-center">
              <Camera className="size-7 text-muted-foreground/45" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="flex min-h-[4.5rem] min-w-0 flex-col justify-between gap-1.5 self-stretch py-0.5">
          <span
            className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white"
            style={{ borderColor: meta.color }}
            title={meta.label}
            aria-label={meta.label}
          >
            {meta.logo ? (
              <LogoCuerpo src={meta.logo} priority="high" />
            ) : (
              <span className="text-sm leading-none">{meta.icono}</span>
            )}
          </span>

          <p className="text-sm font-semibold leading-snug break-words text-foreground">
            {centro.nombre}
          </p>

          {ubicacion ? (
            <p className="shrink-0 text-[10px] leading-snug break-words text-muted-foreground">
              {ubicacion}
            </p>
          ) : (
            <p className="shrink-0 text-[10px] italic leading-snug text-muted-foreground/70">
              Ubicación no registrada
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-t border-border pt-2">
        {kpis.map((kpi) => (
          <div
            key={kpi.etiqueta}
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-muted/25 px-2 py-1.5"
          >
            {kpi.icono}
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {kpi.valor.toLocaleString("es")}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{kpi.etiqueta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">Cupo disponible</span>
        <span className="font-semibold" style={{ color: colorSemaforo }}>
          {analisis.cupoReal != null
            ? `+${analisis.cupoReal.toLocaleString("es")}`
            : "Sin datos"}
        </span>
      </div>

      {alertas.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>En déficit:</span>
          <IconosAlerta alertas={alertas} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a
            href={url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(ev) => ev.stopPropagation()}
            aria-disabled={!tieneCoord}
            tabIndex={tieneCoord ? undefined : -1}
            title={tieneCoord ? "Abrir navegación" : "Sin coordenadas"}
            className={cn(!tieneCoord && "pointer-events-none opacity-50")}
          >
            <Navigation className="size-3.5" />
            Ir
          </a>
        </Button>
        {onToggleDetalle && (
          <Button
            type="button"
            variant={detalleAbierto ? "default" : "outline"}
            size="sm"
            className="flex-1"
            aria-pressed={detalleAbierto ? true : undefined}
            onClick={(ev) => {
              ev.stopPropagation();
              onToggleDetalle();
            }}
          >
            detalles
          </Button>
        )}
      </div>
    </div>
  );
}
