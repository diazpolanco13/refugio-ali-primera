import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronsUpDown,
  Fingerprint,
  IdCard,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { Rol, Sesion } from "@/data/authSupabase";
import { supabase } from "@/data/supabaseClient";
import { invocarEdgeFunction } from "@/data/edgeFunctions";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  INFO_ROLES,
  puedeGestionarUsuarios,
  ROLES,
  rolUsaCentrosAsignados,
} from "@/domain/permisos";
import { BadgeRol } from "@/components/BadgeRol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Fila de la tabla `perfiles` en Supabase (vinculada a `auth.users` por
 * `user_id`).
 */
interface UsuarioPerfil {
  user_id: string;
  username: string | null;
  nombre: string | null;
  rol: Rol;
  centros_asignados: string[] | null;
  jerarquia: string | null;
  cedula: string | null;
  responsabilidad: string | null;
  whatsapp: string | null;
  telegram: string | null;
  brazalete: string | null;
  hash_id: string | null;
  marca_agua: boolean;
  created_at?: string;
}

type Formulario = {
  username: string;
  password: string;
  nombre: string;
  rol: Rol;
  centros_asignados: string[];
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
  rol: "operador",
  centros_asignados: [],
  jerarquia: "",
  cedula: "",
  responsabilidad: "",
  whatsapp: "",
  telegram: "",
  brazalete: "",
  marca_agua: true,
});

/** Etiqueta corta de un centro para chips y opciones: "N.° 12 · Nombre". */
function etiquetaCentro(centro: CentroTransitorio | undefined, id: string): string {
  if (!centro) return id;
  return `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`;
}

/**
 * Multi-select de centros asignados: popover con buscador (Command) y chips
 * removibles debajo. Reemplaza al selector único de `sector_asignado`.
 */
function SelectorCentros({
  centros,
  seleccion,
  onCambiar,
  disabled,
}: {
  centros: CentroTransitorio[];
  seleccion: string[];
  onCambiar: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const porId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros]);
  const todosSeleccionados =
    centros.length > 0 && centros.every((c) => seleccion.includes(c.id));

  function toggle(id: string) {
    onCambiar(
      seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id],
    );
  }

  function toggleTodos() {
    onCambiar(todosSeleccionados ? [] : centros.map((c) => c.id));
  }

  return (
    <div className="space-y-1.5">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            disabled={disabled}
            className="h-8 w-full justify-between px-2.5 text-sm font-normal"
          >
            <span className="truncate text-left">
              {seleccion.length === 0
                ? "Sin centros asignados"
                : todosSeleccionados
                  ? `Todos los centros (${centros.length})`
                  : `${seleccion.length} centro${seleccion.length === 1 ? "" : "s"} asignado${seleccion.length === 1 ? "" : "s"}`}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar centro…" />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__todos__ todos los centros toda la red"
                  onSelect={toggleTodos}
                  className="font-medium"
                >
                  <Check
                    className={cn("size-4", todosSeleccionados ? "opacity-100" : "opacity-0")}
                  />
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <span>Todos los centros ({centros.length})</span>
                </CommandItem>
                {centros.map((c) => {
                  const marcado = seleccion.includes(c.id);
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${c.nro ?? ""} ${c.nombre} ${c.parroquia ?? ""}`}
                      onSelect={() => toggle(c.id)}
                    >
                      <Check
                        className={cn("size-4", marcado ? "opacity-100" : "opacity-0")}
                      />
                      <span className="truncate">{etiquetaCentro(c, c.id)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {todosSeleccionados ? (
        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className="gap-1 border-primary/40 pr-1 text-[10px] text-primary"
          >
            <Building2 className="size-3" />
            Toda la red ({centros.length} centros)
            {!disabled && (
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
                onClick={() => onCambiar([])}
                aria-label="Quitar todos los centros"
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        </div>
      ) : (
        seleccion.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {seleccion.map((id) => (
              <Badge
                key={id}
                variant="outline"
                className="gap-1 pr-1 text-[10px] text-muted-foreground"
              >
                <Building2 className="size-3" />
                <span className="max-w-40 truncate">{etiquetaCentro(porId.get(id), id)}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
                    onClick={() => toggle(id)}
                    aria-label="Quitar centro"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function FormUsuario({
  titulo,
  descripcion,
  inicial,
  esEdicion,
  abierto,
  centros,
  hashId,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  descripcion?: string;
  inicial: Formulario;
  esEdicion: boolean;
  abierto: boolean;
  centros: CentroTransitorio[];
  hashId?: string | null;
  onGuardar: (f: Formulario) => Promise<void>;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Guardamos siempre los valores iniciales más recientes sin que su cambio de
  // referencia dispare un reinicio (el padre recrea `inicial` en cada render,
  // p. ej. al sincronizar centros). Solo reiniciamos al abrir el diálogo.
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

  const usaCentros = rolUsaCentrosAsignados(form.rol);

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
                    Identificador de sistema (marca de agua) — inmutable
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
                    required
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

            {/* Rol y centros */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cargo, rol y centros
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="usuario-rol">Rol / permisos del sistema</Label>
                  <Select
                    value={form.rol}
                    disabled={guardando}
                    onValueChange={(v) => set("rol", v as Rol)}
                  >
                    <SelectTrigger id="usuario-rol" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {INFO_ROLES[r].etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {INFO_ROLES[form.rol].descripcion}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Centros asignados</Label>
                  <SelectorCentros
                    centros={centros}
                    seleccion={form.centros_asignados}
                    onCambiar={(ids) => set("centros_asignados", ids)}
                    disabled={guardando || !usaCentros}
                  />
                  <p className="text-xs leading-snug text-muted-foreground">
                    {usaCentros
                      ? form.rol === "analista_sae"
                        ? "Ámbito de monitoreo del analista (su acceso operativo sigue siendo toda la red)."
                        : "El supervisor y el operador solo ven y editan sus centros asignados."
                      : "Este rol tiene alcance sobre toda la red; no necesita asignación."}
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
                    placeholder={esEdicion ? "Dejar vacío para no cambiarla" : undefined}
                    disabled={guardando}
                  />
                  {esEdicion && (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Si escribes una contraseña nueva, se aplica de inmediato y el
                      usuario deberá usarla en su próximo inicio de sesión.
                    </p>
                  )}
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

function TarjetaUsuario({
  usuario,
  esYo,
  centros,
  onEditar,
  onEliminar,
}: {
  usuario: UsuarioPerfil;
  esYo: boolean;
  centros: CentroTransitorio[];
  onEditar: () => void;
  onEliminar?: () => void;
}) {
  const porId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros]);
  const asignados = usuario.centros_asignados ?? [];
  const tieneTodaLaRed =
    centros.length > 0 && centros.every((c) => asignados.includes(c.id));

  return (
    <Card size="sm" className="py-3">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{usuario.nombre || usuario.username}</span>
              {esYo && (
                <Badge
                  variant="outline"
                  className="border-primary/40 text-[10px] text-primary"
                >
                  tú
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              @{usuario.username}
              {usuario.jerarquia && <> · {usuario.jerarquia}</>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="outline" onClick={onEditar}>
              <Pencil className="size-3" />
              Editar
            </Button>
            {onEliminar && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onEliminar}
                title="Eliminar usuario"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <BadgeRol rol={usuario.rol} />
          {usuario.hash_id && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 font-mono text-[10px] tracking-wider text-primary"
            >
              <Fingerprint className="size-3" />
              {usuario.hash_id}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[10px]",
              usuario.marca_agua
                ? "border-emerald-500/40 text-emerald-400"
                : "border-amber-500/40 text-amber-400",
            )}
            title="Marca de agua de seguridad"
          >
            <ShieldAlert className="size-3" />
            {usuario.marca_agua ? "Marca ON" : "Marca OFF"}
          </Badge>
        </div>

        {asignados.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tieneTodaLaRed ? (
              <Badge
                variant="outline"
                className="gap-1 border-primary/40 text-[10px] text-primary"
              >
                <Building2 className="size-3" />
                Toda la red ({centros.length} centros)
              </Badge>
            ) : (
              asignados.map((id) => (
                <Badge
                  key={id}
                  variant="outline"
                  className="gap-1 text-[10px] text-muted-foreground"
                >
                  <Building2 className="size-3" />
                  <span className="max-w-44 truncate">
                    {etiquetaCentro(porId.get(id), id)}
                  </span>
                </Badge>
              ))
            )}
          </div>
        )}

        {(usuario.responsabilidad ||
          usuario.cedula ||
          usuario.brazalete ||
          usuario.whatsapp ||
          usuario.telegram) && (
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2.5">
            {usuario.responsabilidad && (
              <DatoFicha icono={<BadgeCheck className="size-3" />}>
                {usuario.responsabilidad}
              </DatoFicha>
            )}
            {usuario.cedula && (
              <DatoFicha icono={<IdCard className="size-3" />}>{usuario.cedula}</DatoFicha>
            )}
            {usuario.brazalete && (
              <DatoFicha icono={<BadgeCheck className="size-3" />}>
                Brazalete {usuario.brazalete}
              </DatoFicha>
            )}
            {usuario.whatsapp && (
              <DatoFicha icono={<Phone className="size-3" />}>{usuario.whatsapp}</DatoFicha>
            )}
            {usuario.telegram && (
              <DatoFicha icono={<Send className="size-3" />}>{usuario.telegram}</DatoFicha>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GestionUsuarios({ sesion }: { sesion: Sesion }) {
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const usuarioActualId = sesion.user.sub;
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioPerfil | null>(null);
  const [eliminando, setEliminando] = useState<UsuarioPerfil | null>(null);
  const [eliminandoEnCurso, setEliminandoEnCurso] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");
  const [filtroRol, setFiltroRol] = useState<Rol | "todos">("todos");

  // Los centros se leen de Supabase para el multi-select de centros asignados.
  // `nro` vive dentro de `data` jsonb (no es columna top-level), así que el
  // orden se aplica en cliente (ver CentrosView.tsx para más detalle).
  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );

  const recargar = useCallback(async () => {
    setError("");
    setCargando(true);
    try {
      const { data, error: err } = await supabase
        .from("perfiles")
        .select("*")
        .order("username");
      if (err) throw new Error(err.message);
      setUsuarios((data ?? []) as UsuarioPerfil[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar usuarios");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) void recargar();
    // Realtime: si otro admin edita un perfil, refrescar la lista.
    const canal = supabase
      .channel("perfiles-gestion")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "perfiles" },
        () => void recargar(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [esAdmin, recargar]);

  /** Conteo por rol para las píldoras de categoría. */
  const conteos = useMemo(() => {
    const c = new Map<Rol, number>();
    for (const u of usuarios) c.set(u.rol, (c.get(u.rol) ?? 0) + 1);
    return c;
  }, [usuarios]);

  /** Usuarios visibles según el filtro, agrupados por rol (en orden del catálogo). */
  const grupos = useMemo(() => {
    const visibles =
      filtroRol === "todos" ? usuarios : usuarios.filter((u) => u.rol === filtroRol);
    return ROLES.map((rol) => ({
      rol,
      usuarios: visibles.filter((u) => u.rol === rol),
    })).filter((g) => g.usuarios.length > 0);
  }, [usuarios, filtroRol]);

  async function crear(form: Formulario) {
    await invocarEdgeFunction("create-user", {
      username: form.username.trim(),
      password: form.password,
      nombre: form.nombre.trim() || null,
      rol: form.rol,
      centros_asignados: rolUsaCentrosAsignados(form.rol) ? form.centros_asignados : [],
      jerarquia: form.jerarquia.trim() || null,
      cedula: form.cedula.trim() || null,
      responsabilidad: form.responsabilidad.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      telegram: form.telegram.trim() || null,
      brazalete: form.brazalete.trim() || null,
      marca_agua: form.marca_agua,
    });
    setCreando(false);
    await recargar();
  }

  async function actualizar(form: Formulario) {
    if (!editando) return;
    const patch: Partial<UsuarioPerfil> = {
      nombre: form.nombre.trim() || null,
      rol: form.rol,
      centros_asignados: rolUsaCentrosAsignados(form.rol) ? form.centros_asignados : [],
      jerarquia: form.jerarquia.trim() || null,
      cedula: form.cedula.trim() || null,
      responsabilidad: form.responsabilidad.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      telegram: form.telegram.trim() || null,
      brazalete: form.brazalete.trim() || null,
      marca_agua: form.marca_agua,
    };
    const { error: err } = await supabase
      .from("perfiles")
      .update(patch)
      .eq("user_id", editando.user_id);
    if (err) throw new Error(err.message);

    // Cambio de contraseña de otro usuario: Edge Function con service_role.
    if (form.password) {
      await invocarEdgeFunction("update-user-password", {
        user_id: editando.user_id,
        password: form.password,
      });
    }
    setEditando(null);
    await recargar();
  }

  async function confirmarEliminar() {
    if (!eliminando) return;
    setErrorEliminar("");
    setEliminandoEnCurso(true);
    try {
      // Borra auth.users + perfil (cascade) vía Edge Function con service_role.
      await invocarEdgeFunction("delete-user", { user_id: eliminando.user_id });
      setEliminando(null);
      await recargar();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setEliminandoEnCurso(false);
    }
  }

  return (
    <>
    <div className="h-full min-h-0 overflow-y-auto p-4 lg:p-6">
      {!esAdmin ? (
          <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo los administradores pueden gestionar usuarios.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Fichas, roles y permisos de acceso a la plataforma
              </p>
              <Button onClick={() => setCreando(true)} className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nuevo usuario</span>
              </Button>
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Filtro por categoría de rol, con conteo */}
            {!cargando && usuarios.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={filtroRol === "todos" ? "secondary" : "outline"}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => setFiltroRol("todos")}
                >
                  Todos
                  <span className="text-muted-foreground">{usuarios.length}</span>
                </Button>
                {ROLES.map((rol) => {
                  const n = conteos.get(rol) ?? 0;
                  if (n === 0) return null;
                  return (
                    <Button
                      key={rol}
                      size="sm"
                      variant={filtroRol === rol ? "secondary" : "outline"}
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={() => setFiltroRol(filtroRol === rol ? "todos" : rol)}
                    >
                      {INFO_ROLES[rol].etiqueta}
                      <span className="text-muted-foreground">{n}</span>
                    </Button>
                  );
                })}
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
              grupos.map(({ rol, usuarios: lista }) => (
                <section key={rol} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BadgeRol rol={rol} />
                    <span className="text-xs text-muted-foreground">
                      {lista.length} usuario{lista.length === 1 ? "" : "s"}
                    </span>
                    <span
                      className="hidden truncate text-[11px] text-muted-foreground/70 sm:inline"
                      title={INFO_ROLES[rol].descripcion}
                    >
                      — {INFO_ROLES[rol].descripcion}
                    </span>
                  </div>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {lista.map((u) => (
                      <TarjetaUsuario
                        key={u.user_id}
                        usuario={u}
                        esYo={u.user_id === usuarioActualId}
                        centros={centros}
                        onEditar={() => setEditando(u)}
                        onEliminar={
                          u.user_id !== usuarioActualId
                            ? () => {
                                setErrorEliminar("");
                                setEliminando(u);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}
    </div>

      <FormUsuario
        titulo="Nuevo usuario"
        descripcion="Crea la ficha completa con rol, centros asignados y permisos definidos."
        inicial={formVacio()}
        esEdicion={false}
        abierto={creando}
        centros={centros}
        onGuardar={crear}
        onCerrar={() => setCreando(false)}
      />

      <FormUsuario
        titulo={`Editar — ${editando?.nombre || editando?.username || ""}`}
        inicial={{
          username: editando?.username ?? "",
          password: "",
          nombre: editando?.nombre ?? "",
          rol: editando?.rol ?? "operador",
          centros_asignados: editando?.centros_asignados ?? [],
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
        centros={centros}
        hashId={editando?.hash_id}
        onGuardar={actualizar}
        onCerrar={() => setEditando(null)}
      />

      {/* Confirmación de eliminación: borra el perfil Y el registro de
          autenticación (Edge Function `delete-user` con service_role). */}
      <Dialog
        open={eliminando != null}
        onOpenChange={(o) => !o && setEliminando(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar a{" "}
              <span className="font-medium text-foreground">
                {eliminando?.nombre || eliminando?.username}
              </span>
              ? Se borra su cuenta de acceso y su ficha. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          {errorEliminar && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorEliminar}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEliminando(null)}
              disabled={eliminandoEnCurso}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmarEliminar()}
              disabled={eliminandoEnCurso}
            >
              {eliminandoEnCurso ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
