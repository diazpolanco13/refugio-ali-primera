import { Link } from "react-router-dom";
import { FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { CONDICIONES_VIVIENDA, type RegistroCensoGuardado } from "@/data/reposCenso";
import { CEDULA_JEFE_NO_SE } from "@/domain/catalogosHumanitarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nombreCompletoRegistro } from "./censoRegistrosUtil";

const ABREV_VIVIENDA: Record<string, string> = {
  destruida: "D",
  inhabitable: "I",
  no_posee: "NP",
};

function FilaRegistro({
  fila,
  numero,
  mostrarCentro,
  puedeEditar,
  onEditar,
  onEliminar,
}: {
  fila: RegistroCensoGuardado & { centro_id?: string; centro_nombre?: string };
  numero: number;
  mostrarCentro?: boolean;
  puedeEditar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const nombre = nombreCompletoRegistro(fila);
  const doc = fila.documento
    ? `${fila.tipo_doc === "P" ? "PP " : (fila.tipo_doc ?? "V") + "-"}${fila.documento}`
    : "—";
  const vivienda = CONDICIONES_VIVIENDA.find((c) => c.valor === fila.condicion_vivienda);
  const fecha = new Date(fila.creado_en).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TableRow>
      <TableCell className="px-2 py-1.5 text-center text-muted-foreground">{numero}</TableCell>
      <TableCell className="max-w-40 px-2 py-1.5">
        <span className="block truncate font-medium" title={nombre}>
          {nombre}
        </span>
        {fila.parentesco_jefe && (
          <span className="block truncate text-[10px] text-muted-foreground">
            {fila.parentesco_jefe}
            {fila.jefe_documento === CEDULA_JEFE_NO_SE ? " · cédula no conocida" : null}
          </span>
        )}
        {(fila.embarazada ||
          fila.discapacidad ||
          fila.enfermedad ||
          fila.origen === "import_excel") && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {fila.origen === "import_excel" && (
              <Badge
                variant="outline"
                className="h-4 gap-0.5 border-violet-500/50 px-1 text-[9px] text-violet-700 dark:text-violet-300"
                title={
                  [fila.fuente_archivo, fila.nombre_centro_raw, fila.centro_match]
                    .filter(Boolean)
                    .join(" · ") || "Importación Excel"
                }
              >
                <FileSpreadsheet className="size-2.5" />
                XLS
              </Badge>
            )}
            {fila.embarazada && (
              <Badge variant="outline" className="h-4 border-pink-500/50 px-1 text-[9px] text-pink-600 dark:text-pink-400">
                EMB
              </Badge>
            )}
            {fila.discapacidad && (
              <Badge variant="outline" className="h-4 border-amber-500/50 px-1 text-[9px] text-amber-600 dark:text-amber-400">
                DISC
              </Badge>
            )}
            {fila.enfermedad && (
              <Badge variant="outline" className="h-4 border-red-500/50 px-1 text-[9px] text-red-600 dark:text-red-400">
                ENF
              </Badge>
            )}
          </span>
        )}
      </TableCell>
      <TableCell className="px-2 py-1.5 font-mono text-[11px]">{doc}</TableCell>
      <TableCell className="px-2 py-1.5 text-center">{fila.edad ?? "—"}</TableCell>
      <TableCell className="px-2 py-1.5 text-center">{fila.sexo ?? "—"}</TableCell>
      {mostrarCentro && (
        <TableCell className="max-w-36 px-2 py-1.5">
          {fila.centro_id ? (
            <Link
              to={`/centros/censo/${fila.centro_id}`}
              className="block truncate text-teal-600 hover:underline dark:text-teal-300"
              title={fila.centro_nombre}
            >
              {fila.centro_nombre ?? fila.centro_id}
            </Link>
          ) : (
            "—"
          )}
        </TableCell>
      )}
      <TableCell className="max-w-28 truncate px-2 py-1.5" title={fila.telefono || undefined}>
        {fila.telefono || "—"}
      </TableCell>
      <TableCell
        className="max-w-28 truncate px-2 py-1.5"
        title={[fila.parroquia, fila.municipio].filter(Boolean).join(", ")}
      >
        {fila.parroquia || fila.municipio || "—"}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center" title={vivienda?.label ?? ""}>
        {ABREV_VIVIENDA[fila.condicion_vivienda] ?? "—"}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-right text-muted-foreground">{fecha}</TableCell>
      {puedeEditar && (
        <TableCell className="px-1 py-1.5">
          <div className="flex items-center justify-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title="Corregir registro"
              onClick={onEditar}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              title="Eliminar registro"
              onClick={onEliminar}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

interface Props {
  filas: (RegistroCensoGuardado & { centro_id?: string; centro_nombre?: string })[];
  mostrarCentro?: boolean;
  /** Número de la primera fila visible (para paginación). */
  numeroInicial?: number;
  numeracionDescendente?: boolean;
  puedeEditar: boolean;
  onEditar: (fila: RegistroCensoGuardado) => void;
  onEliminar: (fila: RegistroCensoGuardado) => void;
}

export function CensoRegistrosTabla({
  filas,
  mostrarCentro = false,
  numeroInicial,
  numeracionDescendente = true,
  puedeEditar,
  onEditar,
  onEliminar,
}: Props) {
  const baseNumero = numeroInicial ?? filas.length;
  return (
    <div className="-mx-4 overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 w-8 px-2 text-center">#</TableHead>
            <TableHead className="h-8 px-2">Nombre</TableHead>
            <TableHead className="h-8 px-2">Documento</TableHead>
            <TableHead className="h-8 px-2 text-center">Edad</TableHead>
            <TableHead className="h-8 px-2 text-center">Sexo</TableHead>
            {mostrarCentro && <TableHead className="h-8 px-2">Campamento</TableHead>}
            <TableHead className="h-8 px-2">Teléfono</TableHead>
            <TableHead className="h-8 px-2">Parroquia</TableHead>
            <TableHead className="h-8 px-2 text-center">Viv.</TableHead>
            <TableHead className="h-8 px-2 text-right">Registro</TableHead>
            {puedeEditar && <TableHead className="h-8 w-16 px-1 text-center">Acc.</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f, i) => (
            <FilaRegistro
              key={f.id}
              fila={f}
              numero={numeracionDescendente ? baseNumero - i : baseNumero + i}
              mostrarCentro={mostrarCentro}
              puedeEditar={puedeEditar}
              onEditar={() => onEditar(f)}
              onEliminar={() => onEliminar(f)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
