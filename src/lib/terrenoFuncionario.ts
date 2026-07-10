// Persistencia de la identificación del operador en /terreno (por pestaña).
// sessionStorage: al cerrar la pestaña hay que volver a identificarse; así
// varias personas pueden usar el mismo QR en el mismo dispositivo.

import type { FuncionarioCenso } from "@/data/reposCenso";

const STORAGE_KEY = "terreno_operador_sesion_v1";

export interface SesionOperadorTerreno {
  centroId: string;
  username: string;
  funcionario: FuncionarioCenso;
}

export function funcionarioTerrenoVacio(): FuncionarioCenso {
  return { jerarquia: "", nombre: "", institucion: "", telefono: "" };
}

export function cargarSesionOperadorTerreno(centroId: string): SesionOperadorTerreno | null {
  if (!centroId) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SesionOperadorTerreno;
    if (parsed?.centroId !== centroId) return null;
    if (!parsed.username || !parsed.funcionario?.nombre?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function guardarSesionOperadorTerreno(sesion: SesionOperadorTerreno): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
  } catch {
    /* ignorar */
  }
}

export function olvidarSesionOperadorTerreno(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
}

/** Misma persona (teléfono + nombre + institución), para reutilizar sesión Auth. */
export function mismaHuellaFuncionario(
  a: FuncionarioCenso | null | undefined,
  b: FuncionarioCenso | null | undefined,
): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const tel = (s: string) => s.replace(/\D/g, "");
  return (
    tel(a.telefono) === tel(b.telefono) &&
    norm(a.nombre) === norm(b.nombre) &&
    norm(a.institucion) === norm(b.institucion)
  );
}
