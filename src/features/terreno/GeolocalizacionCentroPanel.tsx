// Flujo de geolocalización del campamento en /terreno: sesión de operador,
// GPS + mapa y guardado de `geom` vía upsert_centro.

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MapPinned, Navigation, Save } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { asegurarSesionTerreno } from "@/data/loginTerreno";
import { guardarCentro, obtenerCentroPorId } from "@/data/reposSupabase";
import { normalizarCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import { marcarCentroGeolocalizado } from "@/lib/geolocalizacionTerreno";
import { conActualizacionTerreno } from "@/lib/terrenoActualizacion";
import { cn } from "@/lib/utils";
import { MapaGeolocalizacionCentro } from "./MapaGeolocalizacionCentro";

interface Props {
  centroId: string;
  centroNombre: string;
  token: string;
  onGuardado: (actualizadoAt: number) => void;
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor.trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </p>
      <p className="text-sm leading-snug text-foreground">{valor}</p>
    </div>
  );
}

/** Abre la app de mapas nativa (Apple Maps / Google Maps) o Maps en escritorio. */
function urlNavegacion(lat: number, lng: number, nombre: string): string {
  const etiqueta = encodeURIComponent(nombre);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iphone|ipad|ipod/i.test(ua)) {
    return `https://maps.apple.com/?daddr=${lat},${lng}&q=${etiqueta}`;
  }
  if (/android/i.test(ua)) {
    return `geo:${lat},${lng}?q=${lat},${lng}(${etiqueta})`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function GeolocalizacionCentroPanel({
  centroId,
  centroNombre,
  token,
  onGuardado,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [centro, setCentro] = useState<CentroTransitorio | null>(null);
  const [teniaUbicacion, setTeniaUbicacion] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError("");
    (async () => {
      try {
        if (token) await asegurarSesionTerreno(token, centroId);
        const fila = await obtenerCentroPorId(centroId);
        if (cancelado) return;
        if (!fila) {
          setError("No se pudo cargar el campamento. Verifique el enlace o su sesión.");
          return;
        }
        const norm = normalizarCentro(fila);
        setCentro(norm);
        if (norm.geom) {
          setTeniaUbicacion(true);
          setLng(norm.geom.coordinates[0]);
          setLat(norm.geom.coordinates[1]);
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo preparar la geolocalización. Intente de nuevo.",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [centroId, token]);

  async function guardar() {
    if (!centro || lat == null || lng == null) return;
    setGuardando(true);
    setError("");
    try {
      const ahora = Date.now();
      const geom: GeoJSON.Point = { type: "Point", coordinates: [lng, lat] };
      await guardarCentro({
        ...centro,
        geom,
        terreno_actualizado: conActualizacionTerreno(
          centro.terreno_actualizado,
          "geolocalizacion",
          ahora,
        ),
      });
      marcarCentroGeolocalizado(centroId);
      setTeniaUbicacion(true);
      setGuardadoOk(true);
      window.setTimeout(() => onGuardado(ahora), 900);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la ubicación. Intente de nuevo.",
      );
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 shadow-lg">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando geolocalización…</p>
      </Card>
    );
  }

  if (error && !centro) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col shadow-lg">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <MapPinned className="size-10 text-muted-foreground" />
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const parroquia = (centro?.parroquia ?? "").replace(/^Parroquia\s/i, "").trim();
  const etiquetaGuardar = teniaUbicacion ? "Actualizar ubicación" : "Guardar ubicación";

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="size-4 text-primary" />
          Ubicación de {centroNombre}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {teniaUbicacion
            ? "Revise el pin, actualice si hace falta o abra la ruta."
            : "Coloque el pin sobre el campamento y guarde."}
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
        {centro && (
          <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:grid-cols-2">
            <FilaDato etiqueta="Estado" valor={centro.estado_federativo ?? ""} />
            <FilaDato etiqueta="Municipio" valor={centro.municipio ?? ""} />
            <FilaDato etiqueta="Parroquia" valor={parroquia} />
            <FilaDato etiqueta="Calle / dirección" valor={centro.direccion ?? ""} />
          </div>
        )}
        <MapaGeolocalizacionCentro
          lat={lat}
          lng={lng}
          onChange={(la, ln) => {
            setLat(la);
            setLng(ln);
            setGuardadoOk(false);
          }}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {guardadoOk && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
            <CheckCircle2 className="size-3.5" />
            Ubicación guardada
          </p>
        )}
      </CardContent>
      <CardFooter className="shrink-0 flex-col gap-2 border-t border-border pt-4 sm:flex-row">
        {teniaUbicacion && lat != null && lng != null && (
          <a
            href={urlNavegacion(lat, lng, centroNombre)}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "h-11 w-full gap-2 border border-border text-sm font-semibold shadow-sm active:scale-[0.98] sm:flex-1",
            )}
          >
            <Navigation className="size-4" />
            Ir
          </a>
        )}
        <Button
          type="button"
          className="h-11 w-full gap-2 sm:flex-1"
          disabled={guardando || lat == null || lng == null || guardadoOk}
          onClick={() => void guardar()}
        >
          {guardando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : guardadoOk ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {guardando ? "Guardando…" : guardadoOk ? "Guardado" : etiquetaGuardar}
        </Button>
      </CardFooter>
    </Card>
  );
}
