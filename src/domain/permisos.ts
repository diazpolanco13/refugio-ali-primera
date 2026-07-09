import type { Rol, Usuario } from "../data/authSupabase";

/**
 * Metadatos y matriz de permisos de cada rol (ver docs/sistema-usuarios.md).
 *
 * | Rol          | Usuarios | Ver centros | Escribir     | Incidencias                    | Logs | Censo red | Censo ficha | Buzón        |
 * |--------------|----------|-------------|--------------|--------------------------------|------|-----------|-------------|--------------|
 * | admin        | Sí       | Todos       | Todos        | Abrir/resolver en todos        | Sí   | Sí        | Sí (editar) | Todos        |
 * | analista_sae | No       | Todos       | Todos        | Abrir/resolver en todos        | No   | Sí        | Sí (editar) | Todos        |
 * | autoridad    | No       | Todos       | No           | No                             | Sí   | Sí        | Solo lectura| Todos (leer) |
 * | supervisor   | No       | Asignados   | Asignados    | Abrir/resolver en asignados    | No   | No        | Asignados (editar) | Asignados |
 * | operador     | No       | Asignados   | Asignados    | Abrir; resolver solo las suyas | No   | No        | No          | No           |
 * | censo_rapido | No       | Todos       | No           | No                             | No   | Sí        | Solo lectura| No           |
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
      "Consulta el mapa de campamentos y el censo rápido de toda la red; sin edición",
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
  return (
    rol === "admin" ||
    rol === "analista_sae" ||
    rol === "autoridad" ||
    rol === "censo_rapido"
  );
}

/** Editar o eliminar registros del censo rápido en toda la red (admin / analista SAE). */
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

/**
 * Corregir reportes diarios de fechas anteriores: solo la sala (admin y
 * analista SAE). Los supervisores/operadores reportan únicamente el día en
 * curso.
 */
export function puedeEditarReportesPasados(usuario: Usuario): boolean {
  return usuario.rol === "admin" || usuario.rol === "analista_sae";
}

/** ¿Puede este usuario editar los datos de un centro concreto? */
export function puedeEditarCentro(usuario: Usuario, centroId: string): boolean {
  const info = permisosDeRol(usuario.rol);
  if (!info.puedeEscribir) return false;
  if (info.escrituraTotal) return true;
  return (usuario.centros_asignados ?? []).includes(centroId);
}

/**
 * Pestaña Censo de la ficha del campamento: roles de red + supervisor en
 * centros asignados (edición operativa del censo de su refugio).
 */
export function puedeVerCensoCentro(usuario: Usuario, centroId: string): boolean {
  if (puedeVerCensoRapidoRed(usuario.rol)) return true;
  return usuario.rol === "supervisor" && puedeEditarCentro(usuario, centroId);
}

/** Editar censo (registros, cierre/reapertura) en un campamento concreto. */
export function puedeEditarCensoCentro(usuario: Usuario, centroId: string): boolean {
  if (puedeEditarCensoRapidoRed(usuario.rol)) return true;
  return usuario.rol === "supervisor" && puedeEditarCentro(usuario, centroId);
}

/**
 * Pestaña Buzón (canal de denuncias del campamento): admin, analista SAE y
 * autoridad ven toda la red; el supervisor solo en sus campamentos asignados.
 * Alineado con la RLS de `denuncias_centros`.
 */
export function puedeVerBuzonCentro(usuario: Usuario, centroId: string): boolean {
  if (
    usuario.rol === "admin" ||
    usuario.rol === "analista_sae" ||
    usuario.rol === "autoridad"
  ) {
    return true;
  }
  return usuario.rol === "supervisor" && puedeEditarCentro(usuario, centroId);
}

/** Editar o soft-deletear denuncias de damnificados (sala: admin / analista SAE). */
export function puedeGestionarDenuncias(rol: Rol): boolean {
  return rol === "admin" || rol === "analista_sae";
}

/** Papelera de denuncias eliminadas (solo admin). */
export function puedeVerPapeleraDenuncias(rol: Rol): boolean {
  return rol === "admin";
}

export function puedeVerSaludMental(rol: Rol): boolean {
  return rol !== "autoridad";
}

/** Rol restringido a mapa + censo rápido (sin resto del menú). */
export function esRolCensoRapido(rol: Rol): boolean {
  return rol === "censo_rapido";
}

/**
 * Rol de la sesión de terreno (el QR del campamento): la credencial es un
 * código impreso y compartido, así que la UI se reduce a lo que ese personal
 * hace en el centro — reporte diario, población e infraestructura de SUS
 * campamentos. La RLS limita además los datos en el servidor.
 */
export function esRolTerreno(rol: Rol): boolean {
  return rol === "operador";
}

/** Pestañas de la ficha del campamento visibles para la sesión de terreno. */
export const SECCIONES_FICHA_TERRENO = [
  "resumen",
  "poblacion",
  "reporte",
  "infraestructura",
] as const;

/** Ruta de aterrizaje según el rol (destino de las redirecciones). */
export function rutaInicialDeRol(rol: Rol): string {
  return esRolTerreno(rol) ? "/centros/reportes" : "/centros/mapa";
}

/** Rutas permitidas para los roles restringidos (censo_rapido y operador). */
export function rutaPermitidaParaRol(pathname: string, rol: Rol): boolean {
  if (esRolCensoRapido(rol)) {
    return (
      pathname === "/" ||
      pathname === "/centros/mapa" ||
      pathname.startsWith("/centros/censo-rapido")
    );
  }
  if (esRolTerreno(rol)) {
    return (
      pathname === "/" ||
      pathname === "/centros/reportes" ||
      pathname.startsWith("/centros/reportes/")
    );
  }
  return true;
}
