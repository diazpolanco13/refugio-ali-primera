import { matchPath } from "react-router-dom";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { ETIQUETAS_SECCION_FICHA } from "@/features/centros/seccionesFichaCentro";

export interface MigaPan {
  label: string;
  to?: string;
}

const INICIO: MigaPan = { label: "Inicio", to: "/centros/mapa" };
const CAMPAMENTOS: MigaPan = { label: "Campamentos", to: "/centros/tablero" };
const INCIDENCIAS: MigaPan = { label: "Incidencias", to: "/incidencias/funcionarios" };

function nombreCentro(centro: CentroTransitorio | undefined, id: string): string {
  if (!centro) return "Campamento…";
  return centro.nombre || id;
}

function migasDetalleCentro(
  id: string,
  baseCentro: string,
  searchParams: URLSearchParams,
  centro: CentroTransitorio | undefined,
  encabezado: MigaPan[],
): MigaPan[] {
  const nombre = nombreCentro(centro, id);
  const vista = searchParams.get("vista");
  const reportar = searchParams.get("reportar") === "1";
  const registrar = searchParams.get("registrar") === "1";
  const refugiadoId = searchParams.get("refugiado");
  const basePoblacion = `${baseCentro}?vista=poblacion`;
  const migas: MigaPan[] = [...encabezado, { label: nombre, to: baseCentro }];

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
    const etiqueta =
      ETIQUETAS_SECCION_FICHA[vista as keyof typeof ETIQUETAS_SECCION_FICHA] ?? vista;
    migas.push({ label: etiqueta });
  }

  return migas;
}

function migasCentro(
  pathname: string,
  searchParams: URLSearchParams,
  centro: CentroTransitorio | undefined,
): MigaPan[] {
  const match = matchPath("/centro/:id", pathname);
  if (!match?.params.id) return [];

  return migasDetalleCentro(match.params.id, `/centro/${match.params.id}`, searchParams, centro, [
    INICIO,
    CAMPAMENTOS,
  ]);
}

function migasReportesCentro(
  pathname: string,
  searchParams: URLSearchParams,
  centro: CentroTransitorio | undefined,
): MigaPan[] {
  const match = matchPath("/centros/reportes/:centroId", pathname);
  if (!match?.params.centroId) return [];

  return migasDetalleCentro(
    match.params.centroId,
    `/centros/reportes/${match.params.centroId}`,
    searchParams,
    centro,
    [INICIO, CAMPAMENTOS, { label: "Reportes diarios", to: "/centros/reportes" }],
  );
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

  if (pathname === "/centros/censo-rapido/personas") {
    return [
      INICIO,
      CAMPAMENTOS,
      { label: "Censo rápido (red)", to: "/centros/censo-rapido" },
      { label: "Listado general" },
    ];
  }

  const matchCensoCentro = matchPath("/centros/censo-rapido/:centroId", pathname);
  if (matchCensoCentro?.params.centroId && matchCensoCentro.params.centroId !== "personas") {
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

  if (matchPath("/centros/reportes/:centroId", pathname)) {
    return migasReportesCentro(pathname, searchParams, centro);
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
    } else {
      migas.push({ label: "Bandeja" });
    }
    return migas;
  }

  if (pathname === "/usuarios") {
    return [INICIO, { label: "Gestión de usuarios" }];
  }

  if (pathname === "/config/unidades-sebin" || pathname === "/config/sistema") {
    return [INICIO, { label: "Unidades SEBIN" }];
  }

  if (pathname === "/logs") {
    return [INICIO, { label: "Bitácora de acciones" }];
  }

  if (pathname === "/config/perfil") {
    return [INICIO, { label: "Preferencias de cuenta" }];
  }

  return [INICIO];
}
