import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  titulo: string;
  descripcion?: string;
}

/** Placeholder para funcionalidades aún no implementadas. */
export function EnDesarrollo({ titulo, descripcion }: Props) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4 lg:p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
            <Construction className="size-6" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <CardTitle>{titulo}</CardTitle>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Por desarrollar
            </Badge>
          </div>
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
}
