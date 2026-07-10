// Instrucciones previas al registro de capacidad en /terreno.

import { ArrowRight, BedDouble, BookOpen, Building2, Droplets } from "lucide-react";
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

/** Bienvenida antes de registrar aforo y recursos Esfera del campamento. */
export function CapacidadInstrucciones({ onContinuar, nombreCentro }: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BedDouble className="size-4 text-primary" />
          Capacidad del campamento
        </CardTitle>
        <CardDescription>
          {nombreCentro
            ? `Registre el aforo y los recursos de «${nombreCentro}».`
            : "Registre el aforo y los recursos del campamento."}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <BloqueInstruccion icono={Building2} titulo="Aforo oficial">
          Capacidad máxima e instalada (cupo de personas) y el ministerio o ente
          responsable. El cupo disponible se calcula restando los damnificados.
        </BloqueInstruccion>

        <BloqueInstruccion icono={BedDouble} titulo="Recursos Esfera">
          Camas, baños, duchas, lavaderos y contenedores: indique lo{" "}
          <strong className="font-medium text-foreground">instalado</strong> y lo{" "}
          <strong className="font-medium text-foreground">operativo</strong>.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Droplets} titulo="Agua potable">
          Si hay tanque, márquelo y anote la capacidad en litros. Indique también
          si el suministro está operativo.
        </BloqueInstruccion>

        <BloqueInstruccion icono={BookOpen} titulo="Consejo">
          Puede guardar con lo que tenga a la mano y completar el resto más
          tarde. Los datos quedan en la ficha del campamento.
        </BloqueInstruccion>
      </CardContent>

      <CardFooter className="shrink-0 border-t border-border pt-4">
        <Button type="button" className="h-11 w-full" onClick={onContinuar}>
          Entendido, continuar
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
