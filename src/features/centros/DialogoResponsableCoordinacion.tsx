import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  CATEGORIAS_RESPONSABILIDAD_COORDINACION,
  CONFIG_CATEGORIA_COORDINACION,
  ETIQUETA_SUBTIPO,
  logisticaDefault,
  metaCategoriaCoordinacion,
  normalizarResponsableCoordinacion,
  responsableCoordinacionVacio,
  subtipoDefault,
  type CategoriaResponsabilidadCoordinacion,
  type ItemLogisticaCoordinacion,
  type ResponsableCoordinacion,
  type SubtipoPersonalCoordinacion,
} from "@/domain/coordinacionCentro";
import { AccionesContacto } from "@/components/AccionesContacto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/** Campos del formulario para un responsable de coordinación. */
export function CamposResponsableCoordinacion({
  valor,
  onChange,
}: {
  valor: ResponsableCoordinacion;
  onChange: (patch: Partial<ResponsableCoordinacion>) => void;
}) {
  const cat = metaCategoriaCoordinacion(valor.categoria);
  const config = CONFIG_CATEGORIA_COORDINACION[valor.categoria];

  function actualizarTelefono(indice: number, tel: string) {
    const telefonos = [...valor.telefonos];
    telefonos[indice] = tel;
    onChange({ telefonos });
  }

  function agregarTelefono() {
    onChange({ telefonos: [...valor.telefonos, ""] });
  }

  function quitarTelefono(indice: number) {
    const telefonos = valor.telefonos.filter((_, i) => i !== indice);
    onChange({ telefonos: telefonos.length > 0 ? telefonos : [""] });
  }

  function cambiarCategoria(categoria: CategoriaResponsabilidadCoordinacion) {
    onChange({
      categoria,
      subtipo: subtipoDefault(categoria),
      logistica: logisticaDefault(categoria),
      transporte: { vehiculos: 0 },
    });
  }

  function actualizarLogistica(clave: string, patch: Partial<ItemLogisticaCoordinacion>) {
    onChange({
      logistica: valor.logistica.map((item) =>
        item.clave === clave ? { ...item, ...patch } : item,
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[11px] text-muted-foreground">Categoría de responsabilidad</Label>
        <Select value={valor.categoria} onValueChange={(v) => cambiarCategoria(v as CategoriaResponsabilidadCoordinacion)}>
          <SelectTrigger className="mt-1 h-9 w-full">
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS_RESPONSABILIDAD_COORDINACION.map((item) => (
              <SelectItem key={item.valor} value={item.valor}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Rol / subtipo</Label>
        <Select
          value={valor.subtipo}
          onValueChange={(v) => onChange({ subtipo: v as SubtipoPersonalCoordinacion })}
        >
          <SelectTrigger className="mt-1 h-9 w-full">
            <SelectValue placeholder="Seleccionar rol" />
          </SelectTrigger>
          <SelectContent>
            {config.subtipos.map((item) => (
              <SelectItem key={item} value={item}>
                {ETIQUETA_SUBTIPO[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Nombre y apellido</Label>
        <Input
          className="mt-1"
          value={valor.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          placeholder="Nombre completo del responsable"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Cédula</Label>
          <Input
            className="mt-1"
            value={valor.cedula}
            onChange={(e) => onChange({ cedula: e.target.value })}
            placeholder="V-…"
            inputMode="numeric"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Personal bajo su mando</Label>
          <NumInput
            className="mt-1"
            value={valor.personal_mando}
            onChange={(n) => onChange({ personal_mando: n })}
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Ministerio, ente u organización</Label>
        <Input
          className="mt-1"
          value={valor.ente}
          onChange={(e) => onChange({ ente: e.target.value })}
          placeholder="Ej. GNB, Alcaldía, PADRINO…"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Teléfonos de contacto</Label>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-1.5 text-[11px]"
            onClick={agregarTelefono}
          >
            <Plus className="size-3" />
            Agregar teléfono
          </Button>
        </div>
        <div className="space-y-1.5">
          {valor.telefonos.map((tel, i) => (
            <div key={`tel-${i}`} className="flex items-center gap-1.5">
              <Input
                value={tel}
                onChange={(e) => actualizarTelefono(i, e.target.value)}
                placeholder="04xx-…"
                inputMode="tel"
                className="flex-1"
              />
              {tel.trim() && <AccionesContacto telefono={tel} />}
              {valor.telefonos.length > 1 && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => quitarTelefono(i)}
                  title="Quitar teléfono"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {config.logistica.length > 0 && (
        <section className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">Logística</p>
          {valor.logistica.map((item) => (
            <div key={item.clave} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] text-muted-foreground">{item.label}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {item.disponible ? "Sí" : "No"}
                  </span>
                  <Switch
                    checked={item.disponible}
                    onCheckedChange={(checked) =>
                      actualizarLogistica(item.clave, {
                        disponible: checked,
                        cantidad: checked && item.cantidad === 0 ? 1 : item.cantidad,
                      })
                    }
                  />
                </div>
              </div>
              {item.disponible && (
                <div>
                  <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
                  <NumInput
                    className="mt-1"
                    value={item.cantidad}
                    onChange={(n) => actualizarLogistica(item.clave, { cantidad: n })}
                  />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {config.transporte && (
        <section className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">Transporte</p>
          <div>
            <Label className="text-[11px] text-muted-foreground">Vehículos asignados</Label>
            <NumInput
              className="mt-1"
              value={valor.transporte.vehiculos}
              onChange={(n) => onChange({ transporte: { vehiculos: n } })}
            />
          </div>
        </section>
      )}

      <Badge
        variant="outline"
        className="text-[10px]"
        style={{ borderColor: `${cat.color}66`, color: cat.color }}
      >
        {cat.label}
      </Badge>
    </div>
  );
}

interface DialogoProps {
  abierto: boolean;
  onCerrar: () => void;
  responsable?: ResponsableCoordinacion | null;
  categoriaInicial?: CategoriaResponsabilidadCoordinacion;
  guardando?: boolean;
  error?: string | null;
  onGuardar: (responsable: ResponsableCoordinacion) => void;
}

/** Diálogo flotante para crear o editar un responsable de coordinación. */
export function DialogoResponsableCoordinacion({
  abierto,
  onCerrar,
  responsable,
  categoriaInicial,
  guardando = false,
  error = null,
  onGuardar,
}: DialogoProps) {
  const esEdicion = responsable != null;
  const [borrador, setBorrador] = useState<ResponsableCoordinacion>(
    responsable ?? responsableCoordinacionVacio(categoriaInicial),
  );

  useEffect(() => {
    if (!abierto) return;
    setBorrador(responsable ?? responsableCoordinacionVacio(categoriaInicial));
  }, [abierto, responsable, categoriaInicial]);

  function guardar() {
    onGuardar(normalizarResponsableCoordinacion(borrador));
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="text-base">
            {esEdicion ? "Editar responsable" : "Nuevo responsable"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registra contacto, rol, personal desplegado, logística y transporte.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-4 py-4 sm:px-6">
          <CamposResponsableCoordinacion
            valor={borrador}
            onChange={(patch) => setBorrador((prev) => ({ ...prev, ...patch }))}
          />
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-row gap-2 border-t border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" size="sm" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-teal-600 hover:bg-teal-500"
            disabled={guardando || !borrador.nombre.trim()}
            onClick={guardar}
          >
            {guardando ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Guardando…
              </>
            ) : esEdicion ? (
              "Guardar cambios"
            ) : (
              "Registrar responsable"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
