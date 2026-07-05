// Pestaña Familiares — miembros asociados al mismo grupo familiar.

import { Users } from "lucide-react";
import {
  formatearCedula,
  META_ESTADO_ALOJAMIENTO,
  nombreCompleto,
  type AlojamientoEnriquecido,
} from "@/domain/refugiados";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  miembros: AlojamientoEnriquecido[];
  familiaNombre?: string;
  refugiadoActualId: string;
  alojamientoActualId: string;
  onAbrirMiembro?: (alojamientoId: string) => void;
}

export function FamiliaresSection({
  miembros,
  familiaNombre,
  refugiadoActualId,
  alojamientoActualId,
  onAbrirMiembro,
}: Props) {
  if (!miembros.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4" />
            Familiares
          </CardTitle>
          <CardDescription className="text-xs">
            Esta persona no está asociada a un grupo familiar en este campamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Asigna una familia al registrar o editar la plaza para ver aquí a los demás miembros.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4" />
          Familiares asociados
        </CardTitle>
        <CardDescription className="text-xs">
          {familiaNombre ? `Familia ${familiaNombre}` : "Grupo familiar"} · {miembros.length} miembro(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Parentesco</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {miembros.map((m) => {
                const esActual = m.refugiado_id === refugiadoActualId;
                const meta = META_ESTADO_ALOJAMIENTO[m.estado];
                return (
                  <TableRow
                    key={m.id}
                    className={cn(
                      esActual && "bg-primary/5",
                      onAbrirMiembro && !esActual && "cursor-pointer hover:bg-muted/40",
                    )}
                    onClick={() => {
                      if (onAbrirMiembro && m.id !== alojamientoActualId) onAbrirMiembro(m.id);
                    }}
                  >
                    <TableCell className="font-medium">
                      {nombreCompleto(m.refugiado)}
                      {esActual && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Actual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatearCedula(m.refugiado.cedula, m.refugiado.tipo_doc)}
                    </TableCell>
                    <TableCell>
                      {m.es_jefe_familia ? (
                        <Badge variant="outline" className="text-[10px]">
                          Jefe de familia
                        </Badge>
                      ) : (
                        m.parentesco_jefe || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ borderColor: meta.color, color: meta.color }}
                      >
                        {meta.label}
                      </Badge>
                      {m.itinerante && (
                        <Badge variant="outline" className="ml-1 text-[10px] text-sky-400">
                          Itinerante
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
