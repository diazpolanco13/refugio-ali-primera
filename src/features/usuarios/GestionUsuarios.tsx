import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Users } from "lucide-react";
import { api, type UsuarioRegistro } from "@/data/api";
import type { Rol } from "@/data/auth";
import { INFO_ROLES, ROLES } from "@/domain/permisos";
import { BadgeRol } from "@/components/BadgeRol";
import { PanelFlotante } from "@/components/PanelFlotante";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface Props {
  usuarioActualId: string;
  onCerrar: () => void;
}

type Formulario = {
  username: string;
  password: string;
  nombre: string;
  rol: Rol;
};

const formVacio = (): Formulario => ({
  username: "",
  password: "",
  nombre: "",
  rol: "campo",
});

function FormUsuario({
  titulo,
  descripcion,
  inicial,
  esEdicion,
  abierto,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  descripcion?: string;
  inicial: Formulario;
  esEdicion: boolean;
  abierto: boolean;
  onGuardar: (f: Formulario) => Promise<void>;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setForm(inicial);
  }, [abierto, inicial]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      await onGuardar(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-4 py-3">
            {!esEdicion && (
              <div className="space-y-1.5">
                <Label htmlFor="usuario-login">Usuario (login)</Label>
                <Input
                  id="usuario-login"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  autoFocus
                  required
                  minLength={3}
                  disabled={guardando}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="usuario-nombre">Nombre visible</Label>
              <Input
                id="usuario-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Opcional"
                disabled={guardando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-password">
                {esEdicion ? "Nueva contraseña (opcional)" : "Contraseña"}
              </Label>
              <Input
                id="usuario-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required={!esEdicion}
                minLength={6}
                placeholder={esEdicion ? "Dejar vacío para no cambiar" : undefined}
                disabled={guardando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-rol">Rol / permisos</Label>
              <select
                id="usuario-rol"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                value={form.rol}
                disabled={guardando}
                onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {INFO_ROLES[r].etiqueta}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-snug text-muted-foreground">
                {INFO_ROLES[form.rol].descripcion}
              </p>
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter className="border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GestionUsuarios({ usuarioActualId, onCerrar }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioRegistro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioRegistro | null>(null);

  const recargar = useCallback(async () => {
    setError("");
    setCargando(true);
    try {
      setUsuarios(await api.listarUsuarios());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar usuarios");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function crear(form: Formulario) {
    await api.crearUsuario({
      username: form.username.trim(),
      password: form.password,
      nombre: form.nombre.trim() || undefined,
      rol: form.rol,
    });
    setCreando(false);
    await recargar();
  }

  async function actualizar(form: Formulario) {
    if (!editando) return;
    await api.actualizarUsuario(editando.id, {
      nombre: form.nombre.trim() || null,
      rol: form.rol,
      ...(form.password ? { password: form.password } : {}),
    });
    setEditando(null);
    await recargar();
  }

  return (
    <>
      <PanelFlotante
        titulo="Usuarios"
        descripcion="Roles y permisos de acceso"
        icono={<Users className="size-4 text-primary" />}
        onCerrar={onCerrar}
        className="z-30 md:w-[min(100%,28rem)]"
      >
        <Button className="mb-3 w-full" onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nuevo usuario
        </Button>

        <Card size="sm" className="mb-3 py-2">
          <CardContent className="px-3 py-1">
            <p className="mb-2 text-xs font-medium text-foreground">Permisos por rol</p>
            <ul className="space-y-2">
              {ROLES.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[11px] leading-snug">
                  <BadgeRol rol={r} className="shrink-0" />
                  <span className="text-muted-foreground">{INFO_ROLES[r].descripcion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Cargando usuarios…
          </div>
        ) : usuarios.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay usuarios</p>
        ) : (
          <ul className="space-y-2">
            {usuarios.map((u) => (
              <Card key={u.id} size="sm" className="py-2">
                <CardContent className="flex items-start justify-between gap-2 px-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {u.nombre || u.username}
                      {u.id === usuarioActualId && (
                        <Badge variant="outline" className="ml-1.5 border-primary/40 text-[10px] text-primary">
                          tú
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                    <div className="mt-1.5">
                      <BadgeRol rol={u.rol} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setEditando(u)}
                  >
                    <Pencil className="size-3" />
                    Editar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </PanelFlotante>

      <FormUsuario
        titulo="Nuevo usuario"
        descripcion="Crea una cuenta con rol y permisos definidos."
        inicial={formVacio()}
        esEdicion={false}
        abierto={creando}
        onGuardar={crear}
        onCerrar={() => setCreando(false)}
      />

      <FormUsuario
        titulo={`Editar — ${editando?.username ?? ""}`}
        inicial={{
          username: editando?.username ?? "",
          password: "",
          nombre: editando?.nombre ?? "",
          rol: editando?.rol ?? "campo",
        }}
        esEdicion
        abierto={editando != null}
        onGuardar={actualizar}
        onCerrar={() => setEditando(null)}
      />
    </>
  );
}
