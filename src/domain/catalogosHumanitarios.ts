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
          "Carlos Soublette",
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

/** Quita acentos y unifica mayúsculas/espacios para comparar alias geográficos. */
export function claveGeo(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^parroquia\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buscarPorAlias(opciones: string[], raw: string, alias: Record<string, string>): string {
  const clave = claveGeo(raw);
  if (!clave) return "";
  const canonicoAlias = alias[clave];
  if (canonicoAlias && opciones.includes(canonicoAlias)) return canonicoAlias;
  const exacto = opciones.find((o) => claveGeo(o) === clave);
  if (exacto) return exacto;
  const parcial = opciones.find((o) => {
    const c = claveGeo(o);
    return c.includes(clave) || clave.includes(c);
  });
  return parcial ?? "";
}

const ALIAS_ESTADO: Record<string, string> = {
  caracas: "Distrito Capital",
  "distrito capital": "Distrito Capital",
  "dtto capital": "Distrito Capital",
  "dto capital": "Distrito Capital",
  "dpto capital": "Distrito Capital",
  miranda: "Miranda",
  "dtto miranda": "Miranda",
  "estado miranda": "Miranda",
  "la guaira": "La Guaira",
  vargas: "La Guaira",
  "estado vargas": "La Guaira",
};

const ALIAS_MUNICIPIO: Record<string, string> = {
  libertador: "Libertador",
  baruta: "Baruta",
  chacao: "Chacao",
  "el hatillo": "El Hatillo",
  hatillo: "El Hatillo",
  sucre: "Sucre",
  vargas: "Vargas",
  plaza: "Plaza",
  zamora: "Zamora",
};

/** Alias de parroquia → nombre canónico del catálogo. */
const ALIAS_PARROQUIA: Record<string, string> = {
  // Distrito Capital
  altagracia: "Altagracia",
  altagracias: "Altagracia",
  "la candelaria": "Candelaria",
  candelaria: "Candelaria",
  caricuao: "Caricuao",
  coche: "Coche",
  "el junquito": "El Junquito",
  "el junkito": "El Junquito",
  junquito: "El Junquito",
  "el paraiso": "El Paraíso",
  "el recreo": "El Recreo",
  "el valle": "El Valle",
  "la pastora": "La Pastora",
  "la vega": "La Vega",
  macarao: "Macarao",
  "san bernardino": "San Bernardino",
  "san jose": "San José",
  "san juan": "San Juan",
  "san pedro": "San Pedro",
  "sanj pedro": "San Pedro",
  "santa rosalia": "Santa Rosalía",
  "santa teresa": "Santa Teresa",
  "sta teresa": "Santa Teresa",
  sucre: "Sucre",
  "23 de enero": "23 de Enero",
  // Miranda · Baruta
  baruta: "Baruta",
  "nuestra senora del rosario": "Baruta",
  "nuestra senora der rosario": "Baruta",
  "nuestra senora del rosario de baruta": "Baruta",
  "baruta nuestra senora del rosario": "Baruta",
  "el cafetal": "El Cafetal",
  cafetal: "El Cafetal",
  "las minas": "Las Minas de Baruta",
  "las minas de baruta": "Las Minas de Baruta",
  "minas de baruta": "Las Minas de Baruta",
  // Miranda · otros
  chacao: "Chacao",
  "el hatillo": "El Hatillo",
  hatillo: "El Hatillo",
  petare: "Petare",
  caucaguita: "Caucagüita",
  "filas de mariche": "Filas de Mariche",
  mariche: "Filas de Mariche",
  "la dolorita": "La Dolorita",
  "leoncio martinez": "Leoncio Martínez",
  // La Guaira
  caraballeda: "Caraballeda",
  "carlos soublette": "Carlos Soublette",
  "carlos sublette": "Carlos Soublette",
  "catia la mar": "Catia La Mar",
  "la guaira": "La Guaira",
  macuto: "Macuto",
  maiquetia: "Maiquetía",
  naiguata: "Naiguatá",
  urimare: "Urimare",
};

/** Parroquia → municipio canónico cuando el municipio cargado es incorrecto. */
const PARROQUIA_A_MUNICIPIO: Record<string, { estado: string; municipio: string }> = {
  Baruta: { estado: "Miranda", municipio: "Baruta" },
  "El Cafetal": { estado: "Miranda", municipio: "Baruta" },
  "Las Minas de Baruta": { estado: "Miranda", municipio: "Baruta" },
  Chacao: { estado: "Miranda", municipio: "Chacao" },
  "El Hatillo": { estado: "Miranda", municipio: "El Hatillo" },
  Petare: { estado: "Miranda", municipio: "Sucre" },
  Caucagüita: { estado: "Miranda", municipio: "Sucre" },
  "Filas de Mariche": { estado: "Miranda", municipio: "Sucre" },
  "La Dolorita": { estado: "Miranda", municipio: "Sucre" },
  "Leoncio Martínez": { estado: "Miranda", municipio: "Sucre" },
  Caraballeda: { estado: "La Guaira", municipio: "Vargas" },
  "Carlos Soublette": { estado: "La Guaira", municipio: "Vargas" },
  "Catia La Mar": { estado: "La Guaira", municipio: "Vargas" },
  "La Guaira": { estado: "La Guaira", municipio: "Vargas" },
  Macuto: { estado: "La Guaira", municipio: "Vargas" },
  Maiquetía: { estado: "La Guaira", municipio: "Vargas" },
  Naiguatá: { estado: "La Guaira", municipio: "Vargas" },
  Urimare: { estado: "La Guaira", municipio: "Vargas" },
};

export interface UbicacionAdministrativa {
  estado_federativo: string;
  municipio: string;
  parroquia: string;
}

/**
 * Estandariza estado / municipio / parroquia al catálogo de DIVISIONES_VENEZUELA.
 * Corrige mayúsculas, typos frecuentes y parroquias mal asignadas de municipio.
 */
export function normalizarUbicacionCentro(
  raw: Partial<UbicacionAdministrativa> | null | undefined,
): UbicacionAdministrativa {
  const estadoRaw = (raw?.estado_federativo ?? "").trim();
  const municipioRaw = (raw?.municipio ?? "").trim();
  const parroquiaRaw = (raw?.parroquia ?? "").trim().replace(/^Parroquia\s+/i, "");

  let estado =
    buscarPorAlias([...ESTADOS_VENEZUELA], estadoRaw, ALIAS_ESTADO) ||
    ALIAS_ESTADO[claveGeo(estadoRaw)] ||
    "";

  // Resolver parroquia primero (suele ser la señal más fiable).
  let parroquia =
    buscarPorAlias(
      DIVISIONES_VENEZUELA.flatMap((d) => d.municipios.flatMap((m) => m.parroquias)),
      parroquiaRaw,
      ALIAS_PARROQUIA,
    ) || ALIAS_PARROQUIA[claveGeo(parroquiaRaw)] || "";

  // Si la parroquia pertenece a un municipio concreto, forzar estado/municipio.
  const dueño = parroquia ? PARROQUIA_A_MUNICIPIO[parroquia] : undefined;
  if (dueño) {
    // Excepción: "Sucre" y "La Guaira" existen en más de un estado.
    const ambigua =
      parroquia === "Sucre" ||
      parroquia === "La Guaira" ||
      parroquia === "Candelaria" ||
      parroquia === "San José";
    if (!ambigua) {
      estado = dueño.estado;
      return { estado_federativo: estado, municipio: dueño.municipio, parroquia };
    }
  }

  if (!estado) {
    return { estado_federativo: "", municipio: "", parroquia: parroquia || "" };
  }

  const municipios = municipiosPorEstado("Venezuela", estado);
  let municipio =
    buscarPorAlias(municipios, municipioRaw, ALIAS_MUNICIPIO) ||
    ALIAS_MUNICIPIO[claveGeo(municipioRaw)] ||
    "";

  // La Guaira solo tiene municipio Vargas.
  if (estado === "La Guaira") municipio = "Vargas";

  // Distrito Capital solo tiene Libertador.
  if (estado === "Distrito Capital") municipio = "Libertador";

  // Parroquia ambigua "Sucre": si municipio es Sucre de Miranda, es Petare-area;
  // si estado es DC o municipio Libertador, es parroquia Sucre de Caracas.
  if (parroquia === "Sucre" && (municipio === "Sucre" || claveGeo(municipioRaw) === "sucre") && estado === "Distrito Capital") {
    municipio = "Libertador";
  }
  if (
    parroquia === "Sucre" &&
    estado === "Miranda" &&
    (municipio === "Sucre" || claveGeo(municipioRaw) === "sucre")
  ) {
    // En Miranda no hay parroquia Sucre; "Sucre" como municipio_parroquia del JSON suele ser Petare.
    parroquia = "";
    municipio = "Sucre";
  }

  if (municipio && !parroquia) {
    const lista = parroquiasPorMunicipio("Venezuela", estado, municipio);
    parroquia = buscarPorAlias(lista, parroquiaRaw, ALIAS_PARROQUIA);
  } else if (municipio && parroquia) {
    const lista = parroquiasPorMunicipio("Venezuela", estado, municipio);
    if (!lista.includes(parroquia)) {
      const reubicada = buscarPorAlias(lista, parroquiaRaw, ALIAS_PARROQUIA);
      parroquia = reubicada;
    }
  }

  return {
    estado_federativo: estado,
    municipio,
    parroquia,
  };
}

