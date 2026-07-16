// Botón/estado del vínculo Telegram del operador identificado (Fase B).
// Genera el token de un solo uso y abre el deep-link del bot; al volver el
// foco a la pestaña re-consulta hasta ver el vínculo consumado.

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, Send } from "lucide-react";
import {
  generarVinculoTelegram,
  miVinculoTelegram,
  urlVinculoTelegram,
  type VinculoTelegram,
} from "@/data/telegramOperador";
import { cn } from "@/lib/utils";

/** Re-chequeos tras abrir Telegram (el vínculo llega por el webhook). */
const REINTENTOS_MS = 5000;
const REINTENTOS_MAX = 24; // ~2 minutos

export function VincularTelegramTerreno() {
  const [vinculo, setVinculo] = useState<VinculoTelegram | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [error, setError] = useState("");
  const reintentos = useRef(0);

  const consultar = useCallback(async () => {
    try {
      const v = await miVinculoTelegram();
      if (v) {
        setVinculo(v);
        setEsperando(false);
      }
      return v;
    } catch {
      return null;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  // Mientras se espera el /start: re-consultar al recuperar foco y por timer.
  useEffect(() => {
    if (!esperando) return;
    const alFoco = () => void consultar();
    window.addEventListener("focus", alFoco);
    const timer = setInterval(() => {
      reintentos.current += 1;
      if (reintentos.current > REINTENTOS_MAX) {
        setEsperando(false);
        return;
      }
      void consultar();
    }, REINTENTOS_MS);
    return () => {
      window.removeEventListener("focus", alFoco);
      clearInterval(timer);
    };
  }, [esperando, consultar]);

  async function vincular() {
    setGenerando(true);
    setError("");
    try {
      const token = await generarVinculoTelegram();
      reintentos.current = 0;
      setEsperando(true);
      window.open(urlVinculoTelegram(token), "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el enlace.");
      // Si "ya vinculado", refrescar el estado real.
      void consultar();
    } finally {
      setGenerando(false);
    }
  }

  if (cargando) return null;

  if (vinculo) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <BadgeCheck className="size-3.5" />
        Telegram vinculado
        {vinculo.telegram_username ? (
          <span className="text-muted-foreground">@{vinculo.telegram_username}</span>
        ) : null}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void vincular()}
        disabled={generando}
        className={cn(
          "flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/50 bg-sky-500/10 text-xs font-medium text-sky-600 transition-colors",
          "hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-400",
        )}
      >
        {generando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {esperando ? "Abrir Telegram de nuevo" : "Vincular Telegram"}
      </button>
      {esperando && (
        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          En Telegram toque <span className="font-medium">INICIAR</span>; esta pantalla se
          actualizará sola.
        </p>
      )}
      {error && <p className="text-center text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
