import { useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Package } from "lucide-react";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import { actualizarRequerimientoSeguimiento } from "@/data/reposRequerimientosSeguimiento";
import {
  ESTATUS_REQUERIMIENTO,
  META_ESTATUS_REQUERIMIENTO,
  requerimientosPendientes,
  type EstatusRequerimientoSeguimiento,
  type RequerimientoSeguimiento,
} from "@/domain/requerimientosSeguimiento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ListaRequerimientosSeguimiento,
  ResumenRequerimientosSeguimiento,
  TarjetaRequerimientoSeguimiento,
} from "./RequerimientosSeguimientoUi";

type FiltroSeguimiento = "todos" | "pendientes" | "entregados";

interface Props {
  centroId: string;
  puedeEditar?: boolean;
  onIrAReporte?: (fase?: string) => void;
}

function SelectorEstatus({
  item,
  deshabilitado,
}: {
  item: RequerimientoSeguimiento;
  deshabilitado?: boolean;
}) {
  const [guardando, setGuardando] = useState(false);

  async function cambiarEstatus(estatus: EstatusRequerimientoSeguimiento) {
    if (estatus === item.estatus || estatus === "archivado") return;
    setGuardando(true);
    try {
      await actualizarRequerimientoSeguimiento(item.id, { estatus });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Select
      value={item.estatus}
      disabled={deshabilitado || guardando}
      onValueChange={(v) => void cambiarEstatus(v as EstatusRequerimientoSeguimiento)}
    >
      <SelectTrigger className="h-7 w-[7.5rem] text-[11px]">
        {guardando ? <Loader2 className="size-3 animate-spin" /> : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {ESTATUS_REQUERIMIENTO.filter((e) => e.valor !== "archivado").map((e) => (
          <SelectItem key={e.valor} value={e.valor} className="text-xs">
            {e.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Seguimiento de requerimientos logísticos (tabla `requerimientos_seguimiento`). */
export function SeguimientoRequerimientosCentro({
  centroId,
  puedeEditar = false,
  onIrAReporte,
}: Props) {
  const { requerimientos: items } = useRequerimientosSeguimiento({
    centroId,
    soloActivos: true,
  });
  const [filtro, setFiltro] = useState<FiltroSeguimiento>("pendientes");

  const pendientes = useMemo(() => requerimientosPendientes(items), [items]);
  const entregados = useMemo(
    () => items.filter((r) => r.estatus === "entregado"),
    [items],
  );

  const visibles = useMemo(() => {
    if (filtro === "pendientes") return pendientes;
    if (filtro === "entregados") return entregados;
    return items;
  }, [filtro, items, pendientes, entregados]);

  const chips: { id: FiltroSeguimiento; label: string; count: number }[] = [
    { id: "pendientes", label: "Pendientes", count: pendientes.length },
    { id: "entregados", label: "Entregados", count: entregados.length },
    { id: "todos", label: "Todos", count: items.length },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="size-4 text-amber-500" />
              Requerimientos logísticos
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Seguimiento de entregas: se registran en el reporte del día y se actualizan aquí.
            </p>
          </div>
          {onIrAReporte && puedeEditar && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => onIrAReporte("requerimientos")}
            >
              <ClipboardCheck className="size-3.5" />
              Registrar en reporte
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4">
        <ResumenRequerimientosSeguimiento items={items} />

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[10px]">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-0.5 transition-colors",
                  filtro === c.id
                    ? "border-amber-500/50 bg-amber-500/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
                onClick={() => setFiltro(c.id)}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        )}

        <ListaRequerimientosSeguimiento
          items={visibles}
          vacio={
            <p className="text-xs text-muted-foreground">
              {filtro === "pendientes"
                ? "No hay requerimientos pendientes."
                : filtro === "entregados"
                  ? "Aún no hay entregas registradas."
                  : "Sin requerimientos en seguimiento."}
              {puedeEditar && onIrAReporte && (
                <>
                  {" "}
                  Regístralos en el{" "}
                  <button
                    type="button"
                    className="font-medium text-teal-400 underline-offset-2 hover:underline"
                    onClick={() => onIrAReporte("requerimientos")}
                  >
                    reporte del día
                  </button>
                  .
                </>
              )}
            </p>
          }
          renderItem={(item) => (
            <TarjetaRequerimientoSeguimiento
              item={item}
              accionesExtra={
                puedeEditar ? (
                  <SelectorEstatus item={item} />
                ) : (
                  <BadgeEstatusCompacto estatus={item.estatus} />
                )
              }
            />
          )}
        />
      </CardContent>
    </Card>
  );
}

function BadgeEstatusCompacto({ estatus }: { estatus: EstatusRequerimientoSeguimiento }) {
  const meta = META_ESTATUS_REQUERIMIENTO[estatus];
  return (
    <span
      className="rounded-md border px-2 py-0.5 text-[10px] font-medium"
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}
