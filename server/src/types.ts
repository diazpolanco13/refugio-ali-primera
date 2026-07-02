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
  /** Jerarquía / cargo dentro de la estructura de gestión. */
  jerarquia: string | null;
  /** Cédula de identidad. */
  cedula: string | null;
  /** Responsabilidad / función concreta. */
  responsabilidad: string | null;
  /** Teléfono de WhatsApp. */
  whatsapp: string | null;
  /** Teléfono de Telegram. */
  telegram: string | null;
  /** Código del brazalete físico de acreditación. */
  brazalete: string | null;
  /** Identificador de sistema (marca de agua anti-foto). */
  hash_id: string | null;
  /** Mostrar la marca de agua de seguridad en la pantalla de este usuario. */
  marca_agua: boolean;
}

export interface TokenPayload {
  sub: string; // id
  username: string;
  nombre: string | null;
  rol: Rol;
  /** Sector del que es responsable (solo campo). null = ninguno. */
  sector_asignado: string | null;
  /** Identificador de sistema para la marca de agua anti-foto. */
  hash_id: string | null;
  /** Mostrar la marca de agua de seguridad en la pantalla de este usuario. */
  marca_agua: boolean;
}

// Fila de sincronización (sector o punto): metadatos + blob JSON.
export interface FilaSync {
  id: string;
  updated_at: number;
  updated_by: string | null;
  deleted: boolean;
  data: unknown;
}

export type Entidad =
  | "sectores"
  | "puntos"
  | "lineas"
  | "censos"
  | "distribuciones"
  | "limpiezas";
