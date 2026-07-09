import { Archive, Package, Pencil, Trash2 } from "lucide-react";
import {
  CATEGORIAS_REQUERIMIENTO,
  META_ESTATUS_REQUERIMIENTO,
  totalesRequerimientosSeguimiento,
  type RequerimientoSeguimiento,
} from "@/domain/requerimientosSeguimiento";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Banner ámbar con totales del listado de seguimiento. */
export function ResumenRequerimientosSeguimiento({
  items,
  className,
}: {
  items: RequerimientoSeguimiento[];
  className?: string;
}) {
  const { lineas, unidades, pendientes } = totalesRequerimientosSeguimiento(items);
  if (lineas === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Sin requerimientos en seguimiento.
      </p>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <span className="font-semibold text-foreground">
        {lineas.toLocaleString("es")} {lineas === 1 ? "ítem" : "ítems"}
      </span>
      <span className="text-muted-foreground">
        Total solicitado:{" "}
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {unidades.toLocaleString("es")} unidades
        </span>
      </span>
      {pendientes > 0 && (
        <span className="text-muted-foreground">
          Pendientes:{" "}
          <span className="font-bold text-red-400">{pendientes.toLocaleString("es")}</span>
        </span>
      )}
    </div>
  );
}

interface TarjetaProps {
  item: RequerimientoSeguimiento;
  deshabilitado?: boolean;
  modo?: "lectura" | "reporte";
  onEditar?: () => void;
  onArchivar?: () => void;
  onEliminar?: () => void;
  eliminando?: boolean;
  accionesExtra?: React.ReactNode;
}

/** Tarjeta de un requerimiento en seguimiento (reporte o infraestructura). */
export function TarjetaRequerimientoSeguimiento({
  item,
  deshabilitado,
  modo = "lectura",
  onEditar,
  onArchivar,
  onEliminar,
  eliminando,
  accionesExtra,
}: TarjetaProps) {
  const meta = META_ESTATUS_REQUERIMIENTO[item.estatus];
  const catLabel =
    CATEGORIAS_REQUERIMIENTO.find((c) => c.valor === item.categoria)?.label ?? item.categoria;
  const entregado = item.estatus === "entregado" || item.estatus === "archivado";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-2.5",
        entregado && "opacity-80",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Package className="size-3.5 shrink-0 text-amber-500" />
            {item.concepto}
          </p>
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ borderColor: `${meta.color}66`, color: meta.color }}
          >
            {meta.label}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {catLabel}
          </Badge>
          <BadgeAntiguedad
            reportadoDia={item.reportado_dia}
            resueltaTs={item.resuelta_ts}
            creadaTs={item.creada_ts}
          />
        </div>
        {item.notas?.trim() && (
          <p className="text-[11px] text-muted-foreground">{item.notas}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-bold tabular-nums text-foreground">
          {item.cantidad.toLocaleString("es")}
        </span>
        {accionesExtra}
        {modo === "reporte" && (
          <div className="flex gap-0.5">
            {onEditar && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={deshabilitado || eliminando}
                onClick={onEditar}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {onArchivar && item.estatus === "entregado" && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={deshabilitado || eliminando}
                onClick={onArchivar}
                aria-label="Archivar"
              >
                <Archive className="size-3.5" />
              </Button>
            )}
            {onEliminar && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={deshabilitado || eliminando}
                    aria-label="Eliminar requerimiento"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar requerimiento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrará «{item.concepto}» de forma permanente. Esta acción no se puede
                      deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onEliminar}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Listado estilo ficha (divide-y) para requerimientos en seguimiento. */
export function ListaRequerimientosSeguimiento({
  items,
  vacio,
  renderItem,
}: {
  items: RequerimientoSeguimiento[];
  vacio?: React.ReactNode;
  renderItem: (item: RequerimientoSeguimiento) => React.ReactNode;
}) {
  const validos = items.filter((r) => r.concepto.trim());
  if (validos.length === 0) {
    return vacio ?? null;
  }
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {validos.map((item) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
    </div>
  );
}
