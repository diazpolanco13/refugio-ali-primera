// Preferencias de cuenta propia (`/config/perfil`).
// Usuarios permanentes editan ficha + contraseña. Temporales de terreno (QR) no.

import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Fingerprint,
  KeyRound,
  Loader2,
  Settings,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import {
  actualizarMiPerfil,
  cambiarMiPassword,
  type DatosPerfilEditable,
  type Sesion,
  useSesion,
} from "@/data/authSupabase";
import { registrarHistorial } from "@/data/historial";
import {
  INFO_ROLES,
  puedeEditarCuentaPropia,
  rutaInicialDeRol,
} from "@/domain/permisos";
import { BadgeRol } from "@/components/BadgeRol";
import { VistaPagina } from "@/components/VistaPagina";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  sesion: Sesion;
}

function perfilDesdeSesion(sesion: Sesion): DatosPerfilEditable {
  const u = sesion.user;
  return {
    nombre: u.nombre ?? "",
    jerarquia: u.jerarquia ?? "",
    cedula: u.cedula ?? "",
    responsabilidad: u.responsabilidad ?? "",
    whatsapp: u.whatsapp ?? "",
    telegram: u.telegram ?? "",
    brazalete: u.brazalete ?? "",
    marca_agua: u.marca_agua !== false,
  };
}

export function PreferenciasCuentaView({ sesion: sesionInicial }: Props) {
  const sesionViva = useSesion() ?? sesionInicial;
  const puede = puedeEditarCuentaPropia(sesionViva.user);

  const [perfil, setPerfil] = useState<DatosPerfilEditable>(() =>
    perfilDesdeSesion(sesionViva),
  );
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [okPerfil, setOkPerfil] = useState("");
  const [errorPerfil, setErrorPerfil] = useState("");

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [okPassword, setOkPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  if (!puede) {
    return <Navigate to={rutaInicialDeRol(sesionViva.user.rol)} replace />;
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setErrorPerfil("");
    setOkPerfil("");
    setGuardandoPerfil(true);
    try {
      const actualizada = await actualizarMiPerfil(perfil);
      setPerfil(perfilDesdeSesion(actualizada));
      registrarHistorial("editar_perfil_propio", "usuario", actualizada.user.sub, {
        username: actualizada.user.username,
      });
      setOkPerfil("Datos guardados.");
    } catch (err) {
      setErrorPerfil(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function guardarPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorPassword("");
    setOkPassword("");
    if (passwordNueva !== passwordConfirmacion) {
      setErrorPassword("La confirmación no coincide con la nueva contraseña");
      return;
    }
    setGuardandoPassword(true);
    try {
      await cambiarMiPassword(passwordActual, passwordNueva);
      registrarHistorial("cambiar_password", "usuario", sesionViva.user.sub, {
        username: sesionViva.user.username,
        propio: true,
      });
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirmacion("");
      setOkPassword("Contraseña actualizada. Úsala en el próximo inicio de sesión.");
    } catch (err) {
      setErrorPassword(
        err instanceof Error ? err.message : "No se pudo cambiar la contraseña",
      );
    } finally {
      setGuardandoPassword(false);
    }
  }

  function setCampo<K extends keyof DatosPerfilEditable>(
    k: K,
    v: DatosPerfilEditable[K],
  ) {
    setPerfil((p) => ({ ...p, [k]: v }));
    setOkPerfil("");
    setErrorPerfil("");
  }

  return (
    <VistaPagina
      icono={Settings}
      acento="primary"
      titulo="Preferencias de cuenta"
      descripcion="Tu ficha personal y el cambio de contraseña"
    >
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <BadgeRol rol={sesionViva.user.rol} />
          <span className="text-sm text-muted-foreground">
            @{sesionViva.user.username}
          </span>
          <span className="text-xs text-muted-foreground">
            · {INFO_ROLES[sesionViva.user.rol].etiqueta}
          </span>
          {sesionViva.user.hash_id && (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Fingerprint className="size-3.5" />
              {sesionViva.user.hash_id}
            </span>
          )}
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" />
              Datos personales
            </CardTitle>
            <CardDescription>
              Rol, usuario de login y campamentos asignados solo los cambia un
              administrador.
            </CardDescription>
          </CardHeader>
          <form onSubmit={guardarPerfil}>
            <CardContent className="space-y-5 pt-(--card-spacing)">
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Identidad
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="perfil-nombre">Nombre y apellido</Label>
                    <Input
                      id="perfil-nombre"
                      value={perfil.nombre}
                      onChange={(e) => setCampo("nombre", e.target.value)}
                      required
                      disabled={guardandoPerfil}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-cedula">Cédula</Label>
                    <Input
                      id="perfil-cedula"
                      value={perfil.cedula}
                      onChange={(e) => setCampo("cedula", e.target.value)}
                      placeholder="V-12345678"
                      disabled={guardandoPerfil}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-brazalete">Código de brazalete</Label>
                    <Input
                      id="perfil-brazalete"
                      value={perfil.brazalete}
                      onChange={(e) => setCampo("brazalete", e.target.value)}
                      placeholder="Ej. BRZ-045"
                      disabled={guardandoPerfil}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cargo
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-jerarquia">Jerarquía / cargo</Label>
                    <Input
                      id="perfil-jerarquia"
                      value={perfil.jerarquia}
                      onChange={(e) => setCampo("jerarquia", e.target.value)}
                      placeholder="Ej. Coordinador general"
                      disabled={guardandoPerfil}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-responsabilidad">Responsabilidad</Label>
                    <Input
                      id="perfil-responsabilidad"
                      value={perfil.responsabilidad}
                      onChange={(e) =>
                        setCampo("responsabilidad", e.target.value)
                      }
                      placeholder="Ej. Logística de alimentación"
                      disabled={guardandoPerfil}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contacto
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-whatsapp">WhatsApp</Label>
                    <Input
                      id="perfil-whatsapp"
                      value={perfil.whatsapp}
                      onChange={(e) => setCampo("whatsapp", e.target.value)}
                      placeholder="0412…"
                      disabled={guardandoPerfil}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-telegram">Telegram</Label>
                    <Input
                      id="perfil-telegram"
                      value={perfil.telegram}
                      onChange={(e) => setCampo("telegram", e.target.value)}
                      placeholder="@usuario"
                      disabled={guardandoPerfil}
                    />
                  </div>
                </div>
              </section>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
                <Switch
                  checked={perfil.marca_agua}
                  disabled={guardandoPerfil}
                  onCheckedChange={(v) => setCampo("marca_agua", v)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <ShieldAlert className="size-4 text-primary" />
                    Marca de agua de seguridad
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    Superpone tu identidad y la hora sobre la pantalla para
                    disuadir y trazar fotografías.
                  </span>
                </span>
              </label>

              {errorPerfil && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errorPerfil}
                </div>
              )}
              {okPerfil && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {okPerfil}
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              <Button type="submit" disabled={guardandoPerfil}>
                {guardandoPerfil ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar datos"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" />
              Cambiar contraseña
            </CardTitle>
            <CardDescription>
              Confirma la actual y escribe una nueva de al menos 6 caracteres.
            </CardDescription>
          </CardHeader>
          <form onSubmit={guardarPassword}>
            <CardContent className="space-y-3 pt-(--card-spacing)">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="perfil-password-actual">Contraseña actual</Label>
                  <Input
                    id="perfil-password-actual"
                    type="password"
                    autoComplete="current-password"
                    value={passwordActual}
                    onChange={(e) => {
                      setPasswordActual(e.target.value);
                      setOkPassword("");
                      setErrorPassword("");
                    }}
                    required
                    disabled={guardandoPassword}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="perfil-password-nueva">Nueva contraseña</Label>
                  <Input
                    id="perfil-password-nueva"
                    type="password"
                    autoComplete="new-password"
                    value={passwordNueva}
                    onChange={(e) => {
                      setPasswordNueva(e.target.value);
                      setOkPassword("");
                      setErrorPassword("");
                    }}
                    required
                    minLength={6}
                    disabled={guardandoPassword}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="perfil-password-confirm">Confirmar nueva</Label>
                  <Input
                    id="perfil-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirmacion}
                    onChange={(e) => {
                      setPasswordConfirmacion(e.target.value);
                      setOkPassword("");
                      setErrorPassword("");
                    }}
                    required
                    minLength={6}
                    disabled={guardandoPassword}
                  />
                </div>
              </div>

              {errorPassword && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errorPassword}
                </div>
              )}
              {okPassword && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {okPassword}
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              <Button
                type="submit"
                variant="secondary"
                disabled={guardandoPassword}
              >
                {guardandoPassword ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Actualizando…
                  </>
                ) : (
                  "Cambiar contraseña"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </VistaPagina>
  );
}
