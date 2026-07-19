import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import "cap-widget";
import "./cap-login.css";
import { login } from "@/data/authSupabase";
import { capApiEndpoint, capHabilitado } from "@/data/capConfig";
import {
  LoginBackground,
  LoginHero,
} from "@/components/LoginHeroBackground";
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
      // Prefetch mapa mientras auth responde → al disolverse el login ya hay chunk.
      void import("@/features/centros/CentrosView");
      await login(usuario.trim(), password, tokenCap);
      // Éxito: NO resetear `cargando`. Este Login sigue montado (CapaLogin lo
      // mantiene hasta que el mapa orbita debajo, ~4s + fade); si el botón
      // volviera a "Entrar" parecería un fallo y un re-click quemaría el Cap.
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
      if (capHabilitado) reiniciarCap();
      setCargando(false);
    }
  }

  const puedeEnviar =
    Boolean(usuario && password) && (!capHabilitado || Boolean(capToken));

  return (
    <main className="dark relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#05100C] p-6 md:p-10">
      <LoginBackground />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-0">
        <LoginHero />

        <Card className="border-border/60 bg-card/90 shadow-lg shadow-black/40 backdrop-blur-sm">
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
                    className="h-9 border-border/80 bg-input/80"
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
                    className="h-9 border-border/80 bg-input/80"
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
                        "cap-login rounded-lg border border-border/70 bg-input/40 px-1 py-1",
                        capToken && "border-primary/40 bg-primary/10",
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

        <p className="mt-6 px-4 text-center text-xs leading-relaxed text-[#6B8F80]">
          Plataforma de gestión humanitaria CCCM. Uso exclusivo de coordinación
          operativa.
        </p>
      </div>
    </main>
  );
}
