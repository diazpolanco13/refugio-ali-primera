/**
 * Intro tipo Google Earth: el mapa parte desde órbita y se acerca a Caracas
 * al mismo tiempo que se disuelve el splash o el login (`CapaLogin`).
 *
 * Flujo:
 * 1. CentrosMap monta en zoom órbita + globo → `avisarMapaOrbitaLista()`
 * 2. splash / CapaLogin inician fade → `avisarInicioSalidaOverlay()`
 * 3. CentrosMap escucha (2) y lanza `flyTo` a Caracas ~30 km
 */

type Listener = () => void;

const listenersSalida = new Set<Listener>();
const listenersOrbita = new Set<Listener>();
let salidaOverlayEmpezada = false;
let mapaOrbitaLista = false;
/** Una sola intro por carga de página (sobrevive remounts de StrictMode). */
let introYaLanzada = false;

/** Duración del acercamiento (ms). Más larga que el fade (900) para ver el vuelo. */
export const DURACION_INTRO_MAPA_MS = 2600;

/** Zoom inicial: planeta casi entero (requiere minZoom 0 + proyección globe). */
export const ZOOM_INTRO_ORBITA = 1.25;

/** Ancho de viewport objetivo al aterrizar (~30 km, etiqueta de escala "30k"). */
export const ANCHO_INTRO_DESTINO_METROS = 30_000;

/**
 * El fly arranca ANTES del fade del overlay. Así, al transparentarse el splash,
 * el mapa ya va en pleno zoom (no aparece estático un frame).
 */
export const ADELANTO_FLY_ANTES_FADE_MS = 180;

/** Si el overlay no avisa (edge case), no dejar el mapa colgado en órbita. */
export const TIMEOUT_INTRO_FALLBACK_MS = 5_000;

/** Splash/login: si el mapa no avisa órbita, no bloquear el fade para siempre. */
export const TIMEOUT_ESPERA_ORBITA_MS = 4_000;

export function preferirMenosMovimiento(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Emite al iniciar el fade del splash o del login. Idempotente. */
export function avisarInicioSalidaOverlay(): void {
  if (salidaOverlayEmpezada) return;
  salidaOverlayEmpezada = true;
  for (const l of [...listenersSalida]) l();
}

/**
 * Anula un aviso prematuro (p. ej. splash cerró sobre la pantalla de login
 * sin mapa debajo). El fly-in esperará al fade real de `CapaLogin`.
 */
export function invalidarSalidaOverlay(): void {
  salidaOverlayEmpezada = false;
}

/** Suscribe al inicio del fade. Si ya empezó, invoca en microtask. */
export function onInicioSalidaOverlay(cb: Listener): () => void {
  if (salidaOverlayEmpezada) {
    queueMicrotask(cb);
    return () => {};
  }
  listenersSalida.add(cb);
  return () => {
    listenersSalida.delete(cb);
  };
}

/** Mapa ya pintó la órbita (listo para que el overlay se disuelva encima). */
export function avisarMapaOrbitaLista(): void {
  if (mapaOrbitaLista) return;
  mapaOrbitaLista = true;
  for (const l of [...listenersOrbita]) l();
}

export function onMapaOrbitaLista(cb: Listener): () => void {
  if (mapaOrbitaLista) {
    queueMicrotask(cb);
    return () => {};
  }
  listenersOrbita.add(cb);
  return () => {
    listenersOrbita.delete(cb);
  };
}

/**
 * Reserva el slot de intro para este montaje del mapa.
 * false = ya se lanzó, o el usuario pide menos movimiento.
 */
export function reservarIntroMapa(): boolean {
  if (introYaLanzada) return false;
  if (preferirMenosMovimiento()) {
    introYaLanzada = true;
    return false;
  }
  return true;
}

export function marcarIntroMapaLanzada(): void {
  introYaLanzada = true;
}
