// Roles del sistema.
export type Rol = "admin" | "coordinador" | "campo" | "visor";

export const ROLES: Rol[] = ["admin", "coordinador", "campo", "visor"];

export interface Usuario {
  id: string;
  username: string;
  nombre: string | null;
  rol: Rol;
  sector_asignado: string | null;
  created_at: number;
}

export interface TokenPayload {
  sub: string; // id
  username: string;
  nombre: string | null;
  rol: Rol;
}

// Fila de sincronización (sector o punto): metadatos + blob JSON.
export interface FilaSync {
  id: string;
  updated_at: number;
  updated_by: string | null;
  deleted: boolean;
  data: unknown;
}

export type Entidad = "sectores" | "puntos" | "lineas" | "censos";
