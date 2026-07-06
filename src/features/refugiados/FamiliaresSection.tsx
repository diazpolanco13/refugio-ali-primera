// Pestaña Familiares — hogar conviviente asociado al mismo grupo familiar.

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import {
  formatearCedula,
  META_ESTADO_ALOJAMIENTO,
  nombreCompleto,
  type AlojamientoEnriquecido,
} from "@/domain/refugiados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AgregarFamiliarHogarDialog } from "./AgregarFamiliarHogarDialog";
import { ApoyosHogarSection } from "./ApoyosHogarSection";

interface Props {
  miembros: AlojamientoEnriquecido[];
  miembrosEgresados?: AlojamientoEnriquecido[];
  familiaNombre?: string;
  familiaId?: string | null;
  centroId: string;
  refugiadoActualId: string;
  alojamientoActualId: string;
  puedeEditar: boolean;
  onAbrirMiembro?: (alojamientoId: string) => void;
}

export function FamiliaresSection({
  miembros,
  miembrosEgresados = [],
  familiaNombre,
  familiaId,
  centroId,
  refugiadoActualId,
  alojamientoActualId,
  puedeEditar,
  onAbrirMiembro,
}: Props) {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const tituloFamilia = familiaNombre ? `Familia ${familiaNombre}` : "Hogar sin nombre";
  const puedeAgregar = puedeEditar && Boolean(familiaId);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4" />
              Hogar en el campamento
            </CardTitle>
            <CardDescription className="text-xs">
              {familiaId
                ? `${tituloFamilia} · ${miembros.length} miembro(s) actualmente alojado(s)`
                : "Esta persona aún no está asociada a un hogar del campamento."}
            </CardDescription>
          </div>
          {puedeAgregar && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setDialogoAbierto(true)}
            >
              <Plus className="size-3.5" />
              Agregar familiar al hogar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!familiaId ? (
            <p className="text-sm text-muted-foreground">
              Asigna o crea un hogar en la ficha de alojamiento para ver aquí a quienes conviven con esta persona.
            </p>
          ) : miembros.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay miembros actuales asociados a este hogar.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Documento / ficha</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {miembros.map((m) => (
                    <FilaMiembro
                      key={m.id}
                      miembro={m}
                      esActual={m.refugiado_id === refugiadoActualId}
                      alojamientoActualId={alojamientoActualId}
                      onAbrirMiembro={onAbrirMiembro}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {miembrosEgresados.length > 0 && (
            <details className="rounded-md border border-border/60 bg-muted/10">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                {miembrosEgresados.length} familiar(es) egresado(s) del hogar
              </summary>
              <div className="border-t border-border/60 p-2">
                <ul className="space-y-1 text-xs">
                  {miembrosEgresados.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1">
                      <span className="font-medium">{nombreCompleto(m.refugiado)}</span>
                      <span className="text-muted-foreground">Egreso: {m.fecha_egreso || "—"}</span>
                      {m.motivo_egreso && <span className="text-muted-foreground">· {m.motivo_egreso}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <ApoyosHogarSection familiaId={familiaId} centroId={centroId} puedeEditar={puedeEditar} />

      {familiaId && (
        <AgregarFamiliarHogarDialog
          open={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          centroId={centroId}
          familiaId={familiaId}
          miembros={miembros}
          onAgregado={onAbrirMiembro}
        />
      )}
    </>
  );
}

function FilaMiembro({
  miembro,
  esActual,
  alojamientoActualId,
  onAbrirMiembro,
}: {
  miembro: AlojamientoEnriquecido;
  esActual: boolean;
  alojamientoActualId: string;
  onAbrirMiembro?: (alojamientoId: string) => void;
}) {
  const meta = META_ESTADO_ALOJAMIENTO[miembro.estado];
  const identificador =
    miembro.refugiado.codigo_ficha ?? formatearCedula(miembro.refugiado.cedula, miembro.refugiado.tipo_doc);

  return (
    <TableRow
      className={cn(
        esActual && "bg-primary/5",
        onAbrirMiembro && !esActual && "cursor-pointer hover:bg-muted/40",
      )}
      onClick={() => {
        if (onAbrirMiembro && miembro.id !== alojamientoActualId) onAbrirMiembro(miembro.id);
      }}
    >
      <TableCell className="font-medium">
        {nombreCompleto(miembro.refugiado)}
        {esActual && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            Actual
          </Badge>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{identificador}</TableCell>
      <TableCell>
        {miembro.es_jefe_familia ? (
          <Badge variant="outline" className="text-[10px]">
            Jefe de familia
          </Badge>
        ) : (
          miembro.parentesco_jefe || "—"
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
        {miembro.itinerante && (
          <Badge variant="outline" className="ml-1 text-[10px] text-sky-400">
            Itinerante
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{miembro.plaza_modulo || "—"}</TableCell>
    </TableRow>
  );
}
