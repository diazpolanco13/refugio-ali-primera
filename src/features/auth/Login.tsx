import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck, Tent } from "lucide-react";
import "cap-widget";
import "./cap-login.css";
import { login } from "@/data/authSupabase";
import { capApiEndpoint, capHabilitado } from "@/data/capConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CapWidgetEl = HTMLElement & {
  tokenValue?: string | null;
  reset?: () => void;
  cleanup?: () => void;
};

/** Cap deja workers especulativos vivos al desmontar el login; abortamos a mano. */
function detenerCapWidget(el: CapWidgetEl | null): void {
  if (!el) return;
  try {
    el.cleanup?.();
  } catch {
    try {
      el.reset?.();
    } catch {
      /* ignore */
    }
  }
}

export function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [capToken, setCapToken] = useState("");
  const [capKey, setCapKey] = useState(0);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const widgetRef = useRef<CapWidgetEl>(null);

  useEffect(() => {
    return () => detenerCapWidget(widgetRef.current);
  }, []);

  function reiniciarCap(): void {
    detenerCapWidget(widgetRef.current);
    setCapToken("");
    setCapKey((k) => k + 1);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const tokenCap =
        widgetRef.current?.tokenValue?.trim() || capToken.trim() || undefined;
      // Detener PoW especulativo antes de emitir sesión (desmonta este Login).
      detenerCapWidget(widgetRef.current);
      await login(usuario.trim(), password, tokenCap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
      if (capHabilitado) reiniciarCap();
    } finally {
      setCargando(false);
    }
  }

  const puedeEnviar =
    Boolean(usuario && password) && (!capHabilitado || Boolean(capToken));

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%)]"
      />

      <div className="relative flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Tent className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold tracking-tight">
              Campamentos Transitorios
            </p>
            <p className="text-xs text-muted-foreground">
              Área Metropolitana de Caracas
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-md shadow-black/20">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xl font-semibold">Iniciar sesión</CardTitle>
            <CardDescription>
              Acceso restringido al personal autorizado de la red
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={entrar}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="login-usuario">Usuario</FieldLabel>
                  <Input
                    id="login-usuario"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoFocus
                    autoComplete="username"
                    placeholder="tu.usuario"
                    disabled={cargando}
                    className="h-9 bg-background/80"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={cargando}
                    className="h-9 bg-background/80"
                  />
                </Field>

                {capHabilitado && (
                  <Field>
                    <FieldLabel className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-muted-foreground" />
                      Verificación de seguridad
                    </FieldLabel>
                    <div
                      className={cn(
                        "cap-login rounded-lg border border-border/70 bg-background/50 px-1 py-1",
                        capToken && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <cap-widget
                        ref={widgetRef}
                        key={capKey}
                        data-cap-api-endpoint={capApiEndpoint()}
                        data-cap-i18n-initial-state="No soy un robot"
                        data-cap-i18n-verifying-label="Comprobando…"
                        data-cap-i18n-solved-label="Verificado"
                        data-cap-i18n-error-label="Error"
                        data-cap-i18n-required-label="Completa la verificación"
                        data-cap-i18n-verify-aria-label="Verificar que eres humano"
                        data-cap-i18n-verified-aria-label="Verificación completada"
                        onsolve={(e) => setCapToken(e.detail.token)}
                        onerror={() => {
                          setCapToken("");
                          setError("Error en la verificación de seguridad");
                        }}
                        onreset={() => setCapToken("")}
                      />
                    </div>
                    {!capToken && (
                      <FieldDescription>
                        Marca la casilla para continuar.
                      </FieldDescription>
                    )}
                  </Field>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Field>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={cargando || !puedeEnviar}
                  >
                    {cargando ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Entrando…
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <p className="px-4 text-center text-xs leading-relaxed text-muted-foreground">
          Plataforma de gestión humanitaria CCCM. Uso exclusivo de coordinación
          operativa.
        </p>
      </div>
    </div>
  );
}
