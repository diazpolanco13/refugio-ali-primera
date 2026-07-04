// Cliente Supabase singleton para la nueva capa de datos (Fase 3 de la migración).
// Reemplaza al cliente ad-hoc de `supabase.ts` (que solo servía para Storage) y
// pasa a ser la puerta de entrada única a Postgres, Auth, Realtime y Storage.
//
// Lee la configuración de las vars de entorno `VITE_SUPABASE_URL` y
// `VITE_SUPABASE_ANON_KEY` (ver `.env.example`). Si faltan, NO rompe al importar
// (para no impedir el arranque de la app en un build sin secrets): solo lanza
// un error claro al *usar* el cliente, y expone `supabaseDisponible()` para que
// la UI pueda desactivar features que lo requieran.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ¿Está configurado Supabase (hay URL + anon key en el entorno)? */
export function supabaseDisponible(): boolean {
  return Boolean(URL && ANON);
}

/**
 * Cliente Supabase de la app. Se inicializa perezosamente en el primer acceso
 * para que el `import` no rompa en builds sin `VITE_SUPABASE_*`.
 * @throws Error descriptivo si faltan las vars de entorno.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    if (!URL || !ANON) {
      throw new Error(
        "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.",
      );
    }
    if (!(clienteCache as SupabaseClient | null)) {
      clienteCache = createClient(URL, ANON, {
        auth: {
          // La app es una PWA monousuario por dispositivo; mantenemos la sesión
          // en localStorage (default) y auto-refresh.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: { params: { eventsPerSecond: 10 } },
      });
    }
    return Reflect.get(clienteCache as SupabaseClient, prop);
  },
});

let clienteCache: SupabaseClient | null = null;
