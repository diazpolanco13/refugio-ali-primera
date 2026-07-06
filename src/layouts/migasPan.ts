import { matchPath } from "react-router-dom";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

export interface MigaPan {
  label: string;
  to?: string;
}

const ETIQUETAS_VISTA: Record<string, string> = {
  resumen: "Resumen",
  coordinacion: "Coordinación",
  poblacion: "Población",
  reporte: "Reporte",
  incidencias: "Incidencias",
  infraestructura: "Infraestructura",
  capacidad: "Capacidad",
};

const INICIO: MigaPan = { label: "Inicio", to: "/centros/mapa" };
const CAMPAMENTOS: MigaPan = { label: "Campamentos", to: "/centros/tablero" };
const INCIDENCIAS: MigaPan = { label: "Incidencias", to: "/incidencias/funcionarios" };

function nombreCentro(centro: CentroTransitorio | undefined, id: string): string {
  if (!centro) return "Campamento…";
  return centro.nombre || id;
}

function migasCentro(
  pathname: string,
  searchParams: URLSearchParams,
  centro: CentroTransitorio | undefined,
): MigaPan[] {
  const match = matchPath("/centro/:id", pathname);
  if (!match?.params.id) return [];

  const id = match.params.id;
  const nombre = nombreCentro(centro, id);

  if (pathname === "/centro/nuevo") {
    return [INICIO, CAMPAMENTOS, { label: "Nuevo campamento" }];
  }

  const vista = searchParams.get("vista");
  const reportar = searchParams.get("reportar") === "1";
  const editar = searchParams.get("editar") === "1";
  const registrar = searchParams.get("registrar") === "1";
  const refugiadoId = searchParams.get("refugiado");

  const baseCentro = `/centro/${id}`;
  const basePoblacion = `${baseCentro}?vista=poblacion`;
  const migas: MigaPan[] = [
    INICIO,
    CAMPAMENTOS,
    { label: nombre, to: baseCentro },
  ];

  if (editar) {
    migas.push({ label: "Editar campamento" });
    return migas;
  }

  if (reportar) {
    migas.push({ label: "Reporte del día" });
    return migas;
  }

  if (registrar) {
    migas.push({ label: "Población", to: basePoblacion });
    migas.push({ label: "Registrar persona" });
    return migas;
  }

  if (refugiadoId) {
    migas.push({ label: "Población", to: basePoblacion });
    migas.push({ label: "Detalle damnificado" });
    return migas;
  }

  if (vista && vista !== "resumen") {
    const etiqueta = ETIQUETAS_VISTA[vista] ?? vista;
    migas.push({ label: etiqueta });
  }

  return migas;
}

/** Construye la ruta de migas según pathname, query y datos opcionales del centro. */
export function migasPanDeRuta(
  pathname: string,
  searchParams: URLSearchParams,
  centro?: CentroTransitorio,
): MigaPan[] {
  if (pathname === "/" || pathname === "/centros/mapa") {
    return [INICIO, { label: "Mapa" }];
  }

  if (pathname === "/centros/tablero") {
    return [INICIO, { label: "Campamentos" }];
  }

  if (pathname === "/centros/reportes") {
    return [INICIO, CAMPAMENTOS, { label: "Reportes diarios" }];
  }

  if (pathname === "/centros/refugiados") {
    return [INICIO, CAMPAMENTOS, { label: "Población (red)" }];
  }

  const matchRefugiadoRed = matchPath("/centros/refugiados/:alojamientoId", pathname);
  if (matchRefugiadoRed?.params.alojamientoId) {
    return [
      INICIO,
      CAMPAMENTOS,
      { label: "Población (red)", to: "/centros/refugiados" },
      { label: "Detalle damnificado" },
    ];
  }

  if (pathname === "/centros/traslados") {
    return [INICIO, CAMPAMENTOS, { label: "Traslados" }];
  }

  if (pathname === "/centros/censo-rapido") {
    return [INICIO, CAMPAMENTOS, { label: "Censo rápido (red)" }];
  }

  const matchCensoCentro = matchPath("/centros/censo-rapido/:centroId", pathname);
  if (matchCensoCentro?.params.centroId) {
    return [
      INICIO,
      CAMPAMENTOS,
      { label: "Censo rápido (red)", to: "/centros/censo-rapido" },
      { label: nombreCentro(centro, matchCensoCentro.params.centroId) },
    ];
  }

  if (pathname === "/centro/nuevo") {
    return [INICIO, CAMPAMENTOS, { label: "Nuevo campamento" }];
  }

  if (matchPath("/centro/:id", pathname)) {
    return migasCentro(pathname, searchParams, centro);
  }

  if (pathname.startsWith("/incidencias")) {
    const migas: MigaPan[] = [INICIO, INCIDENCIAS];
    if (pathname === "/incidencias/funcionarios") {
      migas.push({ label: "Bandeja funcionarios" });
    } else if (pathname === "/incidencias/refugiados") {
      migas.push({ label: "Bandeja damnificados" });
    } else if (pathname === "/incidencias/archivadas") {
      migas.push({ label: "Archivadas" });
    } else if (pathname === "/incidencias/analitica") {
      migas.push({ label: "Calendario / analítica" });
    } else {
      migas.push({ label: "Bandeja" });
    }
    return migas;
  }

  if (pathname === "/usuarios") {
    return [INICIO, { label: "Gestión de usuarios" }];
  }

  if (pathname === "/logs") {
    return [INICIO, { label: "Bitácora de acciones" }];
  }

  if (pathname === "/config/perfil") {
    return [INICIO, { label: "Preferencias de cuenta" }];
  }

  if (pathname === "/config/sistema") {
    return [INICIO, { label: "Catálogos y parámetros" }];
  }

  return [INICIO];
}
