// Catálogo de usuarios con rol `supervisor` (revista rotatoria SEBIN).
// Requiere la policy `perfiles_select_supervisores` (ver supabase/).

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export interface SupervisorSebin {
  username: string;
  nombre: string;
  /** Centros ya asignados en el perfil (referencia; no se muta desde el form). */
  centros_asignados: string[];
}

/**
 * Lista de supervisores SEBIN para el selector de asignación del campamento.
 * Orden: por nombre. Si falla la lectura (RLS/red), devuelve [] sin romper el form.
 */
export function useSupervisoresSebin(): {
  supervisores: SupervisorSebin[];
  cargando: boolean;
} {
  const [supervisores, setSupervisores] = useState<SupervisorSebin[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargando(true);
      const { data, error } = await supabase
        .from("perfiles")
        .select("username, nombre, centros_asignados")
        .eq("rol", "supervisor")
        .order("nombre");
      if (cancelado) return;
      if (error) {
        console.warn("[useSupervisoresSebin]", error.message);
        setSupervisores([]);
      } else {
        setSupervisores(
          (data ?? [])
            .filter((r): r is { username: string; nombre: string | null; centros_asignados: string[] | null } =>
              Boolean(r.username),
            )
            .map((r) => ({
              username: r.username,
              nombre: (r.nombre ?? r.username).trim() || r.username,
              centros_asignados: Array.isArray(r.centros_asignados) ? r.centros_asignados : [],
            })),
        );
      }
      setCargando(false);
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { supervisores, cargando };
}
