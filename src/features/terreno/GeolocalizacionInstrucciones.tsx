// Pantalla de bienvenida antes de geolocalizar el campamento desde /terreno.

import {
  ArrowRight,
  BookOpen,
  Crosshair,
  MapPinned,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  onContinuar: () => void;
  nombreCentro?: string;
}

function BloqueInstruccion({
  icono: Icono,
  titulo,
  children,
}: {
  icono: typeof BookOpen;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icono className="size-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium leading-snug">{titulo}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/** Instrucciones previas a capturar la ubicación GPS del campamento. */
export function GeolocalizacionInstrucciones({ onContinuar, nombreCentro }: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="size-4 text-primary" />
          Geolocalizar el campamento
        </CardTitle>
        <CardDescription>
          {nombreCentro
            ? `Ubique «${nombreCentro}» con el GPS del dispositivo.`
            : "Ubique el campamento con el GPS del dispositivo."}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <BloqueInstruccion icono={BookOpen} titulo="¿Para qué sirve?">
          La sala situacional necesita la{" "}
          <strong className="font-medium text-foreground">ubicación exacta</strong> del
          campamento en el mapa. Hágalo{" "}
          <strong className="font-medium text-foreground">estando en el centro</strong>, no
          desde otra sede.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Crosshair} titulo="1 · Activar el GPS">
          El dispositivo pedirá permiso de ubicación. Acéptelo y espere unos segundos hasta
          que aparezca el pin en el mapa.
        </BloqueInstruccion>

        <BloqueInstruccion icono={MapPinned} titulo="2 · Revisar en el mapa">
          Compruebe que el pin cae sobre el edificio o el patio del campamento. Si hace falta,
          puede arrastrarlo o volver a tomar el GPS.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Save} titulo="3 · Guardar">
          Solo cuando el pin esté bien colocado, pulse{" "}
          <strong className="font-medium text-foreground">Guardar ubicación</strong>. Quedará
          registrada para toda la red.
        </BloqueInstruccion>

        <BloqueInstruccion icono={ShieldCheck} titulo="Privacidad">
          Se guarda únicamente la coordenada del campamento, no un historial de su recorrido.
        </BloqueInstruccion>
      </CardContent>

      <CardFooter className="shrink-0 border-t border-border pt-4">
        <Button type="button" className="h-11 w-full" onClick={onContinuar}>
          Entendido, geolocalizar
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
