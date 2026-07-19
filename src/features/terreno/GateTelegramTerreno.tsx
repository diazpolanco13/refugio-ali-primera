// Gate de vinculación Telegram (/terreno): tras identificarse con cédula, el
// operador debe vincular su Telegram antes de llegar al menú. Gracia limitada
// de entradas «Continuar sin vincular»; el contador vive en el servidor
// (perfiles.entradas_sin_telegram, RPC terreno_omitir_telegram) porque en el
// terreno se borra caché/localStorage con frecuencia. Agotada la gracia, el
// gate es duro: sin vínculo no hay menú.

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ShieldAlert } from "lucide-react";
import {
  GRACIA_TELEGRAM_MAX,
  entradasSinTelegram,
  miVinculoTelegram,
  omitirVinculoTelegram,
} from "@/data/telegramOperador";
import { VincularTelegramTerreno } from "@/features/terreno/VincularTelegramTerreno";

export function GateTelegramTerreno({
  nombreOperador,
  onResuelto,
}: {
  nombreOperador?: string;
  /** Vinculó Telegram o consumió una entrada de gracia: dejarlo pasar. */
  onResuelto: () => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [entradas, setEntradas] = useState(0);
  const [omitiendo, setOmitiendo] = useState(false);
  const [error, setError] = useState("");
  const onResueltoRef = useRef(onResuelto);
  onResueltoRef.current = onResuelto;

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const vinculo = await miVinculoTelegram();
        if (cancelado) return;
        if (vinculo) {
          onResueltoRef.current();
          return;
        }
        const usadas = await entradasSinTelegram();
        if (cancelado) return;
        setEntradas(usadas);
        setCargando(false);
      } catch {
        // Ante un fallo de consulta no se bloquea el trabajo de campo.
        if (!cancelado) onResueltoRef.current();
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function omitir() {
    setOmitiendo(true);
    setError("");
    try {
      await omitirVinculoTelegram();
      onResueltoRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo continuar.");
      setOmitiendo(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando Telegram…</p>
      </div>
    );
  }

  const restantes = Math.max(0, GRACIA_TELEGRAM_MAX - entradas);
  const agotada = restantes === 0;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10 text-foreground">
      <main className="flex w-full max-w-md flex-col items-center gap-5">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-2xl bg-sky-500/15"
        >
          <Send className="size-7 text-sky-500" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Vincule su Telegram
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nombreOperador ? `${nombreOperador}: paso` : "Paso"} obligatorio
            para operar en el terreno.
          </p>
        </div>
        <div className="w-full space-y-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs leading-snug text-muted-foreground">
          <p>
            Por Telegram recibirá las <span className="font-medium text-foreground">alertas de
            seguridad</span> (si alguien usa su cédula para entrar) y los{" "}
            <span className="font-medium text-foreground">recordatorios del parte diario</span> de
            sus campamentos.
          </p>
          <p>
            Toque el botón, se abrirá el bot y presione <span className="font-medium text-foreground">INICIAR</span>.
            Esta pantalla continúa sola al confirmarse el vínculo.
          </p>
        </div>
        <div className="w-full rounded-xl border border-border bg-card/60 px-4 py-3">
          <VincularTelegramTerreno onVinculado={() => onResueltoRef.current()} />
        </div>
        {agotada ? (
          <div className="flex w-full items-start gap-2 rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3">
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="text-xs leading-snug text-amber-950/90 dark:text-amber-100/90">
              Ya usó sus {GRACIA_TELEGRAM_MAX} entradas sin vincular. Para
              continuar debe vincular Telegram. Si no puede hacerlo, contacte a
              los analistas SAE de su campamento.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void omitir()}
            disabled={omitiendo}
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-60"
          >
            {omitiendo ? "Entrando…" : `Continuar sin vincular (le quedan ${restantes})`}
          </button>
        )}
        {error && <p className="text-center text-xs text-destructive">{error}</p>}
      </main>
    </div>
  );
}
