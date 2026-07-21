// Gate de activación de credencial propia (/terreno) — Fase 2 del plan de
// migración de operadores (docs/plan-migracion-operadores-password.md §6.1).
//
// Tras identificarse con cédula, el operador SIN `activado_ts` debe crear su
// contraseña antes de llegar al menú: el QR pasa de "sesión permanente" a
// prueba de presencia. El paso es obligatorio; solo si la activación falla
// (edge caída / sin señal) se ofrece continuar sin activar para no bloquear
// el trabajo de campo — reintentará en la próxima entrada.

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activarOperadorTerreno,
  credencialOperadorActivada,
} from "@/data/loginTerreno";

export function GateActivacionTerreno({
  token,
  cedula,
  nombreOperador,
  onResuelto,
}: {
  token: string;
  /** Cédula (dígitos) del operador identificado. */
  cedula: string;
  nombreOperador?: string;
  /** Credencial activada (ahora o antes) o fallo tolerado: dejarlo pasar. */
  onResuelto: () => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState("");
  /** Solo tras un fallo del servidor se permite seguir sin activar. */
  const [permitirOmitir, setPermitirOmitir] = useState(false);
  const onResueltoRef = useRef(onResuelto);
  onResueltoRef.current = onResuelto;

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const activada = await credencialOperadorActivada();
      if (cancelado) return;
      if (activada !== false) {
        // true = ya activó antes; null = no se pudo consultar (no bloquear).
        onResueltoRef.current();
        return;
      }
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const digits = cedula.replace(/\D/g, "");
  const claveEsCedula = password.replace(/\D/g, "") === digits && password.length > 0;
  const valida = password.length >= 6 && password === confirmar && !claveEsCedula;

  async function activar() {
    if (!valida || activando) return;
    setActivando(true);
    setError("");
    try {
      await activarOperadorTerreno(token, digits, password);
      onResueltoRef.current();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo activar la credencial. Intente de nuevo.",
      );
      setPermitirOmitir(true);
      setActivando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando su credencial…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10 text-foreground">
      <main className="flex w-full max-w-md flex-col items-center gap-5">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15"
        >
          <KeyRound className="size-7 text-emerald-500" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Cree su contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nombreOperador ? `${nombreOperador}: paso` : "Paso"} obligatorio para
            activar su cuenta personal.
          </p>
        </div>

        <div className="w-full space-y-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs leading-snug text-muted-foreground">
          <p>
            Su usuario es{" "}
            <span className="font-mono font-medium text-foreground">op-{digits}</span>. Con
            esta contraseña podrá iniciar sesión desde cualquier teléfono.
          </p>
          <p className="font-medium text-amber-600 dark:text-amber-400">
            Recuérdela: pronto será la única forma de entrar al sistema — el
            acceso directo por el QR va a desaparecer.
          </p>
        </div>

        <form
          className="w-full space-y-3 rounded-xl border border-border bg-card/60 px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void activar();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="act-password">Contraseña nueva</Label>
            <div className="relative">
              <Input
                id="act-password"
                type={verClave ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                className="h-11 pr-10"
                disabled={activando}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-confirmar">Repita la contraseña</Label>
            <Input
              id="act-confirmar"
              type={verClave ? "text" : "password"}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              className="h-11"
              disabled={activando}
            />
          </div>

          {claveEsCedula && (
            <p className="text-xs text-destructive">
              La contraseña no puede ser su cédula.
            </p>
          )}
          {password.length >= 6 && confirmar.length >= 6 && password !== confirmar && (
            <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="h-11 w-full" disabled={!valida || activando}>
            {activando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Activando…
              </>
            ) : (
              "Activar mi cuenta"
            )}
          </Button>
        </form>

        {permitirOmitir && (
          <div className="flex w-full items-start gap-2 rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="min-w-0 text-xs leading-snug">
              <p className="text-amber-950/90 dark:text-amber-100/90">
                Si el sistema no responde puede continuar y activar su cuenta en
                la próxima entrada.
              </p>
              <button
                type="button"
                className="mt-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => onResueltoRef.current()}
              >
                Continuar sin activar por ahora
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
