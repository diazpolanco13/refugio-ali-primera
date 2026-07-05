import { Package, Plus, Trash2 } from "lucide-react";
import { nuevoId } from "@/data/reposSupabase";
import {
  CONCEPTOS_REQUERIMIENTO_COMUNES,
  totalesRequerimientos,
  type ItemRequerimiento,
} from "@/domain/centrosTransitorios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { cn } from "@/lib/utils";

/** Resumen numérico de requerimientos (formulario y ficha). */
export function ResumenRequerimientos({
  items,
  className,
}: {
  items: ItemRequerimiento[];
  className?: string;
}) {
  const { lineas, unidades } = totalesRequerimientos(items);
  if (lineas === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Sin requerimientos registrados.
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
    </div>
  );
}

/** Formulario editable de necesidades logísticas del centro. */
export function FormularioRequerimientos({
  items,
  onChange,
  deshabilitado,
}: {
  items: ItemRequerimiento[];
  onChange: (items: ItemRequerimiento[]) => void;
  deshabilitado?: boolean;
}) {
  function actualizar(id: string, patch: Partial<ItemRequerimiento>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function eliminar(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function agregar(concepto = "") {
    onChange([
      ...items,
      { id: nuevoId(), concepto, cantidad: concepto ? 1 : 0, notas: "" },
    ]);
  }

  function agregarConceptoComun(concepto: string) {
    const existente = items.find(
      (i) => i.concepto.trim().toLowerCase() === concepto.toLowerCase(),
    );
    if (existente) {
      actualizar(existente.id, { cantidad: existente.cantidad + 1 });
      return;
    }
    agregar(concepto);
  }

  const conceptosUsados = new Set(items.map((i) => i.concepto.trim().toLowerCase()).filter(Boolean));

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Requerimientos del campamento</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Indica qué necesita el refugio y en qué cantidad. Puedes agregar ítems personalizados o
          usar las sugerencias rápidas.
        </p>
      </div>

      <ResumenRequerimientos items={items} />

      {!deshabilitado && (
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">Agregar rápido</p>
          <div className="flex flex-wrap gap-1.5">
            {CONCEPTOS_REQUERIMIENTO_COMUNES.map((concepto) => {
              const yaEsta = conceptosUsados.has(concepto.toLowerCase());
              return (
                <Button
                  key={concepto}
                  type="button"
                  size="xs"
                  variant={yaEsta ? "secondary" : "outline"}
                  className="h-auto max-w-full py-1 whitespace-normal"
                  onClick={() => agregarConceptoComun(concepto)}
                >
                  <Plus className="size-3 shrink-0" />
                  {concepto}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay requerimientos. Usa una sugerencia o agrega un ítem.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <Card key={item.id} size="sm" className="py-2">
              <CardContent className="space-y-2 px-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-center text-[11px] font-medium text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Qué se necesita</Label>
                        <Input
                          className="mt-1"
                          list="conceptos-requerimiento-centro"
                          value={item.concepto}
                          disabled={deshabilitado}
                          onChange={(e) => actualizar(item.id, { concepto: e.target.value })}
                          placeholder="Ej. Camas, cocina, tanques…"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
                        <NumInput
                          className="mt-1"
                          value={item.cantidad}
                          disabled={deshabilitado}
                          onChange={(n) => actualizar(item.id, { cantidad: n })}
                        />
                      </div>
                    </div>
                    <Input
                      value={item.notas ?? ""}
                      disabled={deshabilitado}
                      onChange={(e) => actualizar(item.id, { notas: e.target.value })}
                      placeholder="Notas (opcional): urgente, filtración techo…"
                      className="text-xs"
                    />
                  </div>
                  {!deshabilitado && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => eliminar(item.id)}
                      title="Quitar ítem"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <datalist id="conceptos-requerimiento-centro">
        {CONCEPTOS_REQUERIMIENTO_COMUNES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {!deshabilitado && (
        <Button type="button" size="sm" variant="secondary" onClick={() => agregar()}>
          <Plus className="size-4" />
          Agregar ítem personalizado
        </Button>
      )}
    </div>
  );
}

/** Listado de requerimientos en modo lectura (ficha del centro). */
export function ListaRequerimientos({ items }: { items: ItemRequerimiento[] }) {
  const validos = items.filter((i) => i.concepto.trim() && i.cantidad > 0);
  if (validos.length === 0) return null;

  return (
    <div className="space-y-2">
      <ResumenRequerimientos items={items} />
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {validos.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Package className="size-3.5 shrink-0 text-amber-500" />
                {item.concepto}
              </p>
              {item.notas?.trim() && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.notas}</p>
              )}
            </div>
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-sm font-bold tabular-nums text-foreground">
              {item.cantidad.toLocaleString("es")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
