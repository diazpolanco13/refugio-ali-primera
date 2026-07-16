// Banner global (bajo el TopBar): usuarios permanentes sin Telegram
// vinculado ven la invitación a actualizar sus datos en Preferencias de
// cuenta (/config/perfil), donde está la tarjeta de vínculo. Descartable por
// sesión de pestaña; desaparece solo al vincular.

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Send, X } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { miVinculoTelegram } from "@/data/telegramOperador";
import { puedeEditarCuentaPropia } from "@/domain/permisos";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "banner_telegram_descartado_v1";

export function BannerVincularTelegram({ sesion }: { sesion: Sesion }) {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  const aplica = puedeEditarCuentaPropia(sesion.user) && !pathname.startsWith("/config/perfil");

  useEffect(() => {
    if (!aplica) {
      setVisible(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* seguir */
    }
    let cancelado = false;
    void miVinculoTelegram()
      .then((v) => {
        if (!cancelado) setVisible(v === null);
      })
      .catch(() => {
        /* sin red o sin permiso: no molestar */
      });
    return () => {
      cancelado = true;
    };
  }, [aplica, pathname]);

  if (!aplica || !visible) return null;

  function descartar() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* seguir */
    }
    setVisible(false);
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm">
      <Send className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-xs sm:text-sm">
        <span className="font-medium">Su Telegram no está vinculado.</span>{" "}
        <span className="text-muted-foreground">
          Vincúlelo para recibir alertas de seguridad y avisos de la red.
        </span>
      </p>
      <Button asChild size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 border-sky-500/50 text-sky-700 hover:bg-sky-500/15 dark:text-sky-300">
        <Link to="/config/perfil">Actualizar mis datos</Link>
      </Button>
      <button
        type="button"
        onClick={descartar}
        aria-label="Descartar aviso"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
