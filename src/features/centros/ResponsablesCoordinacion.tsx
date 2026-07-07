import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  CATEGORIAS_RESPONSABILIDAD_COORDINACION,
  CONFIG_CATEGORIA_COORDINACION,
  ETIQUETA_SUBTIPO,
  metaCategoriaCoordinacion,
  responsableCoordinacionTieneDatos,
  type CategoriaResponsabilidadCoordinacion,
  type ResponsableCoordinacion,
} from "@/domain/coordinacionCentro";
import { AccionesContacto } from "@/components/AccionesContacto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatearCantidad(n: number): string {
  return n.toLocaleString("es", { minimumIntegerDigits: 2, useGrouping: false });
}

/** Lista de responsables agrupada por categoría con bloques Personal / Logística / Transporte. */
export function ListaResponsablesCoordinacion({
  responsables,
  modoEdicion = false,
  onEditar,
  onEliminar,
  onAgregarCategoria,
}: {
  responsables: ResponsableCoordinacion[];
  modoEdicion?: boolean;
  onEditar?: (responsable: ResponsableCoordinacion) => void;
  onEliminar?: (id: string) => void;
  onAgregarCategoria?: (categoria: CategoriaResponsabilidadCoordinacion) => void;
}) {
  const visibles = responsables.filter(responsableCoordinacionTieneDatos);

  return (
    <div className="space-y-5">
      {CATEGORIAS_RESPONSABILIDAD_COORDINACION.map((cat) => {
        const grupo = visibles.filter((r) => r.categoria === cat.valor);
        const config = CONFIG_CATEGORIA_COORDINACION[cat.valor];
        const logisticaAgregada = agregarLogisticaCategoria(grupo);
        const vehiculosTotal = grupo.reduce((sum, r) => sum + (r.transporte?.vehiculos ?? 0), 0);
        const tieneDatos =
          grupo.length > 0 ||
          logisticaAgregada.some((i) => i.disponible || i.cantidad > 0) ||
          vehiculosTotal > 0;

        return (
          <section key={cat.valor} className="rounded-xl border border-border bg-card/50 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: cat.color }}
              >
                {cat.label}
              </p>
              {modoEdicion && onAgregarCategoria && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  onClick={() => onAgregarCategoria(cat.valor)}
                >
                  <Plus className="size-3" />
                  Agregar
                </Button>
              )}
            </div>

            {!tieneDatos ? (
              <p className="text-xs text-muted-foreground">Sin datos registrados.</p>
            ) : (
              <div className="space-y-3">
                <BloquePersonal
                  grupo={grupo}
                  modoEdicion={modoEdicion}
                  onEditar={onEditar}
                  onEliminar={onEliminar}
                />

                {config.logistica.length > 0 && (
                  <BloqueLogistica items={logisticaAgregada} />
                )}

                {config.transporte && vehiculosTotal > 0 && (
                  <BloqueTransporte vehiculos={vehiculosTotal} />
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function agregarLogisticaCategoria(grupo: ResponsableCoordinacion[]) {
  const map = new Map<string, { label: string; disponible: boolean; cantidad: number }>();
  for (const r of grupo) {
    for (const item of r.logistica ?? []) {
      const prev = map.get(item.clave);
      map.set(item.clave, {
        label: item.label,
        disponible: (prev?.disponible ?? false) || item.disponible,
        cantidad: (prev?.cantidad ?? 0) + (item.disponible ? item.cantidad : 0),
      });
    }
  }
  return [...map.entries()].map(([clave, v]) => ({ clave, ...v }));
}

function BloquePersonal({
  grupo,
  modoEdicion,
  onEditar,
  onEliminar,
}: {
  grupo: ResponsableCoordinacion[];
  modoEdicion?: boolean;
  onEditar?: (responsable: ResponsableCoordinacion) => void;
  onEliminar?: (id: string) => void;
}) {
  if (grupo.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Personal
      </p>
      <div className="space-y-2">
        {grupo.map((r) => (
          <TarjetaResponsableCoordinacion
            key={r.id}
            responsable={r}
            modoEdicion={modoEdicion}
            onEditar={onEditar}
            onEliminar={onEliminar}
          />
        ))}
      </div>
    </div>
  );
}

function BloqueLogistica({
  items,
}: {
  items: { clave: string; label: string; disponible: boolean; cantidad: number }[];
}) {
  const visibles = items.filter((i) => i.disponible || i.cantidad > 0);
  if (visibles.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Logística
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {visibles.map((item) => (
          <li key={item.clave}>
            {item.label}: {item.disponible ? "Sí" : "No"}
            {item.disponible && item.cantidad > 0 && (
              <span className="text-foreground"> ({formatearCantidad(item.cantidad)})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BloqueTransporte({ vehiculos }: { vehiculos: number }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Transporte
      </p>
      <p className="text-xs text-muted-foreground">
        Vehículos asignados:{" "}
        <span className="text-foreground">{formatearCantidad(vehiculos)}</span>
      </p>
    </div>
  );
}

function TarjetaResponsableCoordinacion({
  responsable: r,
  modoEdicion,
  onEditar,
  onEliminar,
}: {
  responsable: ResponsableCoordinacion;
  modoEdicion?: boolean;
  onEditar?: (responsable: ResponsableCoordinacion) => void;
  onEliminar?: (id: string) => void;
}) {
  const cat = metaCategoriaCoordinacion(r.categoria);
  const telefonos = r.telefonos.filter((t) => t.trim());

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{r.nombre || "Sin nombre"}</p>
          <p className="text-[11px] text-muted-foreground">
            {ETIQUETA_SUBTIPO[r.subtipo]}
          </p>
          {r.cedula.trim() && (
            <p className="text-[11px] text-muted-foreground">C.I. {r.cedula}</p>
          )}
          {r.ente.trim() && <p className="text-[11px] text-muted-foreground">{r.ente}</p>}
          {r.personal_mando > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {r.personal_mando.toLocaleString("es")} personal desplegado
            </p>
          )}
          <Badge
            variant="outline"
            className="mt-1 text-[10px]"
            style={{ borderColor: `${cat.color}66`, color: cat.color }}
          >
            {cat.label}
          </Badge>
        </div>
        {modoEdicion && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Editar"
              onClick={() => onEditar?.(r)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              title="Eliminar"
              onClick={() => onEliminar?.(r.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      {telefonos.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
          {telefonos.map((tel, i) => (
            <div key={`${r.id}-tel-${i}`} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{tel}</span>
              <AccionesContacto telefono={tel} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
