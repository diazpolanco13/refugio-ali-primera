import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  BadgeCheck,
  Fingerprint,
  IdCard,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, type UsuarioRegistro } from "@/data/api";
import type { Rol, Sesion } from "@/data/auth";
import { db } from "@/data/db";
import type { Sector } from "@/domain/tipos";
import { INFO_ROLES, puedeGestionarUsuarios, ROLES } from "@/domain/permisos";
import { BadgeRol } from "@/components/BadgeRol";
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
import { cn } from "@/lib/utils";

type Formulario = {
  username: string;
  password: string;
  nombre: string;
  rol: Rol;
  sector_asignado: string;
  jerarquia: string;
  cedula: string;
  responsabilidad: string;
  whatsapp: string;
  telegram: string;
  brazalete: string;
  marca_agua: boolean;
};

const formVacio = (): Formulario => ({
  username: "",
  password: "",
  nombre: "",
  rol: "campo",
  sector_asignado: "",
  jerarquia: "",
  cedula: "",
  responsabilidad: "",
  whatsapp: "",
  telegram: "",
  brazalete: "",
  marca_agua: true,
});

const inputClase =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

function FormUsuario({
  titulo,
  descripcion,
  inicial,
  esEdicion,
  abierto,
  sectores,
  hashId,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  descripcion?: string;
  inicial: Formulario;
  esEdicion: boolean;
  abierto: boolean;
  sectores: Sector[];
  hashId?: string | null;
  onGuardar: (f: Formulario) => Promise<void>;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Guardamos siempre los valores iniciales más recientes sin que su cambio de
  // referencia dispare un reinicio (el padre recrea `inicial` en cada render,
  // p. ej. al sincronizar sectores). Solo reiniciamos al abrir el diálogo.
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;
  const estabaAbierto = useRef(false);

  useEffect(() => {
    if (abierto && !estabaAbierto.current) {
      setForm(inicialRef.current);
      setError("");
    }
    estabaAbierto.current = abierto;
  }, [abierto]);

  function set<K extends keyof Formulario>(k: K, v: Formulario[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

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
        className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto px-4 py-4">
            {esEdicion && hashId && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <Fingerprint className="size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Identificador de sistema (marca de agua)
                  </p>
                  <p className="font-mono text-sm font-semibold tracking-wider text-foreground">
                    {hashId}
                  </p>
                </div>
              </div>
            )}

            {/* Identidad */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identidad
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="usuario-nombre">Nombre y apellido</Label>
                  <Input
                    id="usuario-nombre"
                    value={form.nombre}
                    onChange={(e) => set("nombre", e.target.value)}
                    placeholder="Ej. María Pérez"
                    disabled={guardando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-cedula">Cédula</Label>
                  <Input
                    id="usuario-cedula"
                    value={form.cedula}
                    onChange={(e) => set("cedula", e.target.value)}
                    placeholder="V-12345678"
                    disabled={guardando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-brazalete">Código de brazalete</Label>
                  <Input
                    id="usuario-brazalete"
                    value={form.brazalete}
                    onChange={(e) => set("brazalete", e.target.value)}
                    placeholder="Ej. BRZ-045"
                    disabled={guardando}
                  />
                </div>
              </div>
            </section>

            {/* Rol y funciones */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cargo y responsabilidad
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-jerarquia">Jerarquía / cargo</Label>
                  <Input
                    id="usuario-jerarquia"
                    value={form.jerarquia}
                    onChange={(e) => set("jerarquia", e.target.value)}
                    placeholder="Ej. Coordinador general"
                    disabled={guardando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-responsabilidad">Responsabilidad</Label>
                  <Input
                    id="usuario-responsabilidad"
                    value={form.responsabilidad}
                    onChange={(e) => set("responsabilidad", e.target.value)}
                    placeholder="Ej. Logística de alimentación"
                    disabled={guardando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-rol">Rol / permisos del sistema</Label>
                  <select
                    id="usuario-rol"
                    className={inputClase}
                    value={form.rol}
                    disabled={guardando}
                    onChange={(e) => set("rol", e.target.value as Rol)}
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
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-sector">Sector asignado (responsable)</Label>
                  <select
                    id="usuario-sector"
                    className={inputClase}
                    value={form.sector_asignado}
                    disabled={guardando}
                    onChange={(e) => set("sector_asignado", e.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {sectores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre || s.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-snug text-muted-foreground">
                    El responsable de campo solo marca la comida/aseo de su sector.
                  </p>
                </div>
              </div>
            </section>

            {/* Contacto */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contacto
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-whatsapp">Teléfono de WhatsApp</Label>
                  <Input
                    id="usuario-whatsapp"
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="+58 412 000 0000"
                    disabled={guardando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-telegram">Teléfono de Telegram</Label>
                  <Input
                    id="usuario-telegram"
                    type="tel"
                    value={form.telegram}
                    onChange={(e) => set("telegram", e.target.value)}
                    placeholder="+58 412 000 0000"
                    disabled={guardando}
                  />
                </div>
              </div>
            </section>

            {/* Seguridad */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Seguridad
              </p>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-input px-3 py-2.5",
                  form.marca_agua && "border-primary/40 bg-primary/5",
                  guardando && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={form.marca_agua}
                  disabled={guardando}
                  onChange={(e) => set("marca_agua", e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <ShieldAlert className="size-4 text-primary" />
                    Marca de agua de seguridad
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    Superpone la identidad del usuario y la hora sobre la pantalla
                    para disuadir y trazar fotografías. No afecta el uso del mapa.
                  </span>
                </span>
              </label>
            </section>

            {/* Credenciales de acceso */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Credenciales de acceso
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {!esEdicion && (
                  <div className="space-y-1.5">
                    <Label htmlFor="usuario-login">Usuario (login)</Label>
                    <Input
                      id="usuario-login"
                      value={form.username}
                      onChange={(e) => set("username", e.target.value)}
                      required
                      minLength={3}
                      disabled={guardando}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-password">
                    {esEdicion ? "Nueva contraseña (opcional)" : "Contraseña"}
                  </Label>
                  <Input
                    id="usuario-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    required={!esEdicion}
                    minLength={6}
                    placeholder={esEdicion ? "Dejar vacío para no cambiar" : undefined}
                    disabled={guardando}
                  />
                </div>
              </div>
            </section>

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

function DatoFicha({
  icono,
  children,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icono}
      {children}
    </span>
  );
}

export function GestionUsuarios({ sesion }: { sesion: Sesion }) {
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const usuarioActualId = sesion.user.sub;
  const [usuarios, setUsuarios] = useState<UsuarioRegistro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioRegistro | null>(null);
  const sectores = useLiveQuery(() => db.sectores.toArray(), [], [] as Sector[]);

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
    if (esAdmin) void recargar();
  }, [esAdmin, recargar]);

  async function crear(form: Formulario) {
    await api.crearUsuario({
      username: form.username.trim(),
      password: form.password,
      nombre: form.nombre.trim() || undefined,
      rol: form.rol,
      sector_asignado: form.sector_asignado || undefined,
      jerarquia: form.jerarquia.trim() || undefined,
      cedula: form.cedula.trim() || undefined,
      responsabilidad: form.responsabilidad.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      telegram: form.telegram.trim() || undefined,
      brazalete: form.brazalete.trim() || undefined,
      marca_agua: form.marca_agua,
    });
    setCreando(false);
    await recargar();
  }

  async function actualizar(form: Formulario) {
    if (!editando) return;
    await api.actualizarUsuario(editando.id, {
      nombre: form.nombre.trim() || null,
      rol: form.rol,
      sector_asignado: form.sector_asignado || null,
      jerarquia: form.jerarquia.trim() || null,
      cedula: form.cedula.trim() || null,
      responsabilidad: form.responsabilidad.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      telegram: form.telegram.trim() || null,
      brazalete: form.brazalete.trim() || null,
      marca_agua: form.marca_agua,
      ...(form.password ? { password: form.password } : {}),
    });
    setEditando(null);
    await recargar();
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Cabecera */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link to="/">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Mapa</span>
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Users className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight text-foreground lg:text-xl">
                Gestión de usuarios
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Fichas, roles y permisos de acceso a la plataforma
              </p>
            </div>
          </div>
        </div>
        {esAdmin && (
          <Button onClick={() => setCreando(true)} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nuevo usuario</span>
          </Button>
        )}
      </header>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        {!esAdmin ? (
          <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card/60 p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo los administradores pueden gestionar usuarios.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {cargando ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Cargando usuarios…
              </div>
            ) : usuarios.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No hay usuarios registrados
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {usuarios.map((u) => (
                  <Card key={u.id} size="sm" className="py-3">
                    <CardContent className="px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <span className="truncate">{u.nombre || u.username}</span>
                            {u.id === usuarioActualId && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-[10px] text-primary"
                              >
                                tú
                              </Badge>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            @{u.username}
                            {u.jerarquia && <> · {u.jerarquia}</>}
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
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <BadgeRol rol={u.rol} />
                        {u.sector_asignado && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {sectores.find((s) => s.id === u.sector_asignado)?.nombre ??
                              "Sector asignado"}
                          </Badge>
                        )}
                        {u.hash_id && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-primary/30 font-mono text-[10px] tracking-wider text-primary"
                          >
                            <Fingerprint className="size-3" />
                            {u.hash_id}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-[10px]",
                            u.marca_agua
                              ? "border-emerald-500/40 text-emerald-400"
                              : "border-amber-500/40 text-amber-400",
                          )}
                          title="Marca de agua de seguridad"
                        >
                          <ShieldAlert className="size-3" />
                          {u.marca_agua ? "Marca ON" : "Marca OFF"}
                        </Badge>
                      </div>

                      {(u.responsabilidad ||
                        u.cedula ||
                        u.brazalete ||
                        u.whatsapp ||
                        u.telegram) && (
                        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2.5">
                          {u.responsabilidad && (
                            <DatoFicha icono={<BadgeCheck className="size-3" />}>
                              {u.responsabilidad}
                            </DatoFicha>
                          )}
                          {u.cedula && (
                            <DatoFicha icono={<IdCard className="size-3" />}>
                              {u.cedula}
                            </DatoFicha>
                          )}
                          {u.brazalete && (
                            <DatoFicha icono={<BadgeCheck className="size-3" />}>
                              Brazalete {u.brazalete}
                            </DatoFicha>
                          )}
                          {u.whatsapp && (
                            <DatoFicha icono={<Phone className="size-3" />}>
                              {u.whatsapp}
                            </DatoFicha>
                          )}
                          {u.telegram && (
                            <DatoFicha icono={<Send className="size-3" />}>
                              {u.telegram}
                            </DatoFicha>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <FormUsuario
        titulo="Nuevo usuario"
        descripcion="Crea la ficha completa con rol y permisos definidos."
        inicial={formVacio()}
        esEdicion={false}
        abierto={creando}
        sectores={sectores}
        onGuardar={crear}
        onCerrar={() => setCreando(false)}
      />

      <FormUsuario
        titulo={`Editar — ${editando?.nombre || editando?.username || ""}`}
        inicial={{
          username: editando?.username ?? "",
          password: "",
          nombre: editando?.nombre ?? "",
          rol: editando?.rol ?? "campo",
          sector_asignado: editando?.sector_asignado ?? "",
          jerarquia: editando?.jerarquia ?? "",
          cedula: editando?.cedula ?? "",
          responsabilidad: editando?.responsabilidad ?? "",
          whatsapp: editando?.whatsapp ?? "",
          telegram: editando?.telegram ?? "",
          brazalete: editando?.brazalete ?? "",
          marca_agua: editando?.marca_agua ?? true,
        }}
        esEdicion
        abierto={editando != null}
        sectores={sectores}
        hashId={editando?.hash_id}
        onGuardar={actualizar}
        onCerrar={() => setEditando(null)}
      />
    </div>
  );
}
