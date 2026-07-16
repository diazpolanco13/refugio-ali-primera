// Tarjeta "Telegram" de Preferencias de cuenta (/config/perfil): permite a
// los usuarios permanentes (autoridad, supervisor, analista, admin) vincular
// su Telegram con el mismo circuito de los operadores de terreno (RPC
// `telegram_generar_vinculo` + deep-link al bot @camp_inteligent_bot).
// El vínculo habilita alertas de seguridad de login y mensajería futura.

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generarVinculoTelegram,
  miVinculoTelegram,
  urlVinculoTelegram,
  type VinculoTelegram,
} from "@/data/telegramOperador";

const REINTENTOS_MS = 5000;
const REINTENTOS_MAX = 24; // ~2 minutos

export function VincularTelegramCuenta() {
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
      void consultar();
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4 text-primary" />
          Telegram
        </CardTitle>
        <CardDescription>
          Vincule su Telegram para recibir alertas de seguridad y avisos de la
          red. El vínculo es personal e intransferible; deshacerlo requiere a
          un administrador o analista.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Consultando estado…
          </p>
        ) : vinculo ? (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="size-4" />
            Telegram vinculado
            {vinculo.telegram_username ? (
              <span className="text-muted-foreground">@{vinculo.telegram_username}</span>
            ) : null}
          </p>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void vincular()}
              disabled={generando}
              className="gap-2"
            >
              {generando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {esperando ? "Abrir Telegram de nuevo" : "Vincular Telegram"}
            </Button>
            {esperando && (
              <p className="text-xs leading-snug text-muted-foreground">
                En Telegram toque <span className="font-medium">INICIAR</span>; esta
                pantalla se actualizará sola.
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
