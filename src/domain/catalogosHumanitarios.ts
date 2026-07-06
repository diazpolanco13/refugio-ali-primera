// Catálogos cerrados para censos humanitarios (estadísticas agregables).

/** Nacionalidades frecuentes en la red de refugios. */
export const CATALOGO_NACIONALIDADES = [
  "Venezolana",
  "Colombiana",
  "Ecuatoriana",
  "Peruana",
  "Haitiana",
  "Dominicana",
  "Brasileña",
  "Argentina",
  "Chilena",
  "Boliviana",
  "Paraguaya",
  "Uruguaya",
  "Mexicana",
  "Centroamericana",
  "Española",
  "Portuguesa",
  "Italiana",
  "Siria",
  "Libanesa",
  "China",
  "Otra",
] as const;

export type NacionalidadCatalogo = (typeof CATALOGO_NACIONALIDADES)[number];

/** Países para dirección de residencia afectada. */
export const CATALOGO_PAISES = [
  "Venezuela",
  "Colombia",
  "Ecuador",
  "Perú",
  "Brasil",
  "Haití",
  "República Dominicana",
  "Otro",
] as const;

export type PaisCatalogo = (typeof CATALOGO_PAISES)[number];

/** Valor guardado cuando el operador no conoce municipio o parroquia. */
export const OPCION_GEO_NO_SE = "NO SE";

/** Valor guardado cuando no se conoce la cédula del jefe de familia de un menor. */
export const CEDULA_JEFE_NO_SE = "NO SE";

/** Estados de la zona de la emergencia (planilla de censo en campo). */
export const ESTADOS_CENSO_METROPOLITANA: { valor: string; label: string }[] = [
  { valor: "Distrito Capital", label: "Caracas" },
  { valor: "Miranda", label: "Miranda" },
  { valor: "La Guaira", label: "La Guaira" },
];

/** Forma de alojamiento dentro del campamento (campo `tipo_alojamiento`). */
export const CATALOGO_TIPOS_ALOJAMIENTO = [
  { valor: "litera", label: "Litera o cama en salón" },
  { valor: "piso", label: "Colchón en el piso" },
  { valor: "carpa", label: "Carpa individual o familiar" },
  { valor: "modulo", label: "Módulo o contenedor" },
  { valor: "aula", label: "Aula o salón compartido" },
  { valor: "familia", label: "Espacio familiar delimitado" },
  { valor: "otro", label: "Otro" },
] as const;

export type TipoAlojamientoCatalogo = (typeof CATALOGO_TIPOS_ALOJAMIENTO)[number]["valor"];

interface MunicipioGeo {
  nombre: string;
  parroquias: string[];
}

interface DivisionVenezuela {
  estado: string;
  municipios: MunicipioGeo[];
}

/** División político-territorial de Venezuela (énfasis Área Metropolitana y La Guaira). */
export const DIVISIONES_VENEZUELA: DivisionVenezuela[] = [
  {
    estado: "Distrito Capital",
    municipios: [
      {
        nombre: "Libertador",
        parroquias: [
          "23 de Enero",
          "Altagracia",
          "Antímano",
          "Candelaria",
          "Caricuao",
          "Catedral",
          "Coche",
          "El Junquito",
          "El Paraíso",
          "El Recreo",
          "El Valle",
          "La Pastora",
          "La Vega",
          "Macarao",
          "San Agustín",
          "San Bernardino",
          "San José",
          "San Juan",
          "San Pedro",
          "Santa Rosalía",
          "Santa Teresa",
          "Sucre",
        ],
      },
    ],
  },
  {
    estado: "Miranda",
    municipios: [
      {
        nombre: "Baruta",
        parroquias: ["Baruta", "El Cafetal", "Las Minas de Baruta"],
      },
      { nombre: "Chacao", parroquias: ["Chacao"] },
      { nombre: "El Hatillo", parroquias: ["El Hatillo"] },
      {
        nombre: "Sucre",
        parroquias: ["Petare", "Caucagüita", "Filas de Mariche", "La Dolorita", "Leoncio Martínez"],
      },
      { nombre: "Plaza", parroquias: ["Guarenas", "Tácata"] },
      { nombre: "Zamora", parroquias: ["Guatire", "Araira"] },
    ],
  },
  {
    estado: "La Guaira",
    municipios: [
      {
        nombre: "Vargas",
        parroquias: [
          "Caraballeda",
          "Carayaca",
          "Caruao",
          "Catia La Mar",
          "La Guaira",
          "Macuto",
          "Maiquetía",
          "Naiguatá",
          "Urimare",
        ],
      },
    ],
  },
  {
    estado: "Zulia",
    municipios: [
      { nombre: "Maracaibo", parroquias: ["Bolívar", "Cacique Mara", "Cecilio Acosta", "Chiquinquirá", "Coquivacoa", "Cristo de Aranza", "Idelfonso Vásquez", "Juana de Avila", "Luis Hurtado Higuera", "Manuel Dagnino", "Olegario Villalobos", "Río Negro", "San Isidro", "Santa Lucía", "Venancio Pulgar"] },
    ],
  },
  {
    estado: "Carabobo",
    municipios: [{ nombre: "Valencia", parroquias: ["Candelaria", "Catedral", "El Socorro", "Miguel Peña", "Negro Primero", "Rafael Urdaneta", "San Blas", "San José", "Santa Rosa"] }],
  },
  {
    estado: "Aragua",
    municipios: [{ nombre: "Girardot", parroquias: ["Choroní", "Las Delicias", "Los Tacariguas", "Madre María de San José", "Pedro José Ovalles", "San Casimiro", "San Sebastián", "Santiago Mariño"] }],
  },
];

/** Todos los estados de Venezuela (para selector aunque no tengamos parroquias detalladas). */
export const ESTADOS_VENEZUELA = [
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Distrito Capital",
  "Falcón",
  "Guárico",
  "La Guaira",
  "Lara",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "Yaracuy",
  "Zulia",
] as const;

export function normalizarNacionalidad(raw: string | null | undefined): string {
  const v = (raw ?? "Venezolana").trim();
  const match = CATALOGO_NACIONALIDADES.find((n) => n.toLowerCase() === v.toLowerCase());
  return match ?? (v || "Venezolana");
}

export function normalizarPais(raw: string | null | undefined): string {
  const v = (raw ?? "Venezuela").trim();
  const match = CATALOGO_PAISES.find((p) => p.toLowerCase() === v.toLowerCase());
  return match ?? (v || "Venezuela");
}

export function etiquetaTipoAlojamiento(valor: string | null | undefined): string {
  if (!valor?.trim()) return "—";
  const lower = valor.trim().toLowerCase();
  const match = CATALOGO_TIPOS_ALOJAMIENTO.find(
    (t) => t.valor === lower || t.label.toLowerCase() === lower,
  );
  return match?.label ?? valor;
}

export function valorTipoAlojamiento(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const lower = raw.trim().toLowerCase();
  const match = CATALOGO_TIPOS_ALOJAMIENTO.find(
    (t) => t.valor === lower || t.label.toLowerCase() === lower,
  );
  return match?.valor ?? raw.trim();
}

export function estadosPorPais(pais: string): string[] {
  if (normalizarPais(pais) !== "Venezuela") return [];
  return [...ESTADOS_VENEZUELA];
}

export function municipiosPorEstado(pais: string, estado: string): string[] {
  if (normalizarPais(pais) !== "Venezuela") return [];
  const div = DIVISIONES_VENEZUELA.find((d) => d.estado === estado);
  if (div) return div.municipios.map((m) => m.nombre);
  return [];
}

export function parroquiasPorMunicipio(pais: string, estado: string, municipio: string): string[] {
  if (normalizarPais(pais) !== "Venezuela") return [];
  const div = DIVISIONES_VENEZUELA.find((d) => d.estado === estado);
  const mun = div?.municipios.find((m) => m.nombre === municipio);
  return mun?.parroquias ?? [];
}

/** Si el valor guardado no está en el catálogo, lo incluye para no perder datos legacy. */
export function opcionesConLegacy(opciones: string[], valorActual: string): string[] {
  const v = valorActual.trim();
  if (!v || opciones.includes(v)) return opciones;
  return [...opciones, v];
}

/** Antepone «NO SE» al catálogo (censo en campo cuando no conocen la ubicación). */
export function opcionesConNoSe(opciones: string[], valorActual: string): string[] {
  const base = opciones.filter((o) => o !== OPCION_GEO_NO_SE);
  return opcionesConLegacy([OPCION_GEO_NO_SE, ...base], valorActual);
}
