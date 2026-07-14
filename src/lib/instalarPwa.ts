// Detección e instalación de la PWA (Android Chrome vía beforeinstallprompt;
// iOS Safari solo permite "Añadir a pantalla de inicio" desde el menú Compartir).

const CLAVE_DESCARTAR = "pwa-instalar-descartado";

export type EventoAntesDeInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let eventoPendiente: EventoAntesDeInstalar | null = null;
const oyentes = new Set<(e: EventoAntesDeInstalar | null) => void>();

function notificar(): void {
  for (const fn of oyentes) fn(eventoPendiente);
}

/** Registra el listener global una sola vez (llamar al montar la app de campo). */
export function escucharAntesDeInstalar(): () => void {
  if (typeof window === "undefined") return () => {};

  const onBefore = (ev: Event) => {
    ev.preventDefault();
    eventoPendiente = ev as EventoAntesDeInstalar;
    notificar();
  };
  const onInstalled = () => {
    eventoPendiente = null;
    notificar();
  };

  window.addEventListener("beforeinstallprompt", onBefore);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onBefore);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function suscribirEventoInstalar(
  fn: (e: EventoAntesDeInstalar | null) => void,
): () => void {
  oyentes.add(fn);
  fn(eventoPendiente);
  return () => {
    oyentes.delete(fn);
  };
}

export function yaEstaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function esIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  // Chrome/Firefox iOS no disparan beforeinstallprompt tampoco; misma guía.
  return true;
}

export function instalacionDescartada(): boolean {
  try {
    return localStorage.getItem(CLAVE_DESCARTAR) === "1";
  } catch {
    return false;
  }
}

export function descartarInstalacion(): void {
  try {
    localStorage.setItem(CLAVE_DESCARTAR, "1");
  } catch {
    /* sin persistencia */
  }
}

export async function lanzarInstalacion(
  evento: EventoAntesDeInstalar,
): Promise<"accepted" | "dismissed" | "unavailable"> {
  try {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    eventoPendiente = null;
    notificar();
    return outcome;
  } catch {
    return "unavailable";
  }
}
