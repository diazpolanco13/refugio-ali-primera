import type { Rol, Usuario } from "../data/authSupabase";

/**
 * Metadatos y matriz de permisos de cada rol (ver docs/sistema-usuarios.md).
 *
 * | Rol          | Usuarios | Ver centros | Escribir     | Incidencias                    | Logs | Censo red |
 * |--------------|----------|-------------|--------------|--------------------------------|------|-----------|
 * | admin        | Sí       | Todos       | Todos        | Abrir/resolver en todos        | Sí   | Sí        |
 * | analista_sae | No       | Todos       | Todos        | Abrir/resolver en todos        | No   | Sí        |
 * | autoridad    | No       | Todos       | No           | No                             | Sí   | Sí        |
 * | supervisor   | No       | Asignados   | Asignados    | Abrir/resolver en asignados    | No   | No        |
 * | operador     | No       | Asignados   | Asignados    | Abrir; resolver solo las suyas | No   | No        |
 * | censo_rapido | No       | Todos       | No           | No                             | No   | No        |
 *
 * La RLS de Supabase aplica esta misma matriz en el servidor (migración
 * `sistema_usuarios_5_roles`); estos helpers solo controlan la UI.
 */
export interface InfoRol {
  rol: Rol;
  etiqueta: string;
  descripcion: string;
  /** Ve toda la red (lectura); si es false, solo sus centros asignados. */
  alcanceTotal: boolean;
  /** Puede editar datos operativos (dentro de su alcance). */
  puedeEscribir: boolean;
  /** Escribe en cualquier centro de la red (no solo en los asignados). */
  escrituraTotal: boolean;
  /** Crear, editar, eliminar usuarios y cambiar contraseñas. */
  puedeGestionarUsuarios: boolean;
  /** Ver la bitácora /logs. */
  puedeVerLogs: boolean;
  /** Registrar centros nuevos y eliminar centros. */
  puedeCrearCentros: boolean;
}

export const ROLES: Rol[] = [
  "admin",
  "analista_sae",
  "autoridad",
  "supervisor",
  "operador",
  "censo_rapido",
];

export const INFO_ROLES: Record<Rol, InfoRol> = {
  admin: {
    rol: "admin",
    etiqueta: "Administrador",
    descripcion: "Control total: toda la red, gestión de usuarios y logs",
    alcanceTotal: true,
    puedeEscribir: true,
    escrituraTotal: true,
    puedeGestionarUsuarios: true,
    puedeVerLogs: true,
    puedeCrearCentros: true,
  },
  analista_sae: {
    rol: "analista_sae",
    etiqueta: "Analista SAE",
    descripcion:
      "Opera toda la red (campamentos, reportes, incidencias); sin gestión de usuarios ni logs",
    alcanceTotal: true,
    puedeEscribir: true,
    escrituraTotal: true,
    puedeGestionarUsuarios: false,
    puedeVerLogs: false,
    puedeCrearCentros: true,
  },
  autoridad: {
    rol: "autoridad",
    etiqueta: "Autoridad",
    descripcion: "Solo lectura de toda la red y de los logs; no modifica nada",
    alcanceTotal: true,
    puedeEscribir: false,
    escrituraTotal: false,
    puedeGestionarUsuarios: false,
    puedeVerLogs: true,
    puedeCrearCentros: false,
  },
  supervisor: {
    rol: "supervisor",
    etiqueta: "Supervisor",
    descripcion:
      "Responsabilidad operativa integral sobre sus campamentos asignados (uno o varios)",
    alcanceTotal: false,
    puedeEscribir: true,
    escrituraTotal: false,
    puedeGestionarUsuarios: false,
    puedeVerLogs: false,
    puedeCrearCentros: false,
  },
  operador: {
    rol: "operador",
    etiqueta: "Operador",
    descripcion:
      "Reporta a diario en sus campamentos asignados; resuelve solo las incidencias que abrió",
    alcanceTotal: false,
    puedeEscribir: true,
    escrituraTotal: false,
    puedeGestionarUsuarios: false,
    puedeVerLogs: false,
    puedeCrearCentros: false,
  },
  censo_rapido: {
    rol: "censo_rapido",
    etiqueta: "Censo Rápido",
    descripcion:
      "Consulta el mapa de campamentos y los reportes diarios de toda la red; sin edición",
    alcanceTotal: true,
    puedeEscribir: false,
    escrituraTotal: false,
    puedeGestionarUsuarios: false,
    puedeVerLogs: false,
    puedeCrearCentros: false,
  },
};

export function permisosDeRol(rol: Rol): InfoRol {
  // Tolerancia a roles desconocidos (sesión vieja): solo lectura.
  return INFO_ROLES[rol] ?? INFO_ROLES.autoridad;
}

/** Puede editar datos operativos (dentro de su alcance). Reemplaza a `puedeEditarMapa`. */
export function puedeEscribir(rol: Rol): boolean {
  return permisosDeRol(rol).puedeEscribir;
}

export function puedeGestionarUsuarios(rol: Rol): boolean {
  return permisosDeRol(rol).puedeGestionarUsuarios;
}

export function puedeVerLogs(rol: Rol): boolean {
  return permisosDeRol(rol).puedeVerLogs;
}

/** Vista interna /centros/censo-rapido (resumen agregado del censo en terreno). */
export function puedeVerCensoRapidoRed(rol: Rol): boolean {
  return rol === "admin" || rol === "analista_sae" || rol === "autoridad";
}

/** Editar o eliminar registros del censo rápido (RLS: admin y analista SAE). */
export function puedeEditarCensoRapidoRed(rol: Rol): boolean {
  return rol === "admin" || rol === "analista_sae";
}

export function puedeCrearCentros(rol: Rol): boolean {
  return permisosDeRol(rol).puedeCrearCentros;
}

/** Rol con centros asignados como ámbito operativo o de monitoreo. */
export function rolUsaCentrosAsignados(rol: Rol): boolean {
  return rol === "analista_sae" || rol === "supervisor" || rol === "operador";
}

/** ¿Puede este usuario editar los datos de un centro concreto? */
export function puedeEditarCentro(usuario: Usuario, centroId: string): boolean {
  const info = permisosDeRol(usuario.rol);
  if (!info.puedeEscribir) return false;
  if (info.escrituraTotal) return true;
  return (usuario.centros_asignados ?? []).includes(centroId);
}

/**
 * ¿Puede este usuario resolver (o editar) una incidencia concreta?
 * El operador solo resuelve las que él mismo abrió (`creada_por`).
 */
export function puedeResolverIncidencia(
  usuario: Usuario,
  incidencia: { centro_id: string; creada_por?: string | null },
): boolean {
  const info = permisosDeRol(usuario.rol);
  if (!info.puedeEscribir) return false;
  if (info.escrituraTotal) return true;
  const enSusCentros = (usuario.centros_asignados ?? []).includes(incidencia.centro_id);
  if (!enSusCentros) return false;
  if (usuario.rol === "operador") return incidencia.creada_por === usuario.username;
  return true;
}

/** ¿Puede eliminar incidencias? Solo admin y analista SAE (RLS en Supabase). */
export function puedeVerSaludMental(rol: Rol): boolean {
  return rol !== "autoridad";
}

/** ¿Puede eliminar incidencias? Solo admin y analista SAE (RLS en Supabase). */
export function puedeEliminarIncidencia(usuario: Usuario): boolean {
  return usuario.rol === "admin" || usuario.rol === "analista_sae";
}

/** Rol restringido a mapa + reportes diarios (sin resto del menú). */
export function esRolCensoRapido(rol: Rol): boolean {
  return rol === "censo_rapido";
}

/** Rutas permitidas para el rol Censo Rápido. */
export function rutaPermitidaParaRol(pathname: string, rol: Rol): boolean {
  if (!esRolCensoRapido(rol)) return true;
  return (
    pathname === "/" ||
    pathname === "/centros/mapa" ||
    pathname.startsWith("/centros/reportes")
  );
}
