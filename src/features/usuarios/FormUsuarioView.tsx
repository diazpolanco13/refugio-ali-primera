// Alta y edición de usuarios a pantalla completa (`/usuarios/nuevo` y
// `/usuarios/:userId/editar`). Reemplaza al diálogo modal: con el ancho
// completo, el flujo se organiza en 3 columnas (identidad/contacto · rol,
// alcance y campamentos · seguridad/credenciales) y el selector de
// campamentos vive abierto, agrupado por cuerpo policial.

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  Fingerprint,
  Loader2,
  Pencil,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";
import type { AmbitoAnalista, Rol, Sesion } from "@/data/authSupabase";
import { supabase } from "@/data/supabaseClient";
import { useCatalogoCuerposActivos } from "@/data/useCuerposPoliciales";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import {
  normalizarCuerpo,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  esAnalistaDeRed,
  INFO_ROLES,
  puedeGestionarOperadores,
  puedeGestionarUsuarios,
  ROLES,
  rolUsaCentrosAsignados,
} from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { cn } from "@/lib/utils";
import {
  actualizarUsuario,
  crearUsuario,
  formDesdePerfil,
  formVacio,
  type Formulario,
} from "./formUsuario";
import { etiquetaCentro, type UsuarioPerfil } from "./TarjetaUsuario";
import { VinculoTelegramUsuario } from "./VinculoTelegramUsuario";

/**
 * Selector de campamentos SIEMPRE abierto (sin popover): buscador + lista
 * agrupada por cuerpo policial con atajos "Todos" y "Todos los de <cuerpo>".
 */
function SelectorCentrosInline({
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
  const cuerposCatalogo = useCatalogoCuerposActivos();
  const porId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros]);
  const todosSeleccionados =
    centros.length > 0 && centros.every((c) => seleccion.includes(c.id));

  const grupos = useMemo(() => {
    const porCuerpo = new Map<string, CentroTransitorio[]>();
    for (const c of centros) {
      const clave = normalizarCuerpo(c.cuerpo);
      const lista = porCuerpo.get(clave);
      if (lista) lista.push(c);
      else porCuerpo.set(clave, [c]);
    }
    const resultado: { clave: string; label: string; centros: CentroTransitorio[] }[] = [];
    for (const meta of cuerposCatalogo) {
      const lista = porCuerpo.get(meta.clave);
      if (!lista || meta.clave === "sin_asignar") continue;
      resultado.push({ clave: meta.clave, label: meta.label, centros: lista });
    }
    const sinCuerpo = porCuerpo.get("sin_asignar");
    if (sinCuerpo?.length) {
      resultado.push({ clave: "sin_asignar", label: "Sin cuerpo asignado", centros: sinCuerpo });
    }
    return resultado;
  }, [centros, cuerposCatalogo]);

  function toggle(id: string) {
    if (disabled) return;
    onCambiar(
      seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id],
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {todosSeleccionados ? (
          <Badge
            variant="outline"
            className="gap-1 border-primary/40 pr-1 text-[10px] text-primary"
          >
            <Building2 className="size-3" />
            Toda la red ({centros.length} campamentos)
            {!disabled && (
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
                onClick={() => onCambiar([])}
                aria-label="Quitar todos los campamentos"
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ) : seleccion.length > 0 ? (
          <>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {seleccion.length} seleccionado{seleccion.length === 1 ? "" : "s"}
            </Badge>
            {seleccion.map((id) => (
              <Badge
                key={id}
                variant="outline"
                className="gap-1 pr-1 text-[10px] text-muted-foreground"
              >
                <span className="max-w-40 truncate">{etiquetaCentro(porId.get(id), id)}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-accent hover:text-foreground"
                    onClick={() => toggle(id)}
                    aria-label="Quitar campamento"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Sin campamentos asignados.</span>
        )}
      </div>

      <Command className="rounded-lg border border-input">
        <CommandInput placeholder="Buscar campamento o cuerpo…" disabled={disabled} />
        <CommandList className="max-h-72">
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="__todos__ todos los campamentos toda la red"
              disabled={disabled}
              onSelect={() =>
                onCambiar(todosSeleccionados ? [] : centros.map((c) => c.id))
              }
              className="font-medium"
            >
              <Check
                className={cn("size-4", todosSeleccionados ? "opacity-100" : "opacity-0")}
              />
              <Building2 className="size-3.5 text-muted-foreground" />
              <span>Todos los campamentos ({centros.length})</span>
            </CommandItem>
          </CommandGroup>
          {grupos.map((g) => {
            const grupoCompleto = g.centros.every((c) => seleccion.includes(c.id));
            return (
              <CommandGroup key={g.clave} heading={`${g.label} (${g.centros.length})`}>
                <CommandItem
                  value={`__cuerpo__ ${g.label} todos los campamentos del cuerpo`}
                  disabled={disabled}
                  onSelect={() => {
                    const ids = g.centros.map((c) => c.id);
                    onCambiar(
                      grupoCompleto
                        ? seleccion.filter((s) => !ids.includes(s))
                        : [...new Set([...seleccion, ...ids])],
                    );
                  }}
                  className="font-medium"
                >
                  <Check
                    className={cn("size-4", grupoCompleto ? "opacity-100" : "opacity-0")}
                  />
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <span>Todos los de {g.label}</span>
                </CommandItem>
                {g.centros.map((c) => {
                  const marcado = seleccion.includes(c.id);
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${g.label} ${c.nro ?? ""} ${c.nombre} ${c.parroquia ?? ""}`}
                      disabled={disabled}
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
            );
          })}
        </CommandList>
      </Command>
    </div>
  );
}

function SeccionCard({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/**
 * Vista a pantalla completa de alta/edición de usuario. Admin: cualquier rol.
 * Analista (plan migración operadores §5): operadores y supervisores; el
 * supervisor solo operadores. Alta de operador scoped: rol fijo, cédula
 * obligatoria, usuario `op-<cédula>` autogenerado. Alta de supervisor por
 * analista: credencial libre, con ámbito y campamentos dentro de su alcance.
 * La edge `create-user` re-valida todo en el servidor.
 */
export function FormUsuarioView({ sesion }: { sesion: Sesion }) {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const esEdicion = Boolean(userId);
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const autorizado = esAdmin || puedeGestionarOperadores(sesion.user.rol);
  const esScoped = autorizado && !esAdmin;
  const esAnalistaCaller = sesion.user.rol === "analista_sae";
  const rolesCreables: Rol[] = esAdmin
    ? ROLES
    : esAnalistaCaller
      ? ["supervisor", "operador"]
      : ["operador"];

  const [form, setForm] = useState<Formulario>(formVacio);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(esEdicion);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

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

  // Analista con ámbito de cuerpo: solo puede asignar su propio cuerpo.
  const cuerposCatalogo = useCatalogoCuerposActivos();
  const cuerposElegibles = cuerposCatalogo.filter(
    (c) =>
      c.clave !== "sin_asignar" &&
      (!esScoped || esAnalistaDeRed(sesion.user) || c.clave === sesion.user.cuerpo_asignado),
  );
  const puedeElegirCuerpo =
    esAdmin ||
    esAnalistaDeRed(sesion.user) ||
    (esAnalistaCaller &&
      sesion.user.ambito_analista === "cuerpo" &&
      Boolean(sesion.user.cuerpo_asignado));

  // No-admin: solo puede repartir campamentos de su propio alcance
  // (el analista de red reparte cualquiera, igual que la edge).
  const centrosDisponibles = useMemo(() => {
    if (!esScoped || esAnalistaDeRed(sesion.user)) return centros;
    const propios = new Set(sesion.user.centros_asignados ?? []);
    return centros.filter((c) => propios.has(c.id));
  }, [centros, esScoped, sesion.user]);

  useEffect(() => {
    if (!esEdicion || !userId) return;
    let cancelado = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("perfiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelado) return;
      if (err) setError(err.message);
      else if (!data) setError("Usuario no encontrado.");
      else {
        const p = data as UsuarioPerfil;
        setPerfil(p);
        setForm(formDesdePerfil(p));
      }
      setCargandoPerfil(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [esEdicion, userId]);

  if (!autorizado) return <Navigate to="/usuarios" replace />;
  // No-admin editando algo que no es operador: fuera (la RLS tampoco lo deja;
  // el analista crea supervisores pero no los edita).
  if (esScoped && esEdicion && perfil && perfil.rol !== "operador") {
    return <Navigate to="/usuarios" replace />;
  }

  function set<K extends keyof Formulario>(k: K, v: Formulario[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Alta scoped de operador (analista o supervisor creando `op-<cédula>`).
  const soloOperadores = esScoped && form.rol === "operador";
  const usaCentros = rolUsaCentrosAsignados(form.rol);
  const esAnalista = form.rol === "analista_sae";
  const ambitoEfectivo: AmbitoAnalista = soloOperadores
    ? "centros"
    : (!esAnalista && form.ambito_analista === "red") ||
        (form.ambito_analista === "cuerpo" && !puedeElegirCuerpo)
      ? "centros"
      : form.ambito_analista;
  const muestraSelectorCentros = usaCentros && ambitoEfectivo === "centros";

  const cedulaDigits = form.cedula.replace(/\D/g, "");
  const usernameOperador = cedulaDigits ? `op-${cedulaDigits}` : "";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (soloOperadores) {
      if (!cedulaDigits) {
        setError("La cédula es obligatoria para crear un operador.");
        return;
      }
      if (form.password && form.password.replace(/\D/g, "") === cedulaDigits) {
        setError("La contraseña no puede ser la cédula del operador.");
        return;
      }
    }
    setGuardando(true);
    try {
      // No-admin: rol y ámbito fijos; en alta el usuario es `op-<cédula>`.
      const efectivo: Formulario = soloOperadores
        ? {
            ...form,
            rol: "operador",
            ambito_analista: "centros",
            cuerpo_asignado: null,
            username: esEdicion ? form.username : usernameOperador,
          }
        : form;
      if (esEdicion && userId) await actualizarUsuario(userId, efectivo, perfil?.username);
      else await crearUsuario(efectivo);
      navigate("/usuarios");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setGuardando(false);
    }
  }

  const titulo = esEdicion
    ? `Editar — ${perfil?.nombre || perfil?.username || "usuario"}`
    : "Nuevo usuario";

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL} marcoClassName="text-foreground">
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link to="/usuarios">
            <ArrowLeft className="size-4" />
            Volver a usuarios
          </Link>
        </Button>
      </div>
      <VistaEncabezado
        icono={esEdicion ? Pencil : UserPlus}
        acento={esEdicion ? "sky" : "emerald"}
        titulo={titulo}
        descripcion={
          esEdicion
            ? "Ajusta la ficha, el rol y el alcance del usuario."
            : "Crea la ficha completa con rol, alcance y campamentos asignados."
        }
      />

      {cargandoPerfil ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-4 space-y-4">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Columna 1: identidad + contacto */}
            <div className="space-y-4">
              <SeccionCard titulo="Identidad">
                <div className="space-y-1.5">
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="usuario-cedula">Cédula</Label>
                    <Input
                      id="usuario-cedula"
                      value={form.cedula}
                      onChange={(e) => set("cedula", e.target.value)}
                      placeholder="V-12345678"
                      required={soloOperadores}
                      disabled={guardando}
                    />
                    {soloOperadores && !esEdicion && (
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        El usuario de acceso se genera con la cédula
                        {usernameOperador ? `: ${usernameOperador}` : "."}
                      </p>
                    )}
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
              </SeccionCard>

              <SeccionCard titulo="Contacto">
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
                {esEdicion && userId && (
                  <div className="border-t border-border pt-3">
                    <VinculoTelegramUsuario
                      userId={userId}
                      nombre={perfil?.nombre || perfil?.username || "el usuario"}
                      username={perfil?.username ?? null}
                    />
                  </div>
                )}
              </SeccionCard>
            </div>

            {/* Columna 2 (doble en escritorio no: 1fr): rol, alcance y campamentos */}
            <div className="space-y-4">
              <SeccionCard titulo="Rol y alcance">
                <div className="space-y-1.5">
                  <Label htmlFor="usuario-rol">Rol / permisos del sistema</Label>
                  <Select
                    value={form.rol}
                    disabled={
                      guardando || rolesCreables.length === 1 || (esScoped && esEdicion)
                    }
                    onValueChange={(v) => set("rol", v as Rol)}
                  >
                    <SelectTrigger id="usuario-rol" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesCreables.map((r) => (
                        <SelectItem key={r} value={r}>
                          {INFO_ROLES[r].etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {esScoped && !esAnalistaCaller
                      ? "Su rol solo crea cuentas de operador para sus campamentos."
                      : INFO_ROLES[form.rol].descripcion}
                  </p>
                </div>
                {usaCentros && !soloOperadores && (
                  <div className="space-y-1.5">
                    <Label htmlFor="usuario-ambito">
                      {`Alcance del ${INFO_ROLES[form.rol].etiqueta.toLowerCase()}`}
                    </Label>
                    <Select
                      value={ambitoEfectivo}
                      disabled={guardando}
                      onValueChange={(v) => {
                        const ambito = v as AmbitoAnalista;
                        setForm((f) => ({
                          ...f,
                          ambito_analista: ambito,
                          cuerpo_asignado: ambito === "cuerpo" ? f.cuerpo_asignado : null,
                        }));
                      }}
                    >
                      <SelectTrigger id="usuario-ambito" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {esAnalista && <SelectItem value="red">Toda la red</SelectItem>}
                        {puedeElegirCuerpo && (
                          <SelectItem value="cuerpo">
                            Todos los campamentos de un cuerpo
                          </SelectItem>
                        )}
                        <SelectItem value="centros">Campamentos específicos</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {ambitoEfectivo === "red"
                        ? "Ve y opera toda la red, incluidos los catálogos de cuerpos y unidades."
                        : ambitoEfectivo === "cuerpo"
                          ? esAnalista
                            ? "Ve y opera los campamentos supervisados por unidades de su cuerpo, y gestiona solo las unidades de ese cuerpo."
                            : "Ve y opera todos los campamentos supervisados por unidades de su cuerpo; los nuevos entran solos, sin editar el usuario."
                          : "Ve y opera únicamente los campamentos seleccionados de la lista."}
                    </p>
                  </div>
                )}
                {usaCentros && !soloOperadores && ambitoEfectivo === "cuerpo" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="usuario-cuerpo">Cuerpo policial asignado</Label>
                    <Select
                      value={form.cuerpo_asignado ?? ""}
                      disabled={guardando}
                      onValueChange={(v) => set("cuerpo_asignado", v || null)}
                    >
                      <SelectTrigger id="usuario-cuerpo" className="w-full">
                        <SelectValue placeholder="Elegí el cuerpo…" />
                      </SelectTrigger>
                      <SelectContent>
                        {cuerposElegibles.map((c) => (
                          <SelectItem key={c.clave} value={c.clave}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </SeccionCard>

              {muestraSelectorCentros && (
                <SeccionCard titulo="Campamentos asignados">
                  <SelectorCentrosInline
                    centros={centrosDisponibles}
                    seleccion={form.centros_asignados}
                    onCambiar={(ids) => set("centros_asignados", ids)}
                    disabled={guardando}
                  />
                  <p className="text-xs leading-snug text-muted-foreground">
                    Solo verá y operará estos campamentos.
                  </p>
                </SeccionCard>
              )}
            </div>

            {/* Columna 3: seguridad + credenciales */}
            <div className="space-y-4">
              {esEdicion && perfil?.hash_id && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <Fingerprint className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Identificador de sistema (marca de agua) — inmutable
                    </p>
                    <p className="font-mono text-sm font-semibold tracking-wider text-foreground">
                      {perfil.hash_id}
                    </p>
                  </div>
                </div>
              )}

              <SeccionCard titulo="Seguridad">
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
                      Superpone la identidad del usuario y la hora sobre la
                      pantalla para disuadir y trazar fotografías.
                    </span>
                  </span>
                </label>
              </SeccionCard>

              <SeccionCard titulo="Credenciales de acceso">
                {(() => {
                  // El propio usuario no se renombra (su sesión activa guarda
                  // el username); la Edge Function también lo rechaza. En el
                  // alta scoped de operador el username es siempre `op-<cédula>`;
                  // el supervisor creado por el analista lleva credencial libre.
                  const esPropio = esEdicion && userId === sesion.user.sub;
                  return (
                    <div className="space-y-1.5">
                      <Label htmlFor="usuario-login">Usuario (login)</Label>
                      <Input
                        id="usuario-login"
                        value={
                          soloOperadores && !esEdicion ? usernameOperador : form.username
                        }
                        onChange={(e) => set("username", e.target.value)}
                        required={!soloOperadores}
                        minLength={3}
                        placeholder={soloOperadores ? "op-<cédula>" : undefined}
                        disabled={guardando || esPropio || soloOperadores}
                      />
                      {soloOperadores ? (
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Se genera automáticamente con la cédula del operador.
                        </p>
                      ) : (
                        esEdicion && (
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            {esPropio
                              ? "Su propio login se cambia desde Preferencias de cuenta."
                              : "Si lo cambia, el usuario entrará con el nuevo login (minúsculas, números y . _ -). Su sesión abierta sigue válida."}
                          </p>
                        )
                      )}
                    </div>
                  );
                })()}
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
                      Si escribes una contraseña nueva, se aplica de inmediato y
                      el usuario deberá usarla en su próximo inicio de sesión.
                    </p>
                  )}
                </div>
              </SeccionCard>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/usuarios")}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : esEdicion ? (
                "Guardar cambios"
              ) : (
                "Crear usuario"
              )}
            </Button>
          </div>
        </form>
      )}
    </MarcoVista>
  );
}
