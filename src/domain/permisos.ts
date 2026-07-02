import type { Rol } from "../data/auth";

/** Metadatos de cada rol para la UI y chequeos de permiso. */
export interface InfoRol {
  rol: Rol;
  etiqueta: string;
  descripcion: string;
  /** Dibujar, agregar y editar sectores/puntos/líneas; marcar limpio. */
  puedeEditarMapa: boolean;
  /** Crear y modificar cuentas de usuario. */
  puedeGestionarUsuarios: boolean;
}

export const ROLES: Rol[] = ["admin", "coordinador", "campo", "visor"];

export const INFO_ROLES: Record<Rol, InfoRol> = {
  admin: {
    rol: "admin",
    etiqueta: "Administrador",
    descripcion: "Control total: mapa, datos y gestión de usuarios",
    puedeEditarMapa: true,
    puedeGestionarUsuarios: true,
  },
  coordinador: {
    rol: "coordinador",
    etiqueta: "Coordinador",
    descripcion: "Crear y editar elementos del mapa; sincronizar cambios",
    puedeEditarMapa: true,
    puedeGestionarUsuarios: false,
  },
  campo: {
    rol: "campo",
    etiqueta: "Campo",
    descripcion: "Crear y editar elementos del mapa en terreno",
    puedeEditarMapa: true,
    puedeGestionarUsuarios: false,
  },
  visor: {
    rol: "visor",
    etiqueta: "Visor",
    descripcion: "Solo consulta: mapa y tablero sin edición",
    puedeEditarMapa: false,
    puedeGestionarUsuarios: false,
  },
};

export function permisosDeRol(rol: Rol): InfoRol {
  return INFO_ROLES[rol];
}

export function puedeEditarMapa(rol: Rol): boolean {
  return INFO_ROLES[rol].puedeEditarMapa;
}

export function puedeGestionarUsuarios(rol: Rol): boolean {
  return INFO_ROLES[rol].puedeGestionarUsuarios;
}
