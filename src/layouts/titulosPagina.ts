import { matchPath } from "react-router-dom";

const TITULOS: { pattern: string; titulo: string }[] = [
  { pattern: "/centros/mapa", titulo: "Mapa de campamentos" },
  { pattern: "/centros/tablero", titulo: "Campamentos" },
  { pattern: "/centros/traslados", titulo: "Traslados entre campamentos" },
  { pattern: "/centros/reportes", titulo: "Reportes diarios (red)" },
  { pattern: "/centro/nuevo", titulo: "Registrar campamento nuevo" },
  { pattern: "/centro/:id", titulo: "Ficha del campamento" },
  { pattern: "/incidencias/funcionarios", titulo: "Incidencias — funcionarios" },
  { pattern: "/incidencias/refugiados", titulo: "Incidencias — refugiados" },
  { pattern: "/incidencias/archivadas", titulo: "Incidencias archivadas" },
  { pattern: "/incidencias/analitica", titulo: "Incidencias — analítica" },
  { pattern: "/usuarios", titulo: "Gestión de usuarios" },
  { pattern: "/logs", titulo: "Bitácora de acciones" },
  { pattern: "/config/perfil", titulo: "Preferencias de cuenta" },
  { pattern: "/config/sistema", titulo: "Catálogos y parámetros" },
];

export function tituloDeRuta(pathname: string): string {
  for (const { pattern, titulo } of TITULOS) {
    if (matchPath(pattern, pathname)) return titulo;
  }
  return "Campamentos Transitorios";
}
