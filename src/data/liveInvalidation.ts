// Invalidación ligera tras mutaciones: los hooks live vuelven a hacer select
// sin esperar a Realtime (que a veces llega tarde o no llega en la misma pestaña).

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

/** Suscribe un callback a mutaciones de una tabla lógica. Devuelve unsubscribe. */
export function suscribirMutacionLive(tabla: string, listener: Listener): () => void {
  let set = listeners.get(tabla);
  if (!set) {
    set = new Set();
    listeners.set(tabla, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(tabla);
  };
}

/** Avisa a los hooks que deben reconsultar tras un upsert/update/delete. */
export function notificarMutacionLive(tabla: string): void {
  const set = listeners.get(tabla);
  if (!set) return;
  for (const listener of set) {
    try {
      listener();
    } catch (err) {
      console.warn(`[liveInvalidation] listener ${tabla}:`, err);
    }
  }
}
