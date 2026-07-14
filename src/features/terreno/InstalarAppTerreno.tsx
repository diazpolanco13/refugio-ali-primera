// CTA para instalar la PWA desde /terreno: Android (prompt nativo) o iOS
// (instrucciones Compartir → Añadir a pantalla de inicio).

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  descartarInstalacion,
  esIosSafari,
  escucharAntesDeInstalar,
  instalacionDescartada,
  lanzarInstalacion,
  suscribirEventoInstalar,
  yaEstaInstalada,
  type EventoAntesDeInstalar,
} from "@/lib/instalarPwa";

export function InstalarAppTerreno() {
  const [evento, setEvento] = useState<EventoAntesDeInstalar | null>(null);
  const [instalada, setInstalada] = useState(() => yaEstaInstalada());
  const [descartada, setDescartada] = useState(() => instalacionDescartada());
  const [guiaIos, setGuiaIos] = useState(false);
  const [instalando, setInstalando] = useState(false);

  const ios = esIosSafari();

  useEffect(() => {
    const offListen = escucharAntesDeInstalar();
    const offSub = suscribirEventoInstalar(setEvento);
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setInstalada(yaEstaInstalada());
    mq.addEventListener?.("change", onChange);
    return () => {
      offListen();
      offSub();
      mq.removeEventListener?.("change", onChange);
    };
  }, []);

  if (instalada || descartada) return null;
  // Android: solo si el navegador ofrece el prompt. iOS: siempre (salvo ya instalada).
  if (!ios && !evento) return null;

  const instalar = async () => {
    if (ios) {
      setGuiaIos(true);
      return;
    }
    if (!evento) return;
    setInstalando(true);
    const outcome = await lanzarInstalacion(evento);
    setInstalando(false);
    if (outcome === "accepted") setInstalada(true);
  };

  const ocultar = () => {
    descartarInstalacion();
    setDescartada(true);
  };

  return (
    <>
      <section
        aria-label="Instalar aplicación"
        className="w-full space-y-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3.5"
      >
        <div className="flex items-start gap-3">
          <Download
            className="mt-0.5 size-8 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Instalar en este teléfono
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Queda como app en la pantalla de inicio: más rápida, a pantalla
              completa y lista sin buscar el enlace.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={ocultar}
            aria-label="Ocultar sugerencia de instalación"
            className="shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            className="h-11 flex-1"
            onClick={() => void instalar()}
            disabled={instalando}
          >
            <Download className="size-4" data-icon="inline-start" />
            {instalando ? "Instalando…" : ios ? "Cómo instalar" : "Instalar app"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={ocultar}
          >
            Ahora no
          </Button>
        </div>
      </section>

      <AlertDialog open={guiaIos} onOpenChange={setGuiaIos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Instalar en iPhone / iPad</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Safari no muestra un botón de instalar. Hágalo así:</p>
                <ol className="list-decimal space-y-2 pl-4 text-foreground">
                  <li>
                    Toque{" "}
                    <span className="inline-flex items-center gap-1 font-medium">
                      Compartir <Share className="inline size-3.5" aria-hidden="true" />
                    </span>{" "}
                    en la barra de Safari.
                  </li>
                  <li>
                    Elija <span className="font-medium">Añadir a pantalla de inicio</span>.
                  </li>
                  <li>
                    Confirme con <span className="font-medium">Añadir</span>.
                  </li>
                </ol>
                <p className="text-xs">
                  Use Safari (no Chrome en iOS). El icono «Campamentos» aparecerá
                  junto a las demás apps.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction type="button">Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
