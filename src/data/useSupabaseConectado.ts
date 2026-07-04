// Hook de estado de conexión a Supabase para la UI (Fase 4).
//
// Reemplaza al `useEstadoSync` legacy (que reportaba "sincronizando"/"error"/
//"ok" del motor Dexie↔Fastify). Con Supabase no hay cola ni motor de sync: la
// app lee y escribe directamente contra Postgres vía supabase-js, y Realtime
// refresca la UI. Lo que sí tiene sentido mostrar es si hay conexión al
// servidor de Supabase y si la sesión está activa.
//
// Devuelve `true` cuando hay un canal de Realtime conectado (o en proceso de
// reconexión) Y hay sesión; `false` si no hay sesión o el canal cae en error
// persistente. No distingue "sincronizando" (con Supabase cada mutación es
// directa) — solo "conectado" o "desconectado".

import { useEffect, useState } from "react";
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getSesion } from "./authSupabase";

export function useSupabaseConectado(): boolean {
  const [conectado, setConectado] = useState<boolean>(() => Boolean(getSesion()));
  const [online, setOnline] = useState<boolean>(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      setConectado(false);
      return;
    }
    // Probe ligero: abrir un canal anónimo y escuchar su estado. Si Supabase
    // responde (SUBSCRIBED) marcamos conectado; si cae en CHANNEL_ERROR o
    // TIMED_OUT, desconectado. El canal se cierra al desmontar.
    let cancelado = false;
    const canal = supabase
      .channel(`conexion-${Math.random().toString(36).slice(2)}`)
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (cancelado) return;
        if (status === "SUBSCRIBED") setConectado(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConectado(false);
      });
    return () => {
      cancelado = true;
      void supabase.removeChannel(canal);
    };
  }, [online]);

  // Si no hay sesión, no estamos "conectados" en sentido útil para la UI.
  return conectado && Boolean(getSesion());
}
