// Página pública de denuncias y sugerencias de los damnificados (/denuncia).
// Se llega por el QR "público" pegado en el campamento (?t=<token publico>).
// Una sola pantalla, solo escribe: categoría + título + detalles + contacto
// opcional → RPC `denuncia_registrar`. Es anónima por defecto y el token NO se
// guarda en localStorage (a diferencia del token del personal): cada envío
// exige el QR. Al enviar se captura telemetría de origen (IP en servidor,
// user-agent y huella de dispositivo) para detectar abuso.

import { useEffect, useMemo, useRef, useState } from "react";
import "cap-widget";
import "@/features/auth/cap-login.css";
import { CheckCircle2, Loader2, MapPin, Megaphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { obtenerCentroDenuncia, registrarDenuncia } from "@/data/reposDenuncias";
import { capApiEndpoint, capHabilitado } from "@/data/capConfig";
import type { CentroCenso } from "@/data/reposCenso";
import { CATEGORIAS_DENUNCIA, type CategoriaDenuncia } from "@/domain/denuncias";
import { cn } from "@/lib/utils";

const LARGO_TITULO = 120;
const LARGO_MAXIMO = 1200;

function tokenDeLaUrl(): string {
  return new URLSearchParams(window.location.search).get("t")?.trim() ?? "";
}

type CapWidgetEl = HTMLElement & {
  tokenValue?: string | null;
  reset?: () => void;
  cleanup?: () => void;
};

/** Cap deja workers especulativos vivos al desmontar; los abortamos a mano. */
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

export function DenunciaView() {
  const token = useMemo(tokenDeLaUrl, []);
  const [centro, setCentro] = useState<CentroCenso | null>(null);
  const [cargando, setCargando] = useState(Boolean(token));
  const [errorCentro, setErrorCentro] = useState("");

  const [categoria, setCategoria] = useState<CategoriaDenuncia | "">("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [contacto, setContacto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnviar, setErrorEnviar] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [capToken, setCapToken] = useState("");
  const [capKey, setCapKey] = useState(0);
  const widgetRef = useRef<CapWidgetEl>(null);

  useEffect(() => () => detenerCapWidget(widgetRef.current), []);

  function reiniciarCap(): void {
    detenerCapWidget(widgetRef.current);
    setCapToken("");
    setCapKey((k) => k + 1);
  }

  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    obtenerCentroDenuncia(token)
      .then((c) => {
        if (cancelado) return;
        if (c) setCentro(c);
        else setErrorCentro("Este código QR ya no es válido. Avise a la coordinación del campamento.");
      })
      .catch(() => {
        if (!cancelado) setErrorCentro("No se pudo verificar el código. Revise su conexión e intente de nuevo.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !categoria) return;
    const tokenCap = widgetRef.current?.tokenValue?.trim() || capToken.trim();
    if (capHabilitado && !tokenCap) {
      setErrorEnviar("Marque la casilla de verificación antes de enviar.");
      return;
    }
    setErrorEnviar("");
    setEnviando(true);
    try {
      await registrarDenuncia({
        token,
        categoria,
        titulo,
        texto,
        contacto,
        capToken: tokenCap,
      });
      setEnviada(true);
    } catch (err) {
      setErrorEnviar(err instanceof Error ? err.message : "No se pudo enviar. Intente de nuevo.");
      // El token de Cap es de un solo uso: hay que resolverlo de nuevo.
      if (capHabilitado) reiniciarCap();
    } finally {
      setEnviando(false);
    }
  }

  function otroReporte() {
    setCategoria("");
    setTitulo("");
    setTexto("");
    setContacto("");
    setErrorEnviar("");
    setEnviada(false);
    if (capHabilitado) reiniciarCap();
    window.scrollTo({ top: 0 });
  }

  const listo =
    Boolean(categoria) &&
    titulo.trim().length >= 3 &&
    texto.trim().length >= 10 &&
    (!capHabilitado || Boolean(capToken));

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col items-center gap-2 text-center">
          <div
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-2xl bg-primary/15"
          >
            <Megaphone className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Denuncias y sugerencias</h1>
          <p className="text-sm text-muted-foreground">
            Su voz mejora el campamento. Cuéntenos qué no está funcionando.
          </p>
          {token !== "" && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                centro ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {cargando ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MapPin className="size-3.5" aria-hidden="true" />
              )}
              <span className="max-w-64 truncate">
                {cargando ? "Identificando campamento…" : (centro?.nombre ?? "Campamento no reconocido")}
              </span>
            </div>
          )}
        </header>

        {!token || (!cargando && !centro) ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {errorCentro ||
                "Para enviar una denuncia escanee el código QR pegado en las carteleras de su campamento."}
            </CardContent>
          </Card>
        ) : enviada ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" aria-hidden="true" />
              <p className="text-base font-semibold">Reporte recibido</p>
              <p className="text-sm text-muted-foreground">
                Gracias. Su reporte llegó directo a la coordinación de la red, fuera del campamento.
              </p>
              <Button type="button" variant="outline" onClick={otroReporte}>
                Enviar otro reporte
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <section aria-label="Categoría" className="space-y-2">
              <p className="text-sm font-medium">¿Sobre qué quiere reportar?</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS_DENUNCIA.map(({ valor, label, emoji }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setCategoria(valor)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      categoria === valor
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span aria-hidden="true">{emoji}</span>
                    <span className="leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section aria-label="Título" className="space-y-2">
              <p className="text-sm font-medium">Título</p>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value.slice(0, LARGO_TITULO))}
                placeholder="Resuma el problema en una frase"
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {titulo.trim().length < 3
                  ? "Escriba al menos 3 caracteres"
                  : `${titulo.length}/${LARGO_TITULO}`}
              </p>
            </section>

            <section aria-label="Detalles" className="space-y-2">
              <p className="text-sm font-medium">Detalles</p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, LARGO_MAXIMO))}
                rows={5}
                placeholder="Describa la situación: qué pasó, cuándo y dónde dentro del campamento…"
                className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {texto.trim().length < 10
                  ? "Escriba al menos 10 caracteres"
                  : `${texto.length}/${LARGO_MAXIMO}`}
              </p>
            </section>

            <section aria-label="Contacto opcional" className="space-y-2">
              <p className="text-sm font-medium">
                Teléfono o nombre <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <input
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value.slice(0, 120))}
                placeholder="Solo si desea que lo contacten"
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </section>

            <div className="flex items-start gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="leading-snug">
                Su reporte es <strong className="text-foreground">anónimo</strong> si no deja
                contacto. El personal del campamento <strong className="text-foreground">no</strong>{" "}
                puede ver quién lo envió: llega directo a la supervisión de la red.
              </p>
            </div>

            {capHabilitado && (
              <div className="cap-login rounded-xl border border-border bg-card/60 px-3 py-2.5">
                <cap-widget
                  ref={widgetRef}
                  key={capKey}
                  data-cap-api-endpoint={capApiEndpoint()}
                  data-cap-i18n-initial-state="No soy un robot"
                  data-cap-i18n-verifying-label="Comprobando…"
                  data-cap-i18n-solved-label="Verificado"
                  data-cap-i18n-error-label="Error"
                  data-cap-i18n-required-label="Complete la verificación"
                  data-cap-i18n-verify-aria-label="Verificar que es una persona"
                  data-cap-i18n-verified-aria-label="Verificación completada"
                  onsolve={(e) => setCapToken(e.detail.token)}
                  onerror={() => setCapToken("")}
                  onreset={() => setCapToken("")}
                />
              </div>
            )}

            {errorEnviar && <p className="text-sm text-destructive">{errorEnviar}</p>}

            <Button type="submit" size="lg" disabled={!listo || enviando} className="h-12 text-base">
              {enviando ? <Loader2 className="size-5 animate-spin" /> : "Enviar reporte"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
