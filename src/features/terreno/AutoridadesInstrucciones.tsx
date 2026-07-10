// Instrucciones previas al directorio de autoridades en /terreno.

import { ArrowRight, BookOpen, Landmark, Phone, Users } from "lucide-react";
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

/** Bienvenida antes de registrar autoridades del campamento. */
export function AutoridadesInstrucciones({ onContinuar, nombreCentro }: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4 text-primary" />
          Directorio de autoridades
        </CardTitle>
        <CardDescription>
          {nombreCentro
            ? `Registre los responsables de «${nombreCentro}».`
            : "Registre los responsables del campamento."}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <BloqueInstruccion icono={BookOpen} titulo="¿Qué se registra?">
          Las autoridades de{" "}
          <strong className="font-medium text-foreground">
            Política, Seguridad, Salud, Justicia y Comunitaria
          </strong>
          . La supervisión rotatoria se gestiona en la aplicación con usuario.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Users} titulo="Por cada responsable">
          Nombre, cédula, ente u organización, rol, personal bajo su mando y
          teléfonos de contacto. En salud también puede indicar ambulancia y
          vehículos.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Phone} titulo="Consejo">
          Use un teléfono que responda en campo. Puede agregar más de uno por
          persona.
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
