import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { VistaPagina } from "@/components/VistaPagina";

interface Props {
  titulo: string;
  descripcion?: string;
  conMarco?: boolean;
}

/** Placeholder para funcionalidades aún no implementadas. */
export function EnDesarrollo({ titulo, descripcion, conMarco = true }: Props) {
  const cuerpo = (
    <div className="flex min-h-[40vh] items-center justify-center p-4 lg:p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Badge variant="outline" className="mx-auto mb-3 text-[10px] text-muted-foreground">
            Por desarrollar
          </Badge>
          <CardDescription>
            {descripcion ??
              "Esta función está planificada y aparecerá en una próxima versión de la plataforma."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Si necesitas esta capacidad con urgencia, coordina con el equipo de la sala situacional.
        </CardContent>
      </Card>
    </div>
  );

  if (!conMarco) return cuerpo;

  return (
    <VistaPagina
      icono={Construction}
      acento="primary"
      titulo={titulo}
      descripcion="Funcionalidad planificada para una próxima versión"
    >
      {cuerpo}
    </VistaPagina>
  );
}
