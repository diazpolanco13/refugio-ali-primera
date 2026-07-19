// Preferencias de cuenta propia (`/config/perfil`).
// Usuarios permanentes editan ficha + usuario de login + contraseña.
// Temporales de terreno (QR) no. El login se renombra vía Edge Function
// `update-username` (renombrarMiUsuario: la sesión sigue viva tras el cambio).

import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AtSign,
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
  renombrarMiUsuario,
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
import { VincularTelegramCuenta } from "@/features/config/VincularTelegramCuenta";
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

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

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

/** Encabezado de grupo dentro de la tarjeta de datos. */
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function BannerResultado({ ok, error }: { ok: string; error: string }) {
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </div>
    );
  }
  if (ok) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        {ok}
      </div>
    );
  }
  return null;
}

export function PreferenciasCuentaView({ sesion: sesionInicial }: Props) {
  const sesionViva = useSesion() ?? sesionInicial;
  const puede = puedeEditarCuentaPropia(sesionViva.user);

  const [perfil, setPerfil] = useState<DatosPerfilEditable>(() =>
    perfilDesdeSesion(sesionViva),
  );
  const [username, setUsername] = useState(() => sesionViva.user.username);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [okPerfil, setOkPerfil] = useState("");
  const [errorPerfil, setErrorPerfil] = useState("");

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [okPassword, setOkPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  const base = useMemo(
    () => ({ ...perfilDesdeSesion(sesionViva), username: sesionViva.user.username }),
    [sesionViva],
  );
  const usernameNormalizado = username.trim().toLowerCase();
  const cambiaUsername = usernameNormalizado !== base.username;
  const hayCambios =
    cambiaUsername ||
    (Object.keys(perfilDesdeSesion(sesionViva)) as (keyof DatosPerfilEditable)[]).some(
      (k) => perfil[k] !== base[k],
    );

  if (!puede) {
    return <Navigate to={rutaInicialDeRol(sesionViva.user.rol)} replace />;
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setErrorPerfil("");
    setOkPerfil("");
    if (cambiaUsername && !USERNAME_RE.test(usernameNormalizado)) {
      setErrorPerfil(
        "Usuario de login inválido: 3-32 caracteres, minúsculas, números y . _ - (empieza con letra o número).",
      );
      return;
    }
    setGuardandoPerfil(true);
    try {
      // Primero el login (Edge Function con validaciones propias); si falla,
      // no se toca el resto de la ficha.
      if (cambiaUsername) {
        await renombrarMiUsuario(usernameNormalizado);
        setUsername(usernameNormalizado);
      }
      const actualizada = await actualizarMiPerfil(perfil);
      setPerfil(perfilDesdeSesion(actualizada));
      registrarHistorial("editar_perfil_propio", "usuario", actualizada.user.sub, {
        username: actualizada.user.username,
      });
      setOkPerfil(
        cambiaUsername
          ? `Datos guardados. Su nuevo usuario de login es «${usernameNormalizado}»; esta sesión sigue activa.`
          : "Datos guardados.",
      );
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

  function setCampoPassword(setter: (v: string) => void, v: string) {
    setter(v);
    setOkPassword("");
    setErrorPassword("");
  }

  return (
    <VistaPagina
      icono={Settings}
      acento="primary"
      titulo="Preferencias de cuenta"
      descripcion="Tu ficha personal, usuario de login y contraseña"
    >
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <BadgeRol rol={sesionViva.user.rol} />
          <span className="text-sm font-medium text-foreground">
            {sesionViva.user.nombre || `@${sesionViva.user.username}`}
          </span>
          <span className="text-xs text-muted-foreground">
            @{sesionViva.user.username} · {INFO_ROLES[sesionViva.user.rol].etiqueta}
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
              El rol y los campamentos asignados solo los cambia un
              administrador.
            </CardDescription>
          </CardHeader>
          <form onSubmit={guardarPerfil}>
            <CardContent className="space-y-5 py-(--card-spacing)">
              <section className="space-y-3">
                <TituloSeccion>Cuenta</TituloSeccion>
                <div className="space-y-1.5 sm:max-w-sm">
                  <Label htmlFor="perfil-username">Usuario (login)</Label>
                  <div className="relative">
                    <AtSign
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="perfil-username"
                      className="pl-8 font-mono lowercase"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase());
                        setOkPerfil("");
                        setErrorPerfil("");
                      }}
                      required
                      minLength={3}
                      maxLength={32}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={guardandoPerfil}
                    />
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {cambiaUsername
                      ? `Entrará como «${usernameNormalizado || "…"}» en su próximo inicio de sesión; esta sesión sigue activa.`
                      : "Es el nombre con el que inicia sesión. Minúsculas, números y . _ -"}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <TituloSeccion>Identidad</TituloSeccion>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="perfil-nombre">Nombre y apellido</Label>
                    <Input
                      id="perfil-nombre"
                      value={perfil.nombre}
                      onChange={(e) => setCampo("nombre", e.target.value)}
                      required
                      autoComplete="name"
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
                <TituloSeccion>Cargo</TituloSeccion>
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
                <TituloSeccion>Contacto</TituloSeccion>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-whatsapp">Teléfono de WhatsApp</Label>
                    <Input
                      id="perfil-whatsapp"
                      type="tel"
                      value={perfil.whatsapp}
                      onChange={(e) => setCampo("whatsapp", e.target.value)}
                      placeholder="+58 412 000 0000"
                      autoComplete="tel"
                      disabled={guardandoPerfil}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="perfil-telegram">Teléfono de Telegram</Label>
                    <Input
                      id="perfil-telegram"
                      type="tel"
                      value={perfil.telegram}
                      onChange={(e) => setCampo("telegram", e.target.value)}
                      placeholder="+58 412 000 0000"
                      disabled={guardandoPerfil}
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Solo informativo. Las alertas usan el vínculo con el bot
                      (tarjeta Telegram, abajo).
                    </p>
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

              <BannerResultado ok={okPerfil} error={errorPerfil} />
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              <Button type="submit" disabled={guardandoPerfil || !hayCambios}>
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

        <VincularTelegramCuenta />

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
            <CardContent className="space-y-4 py-(--card-spacing)">
              {/* Ayuda a los gestores de contraseñas a asociar el login. */}
              <input
                type="text"
                autoComplete="username"
                value={sesionViva.user.username}
                readOnly
                hidden
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="perfil-password-actual">Contraseña actual</Label>
                  <Input
                    id="perfil-password-actual"
                    type="password"
                    autoComplete="current-password"
                    value={passwordActual}
                    onChange={(e) => setCampoPassword(setPasswordActual, e.target.value)}
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
                    onChange={(e) => setCampoPassword(setPasswordNueva, e.target.value)}
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
                    onChange={(e) =>
                      setCampoPassword(setPasswordConfirmacion, e.target.value)
                    }
                    required
                    minLength={6}
                    disabled={guardandoPassword}
                  />
                </div>
              </div>

              <BannerResultado ok={okPassword} error={errorPassword} />
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              <Button
                type="submit"
                disabled={
                  guardandoPassword ||
                  !passwordActual ||
                  !passwordNueva ||
                  !passwordConfirmacion
                }
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
