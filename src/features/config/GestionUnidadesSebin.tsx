// Administración del catálogo de unidades internas SEBIN (`/config/unidades-sebin`).

import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import {
  useGestionUnidadesSebin,
  type UnidadSebinInput,
} from "@/data/useUnidadesSebin";
import { puedeGestionarUnidadesSebin } from "@/domain/permisos";
import { slugUnidadSebin, type MetaUnidadSebin } from "@/domain/unidadesSebin";
import { VistaPagina } from "@/components/VistaPagina";
import { LoadingTable } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
}

const COLORES_SUGERIDOS = [
  "#2563eb",
  "#0891b2",
  "#0d9488",
  "#059669",
  "#ca8a04",
  "#d97706",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#e11d48",
  "#4f46e5",
  "#65a30d",
  "#64748b",
];

function formVacio(ordenSiguiente: number): UnidadSebinInput {
  return {
    clave: "",
    label: "",
    valor_db: "",
    color: COLORES_SUGERIDOS[ordenSiguiente % COLORES_SUGERIDOS.length] ?? "#64748b",
    orden: ordenSiguiente,
    activo: true,
  };
}

function desdeMeta(u: MetaUnidadSebin): UnidadSebinInput {
  return {
    clave: u.clave,
    label: u.label,
    valor_db: u.valorDb,
    color: u.color,
    orden: u.orden ?? 100,
    activo: u.activo !== false,
  };
}

export function GestionUnidadesSebin({ sesion }: Props) {
  const puede = puedeGestionarUnidadesSebin(sesion.user.rol);
  const { unidades, cargando, error, guardar, eliminar } = useGestionUnidadesSebin();
  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [form, setForm] = useState<UnidadSebinInput>(() => formVacio(10));
  const [claveOriginal, setClaveOriginal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<MetaUnidadSebin | null>(null);
  const [eliminandoEnCurso, setEliminandoEnCurso] = useState(false);

  const ordenSiguiente = useMemo(() => {
    const max = unidades
      .filter((u) => u.clave !== "sin_asignar")
      .reduce((m, u) => Math.max(m, u.orden ?? 0), 0);
    return max + 10;
  }, [unidades]);

  if (!puede) {
    return <Navigate to="/centros/mapa" replace />;
  }

  function abrirNuevo() {
    setForm(formVacio(ordenSiguiente));
    setClaveOriginal(null);
    setErrorForm(null);
    setDialogo("nuevo");
  }

  function abrirEditar(u: MetaUnidadSebin) {
    setForm(desdeMeta(u));
    setClaveOriginal(u.clave);
    setErrorForm(null);
    setDialogo("editar");
  }

  function cerrarDialogo() {
    if (guardando) return;
    setDialogo(null);
    setErrorForm(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    const label = form.label.trim();
    if (!label) {
      setErrorForm("La etiqueta es obligatoria.");
      return;
    }
    let clave = form.clave.trim();
    if (dialogo === "nuevo") {
      clave = clave || slugUnidadSebin(label);
      if (!/^[a-z][a-z0-9_]{1,62}$/.test(clave)) {
        setErrorForm("La clave debe ser un slug (ej. dir_nueva_unidad).");
        return;
      }
      if (unidades.some((u) => u.clave === clave)) {
        setErrorForm("Ya existe una unidad con esa clave.");
        return;
      }
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.color.trim())) {
      setErrorForm("El color debe ser hex de 6 dígitos (ej. #2563eb).");
      return;
    }
    setGuardando(true);
    try {
      await guardar(
        {
          ...form,
          clave: dialogo === "nuevo" ? clave : (claveOriginal ?? form.clave),
          label,
          valor_db:
            form.valor_db.trim() ||
            (clave === "sin_asignar" ? "" : `${label} - SEBIN`),
        },
        dialogo === "nuevo",
      );
      setDialogo(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!eliminando) return;
    setEliminandoEnCurso(true);
    try {
      await eliminar(eliminando.clave);
      setEliminando(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo eliminar.");
      setEliminando(null);
    } finally {
      setEliminandoEnCurso(false);
    }
  }

  return (
    <>
      <VistaPagina
        icono={Shield}
        acento="sky"
        titulo="Unidades SEBIN"
        descripcion="Direcciones internas asignables a campamentos (panel, mapa y ficha)"
        acciones={
          <Button onClick={abrirNuevo} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nueva unidad</span>
          </Button>
        }
        cuerpoClassName="p-4 lg:p-6"
      >
        <div className="space-y-4">
          {(error || errorForm) && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorForm ?? error}
            </div>
          )}

          {cargando && unidades.length === 0 ? (
            <LoadingTable rows={6} cols={4} conToolbar={false} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {unidades.map((u) => (
                <li
                  key={u.clave}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4",
                    u.activo === false && "opacity-50",
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-full ring-1 ring-white/20"
                    style={{ backgroundColor: u.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{u.label}</span>
                      {u.clave === "sin_asignar" && (
                        <Badge variant="outline" className="text-[10px]">
                          Sistema
                        </Badge>
                      )}
                      {u.activo === false && (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{u.clave}</span>
                      {u.valorDb ? ` · ${u.valorDb}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    orden {u.orden ?? "—"}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Editar"
                      onClick={() => abrirEditar(u)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {u.clave !== "sin_asignar" && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        title="Eliminar"
                        onClick={() => setEliminando(u)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground">
            Al crear o editar una unidad, el panel del mapa y los selectores de asignación se
            actualizan solos. Si un campamento ya tenía un valor viejo, seguirá resolviéndose
            mientras la unidad exista (aunque esté inactiva).
          </p>
        </div>
      </VistaPagina>

      <Dialog open={dialogo != null} onOpenChange={(a) => !a && cerrarDialogo()}>
        <DialogContent className="sm:max-w-md" showCloseButton={!guardando}>
          <form onSubmit={(e) => void onSubmit(e)}>
            <DialogHeader>
              <DialogTitle>
                {dialogo === "nuevo" ? "Nueva unidad SEBIN" : "Editar unidad"}
              </DialogTitle>
              <DialogDescription>
                Aparecerá en el panel del mapa y en la asignación operativa del campamento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="unidad-label">Etiqueta</Label>
                <Input
                  id="unidad-label"
                  className="mt-1.5"
                  value={form.label}
                  disabled={guardando}
                  onChange={(e) => {
                    const label = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      label,
                      clave:
                        dialogo === "nuevo" && !claveOriginal
                          ? slugUnidadSebin(label)
                          : prev.clave,
                      valor_db:
                        prev.valor_db === "" ||
                        prev.valor_db === `${prev.label} - SEBIN`
                          ? label.trim()
                            ? `${label.trim()} - SEBIN`
                            : ""
                          : prev.valor_db,
                    }));
                  }}
                  placeholder="DIR. NUEVA"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="unidad-clave">Clave (slug)</Label>
                <Input
                  id="unidad-clave"
                  className="mt-1.5 font-mono text-xs"
                  value={form.clave}
                  disabled={guardando || dialogo === "editar"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    }))
                  }
                  placeholder="dir_nueva"
                />
                {dialogo === "editar" && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    La clave no se puede cambiar (identifica la unidad en los campamentos).
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="unidad-valor">Valor guardado en el campamento</Label>
                <Input
                  id="unidad-valor"
                  className="mt-1.5"
                  value={form.valor_db}
                  disabled={guardando || form.clave === "sin_asignar"}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor_db: e.target.value }))}
                  placeholder="DIR. NUEVA - SEBIN"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="unidad-orden">Orden</Label>
                  <Input
                    id="unidad-orden"
                    type="number"
                    className="mt-1.5"
                    value={form.orden}
                    disabled={guardando}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        orden: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="unidad-color">Color</Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id="unidad-color"
                      type="color"
                      className="size-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                      value={form.color}
                      disabled={guardando}
                      onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                    />
                    <Input
                      className="font-mono text-xs"
                      value={form.color}
                      disabled={guardando}
                      onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {COLORES_SUGERIDOS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform hover:scale-110",
                      form.color.toLowerCase() === c.toLowerCase()
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                    disabled={guardando}
                  />
                ))}
              </div>

              {form.clave !== "sin_asignar" && (
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Activa</p>
                    <p className="text-[10px] text-muted-foreground">
                      Si la desactivás, no aparece en selectores nuevos.
                    </p>
                  </div>
                  <Switch
                    checked={form.activo}
                    disabled={guardando}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, activo: v }))}
                  />
                </div>
              )}

              {errorForm && (
                <p className="text-xs text-destructive">{errorForm}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={guardando} onClick={cerrarDialogo}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
                {dialogo === "nuevo" ? "Crear" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={eliminando != null}
        onOpenChange={(a) => !a && !eliminandoEnCurso && setEliminando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{eliminando?.label}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Los campamentos que ya tenían esta unidad quedarán como «Sin unidad» en el mapa
              hasta que los reasignés. Preferí desactivar si solo querés ocultarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminandoEnCurso}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={eliminandoEnCurso}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminar();
              }}
            >
              {eliminandoEnCurso ? <Loader2 className="size-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
