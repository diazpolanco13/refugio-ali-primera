// Tarjeta "Telegram" de la ficha de edición de usuario (/usuarios/:id/editar):
// muestra el estado real del vínculo con el bot @camp_inteligent_bot y permite
// al admin/analista generar el enlace de vinculación PARA ese usuario (RPC
// `telegram_generar_vinculo(p_user_id)`, se comparte por WhatsApp y la persona
// solo toca INICIAR) o desvincularlo. Complementa el autoservicio de
// Preferencias de cuenta (VincularTelegramCuenta) y el de /terreno.

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, Copy, Link2, Loader2, Send, X } from "lucide-react";
import {
  desvincularTelegram,
  generarVinculoTelegram,
  urlVinculoTelegram,
  vinculosTelegramDeUsuarios,
  type VinculoTelegram,
} from "@/data/telegramOperador";
import { registrarHistorial } from "@/data/historial";
import { copiarTexto } from "@/lib/portapapeles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function VinculoTelegramUsuario({
  userId,
  nombre,
  username,
}: {
  userId: string;
  nombre: string;
  username: string | null;
}) {
  const [vinculo, setVinculo] = useState<VinculoTelegram | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [enlace, setEnlace] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [confirmarDesvincular, setConfirmarDesvincular] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [error, setError] = useState("");

  const consultar = useCallback(async () => {
    try {
      const m = await vinculosTelegramDeUsuarios([userId]);
      const v = m.get(userId) ?? null;
      setVinculo(v);
      if (v) setEnlace("");
      return v;
    } catch {
      return null;
    } finally {
      setCargando(false);
    }
  }, [userId]);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  // Con un enlace pendiente, re-consultar al volver el foco (el vínculo llega
  // por el webhook del bot cuando la persona toca INICIAR).
  useEffect(() => {
    if (!enlace || vinculo) return;
    const alFoco = () => void consultar();
    window.addEventListener("focus", alFoco);
    return () => window.removeEventListener("focus", alFoco);
  }, [enlace, vinculo, consultar]);

  async function generar() {
    setGenerando(true);
    setError("");
    setCopiado(false);
    try {
      const token = await generarVinculoTelegram(userId);
      setEnlace(urlVinculoTelegram(token));
      registrarHistorial("generar_vinculo_telegram", "usuario", userId, {
        username,
        nombre,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el enlace.");
      void consultar();
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    if (await copiarTexto(enlace)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  }

  async function desvincular() {
    setDesvinculando(true);
    setError("");
    try {
      await desvincularTelegram({ userId, username });
      setVinculo(null);
      setConfirmarDesvincular(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desvincular.");
      setConfirmarDesvincular(false);
    } finally {
      setDesvinculando(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Send className="size-4 text-sky-600 dark:text-sky-400" />
          Vínculo Telegram (bot)
        </p>
        {cargando ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : vinculo ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="size-3.5" />
            Vinculado
            {vinculo.telegram_username ? (
              <span className="text-muted-foreground">@{vinculo.telegram_username}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin vincular</span>
        )}
      </div>

      {!cargando && vinculo && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full text-destructive"
          disabled={desvinculando}
          onClick={() => setConfirmarDesvincular(true)}
        >
          <X className="size-3.5" />
          Desvincular Telegram
        </Button>
      )}

      {!cargando && !vinculo && !enlace && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full border-sky-500/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
            disabled={generando}
            onClick={() => void generar()}
          >
            {generando ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            Generar enlace de vinculación
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Envíele el enlace (WhatsApp, etc.); al abrirlo y tocar INICIAR en el
            bot, queda vinculado. También puede hacerlo él mismo desde
            Preferencias de cuenta.
          </p>
        </>
      )}

      {!cargando && !vinculo && enlace && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={enlace}
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-2 font-mono text-[11px] text-foreground"
              aria-label="Enlace de vinculación Telegram"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => void copiar()}
            >
              {copiado ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Válido por <span className="font-medium text-foreground">1 hora</span> y de un
            solo uso. Solo {nombre || "el usuario"} debe abrirlo: el Telegram que
            toque INICIAR queda vinculado a su cuenta. Esta tarjeta se actualiza
            al volver a esta pestaña.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <AlertDialog
        open={confirmarDesvincular}
        onOpenChange={(abierto) => !abierto && !desvinculando && setConfirmarDesvincular(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular Telegram de {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              {vinculo?.telegram_username
                ? `Se elimina el vínculo con @${vinculo.telegram_username}. `
                : "Se elimina el vínculo con su chat de Telegram. "}
              Dejará de recibir alertas de seguridad y avisos por Telegram hasta
              que se vuelva a vincular.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desvinculando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={desvinculando}
              onClick={(e) => {
                e.preventDefault();
                void desvincular();
              }}
            >
              {desvinculando ? <Loader2 className="size-4 animate-spin" /> : null}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
