// Dominio de los Centros Transitorios de Caracas (Fase 4): red de 50 refugios
// distribuidos por el área metropolitana y Gran Caracas, cada uno resguardado
// por un cuerpo de seguridad. Además de la información de referencia (nombre,
// ubicación, cuerpo asignado), cada centro registra su estado real: capacidad
// instalada/operativa (camas, duchas, pocetas, agua, basura), ocupación
// demográfica (por edad y sexo, como los sectores del Parque "Alí Primera"),
// responsables y foto. Es una entidad sincronizable (`centros`), igual que
// `sectores`/`censos`/`limpiezas` (ver `tipos.ts` y `data/db.ts`).

import {
  normalizarVulnerables,
  totalPoblacion,
  type Responsable,
  type Vulnerables,
} from "./tipos";

/** Clave canónica del cuerpo de seguridad/militar responsable de un centro. */
export type ClaveCuerpo =
  | "gnb"
  | "sebin"
  | "dgcim"
  | "cicpc"
  | "pnb"
  | "poli_baruta"
  | "poli_caracas"
  | "poli_chacao"
  | "poli_hatillo"
  | "poli_sucre"
  | "poli_miranda"
  | "sin_asignar";

export interface MetaCuerpo {
  clave: ClaveCuerpo;
  label: string;
  icono: string;
  color: string;
  /** Logo/escudo oficial (WebP 96×96 en `public/logos-cuerpos/`). `null` si no hay uno. */
  logo: string | null;
}

/**
 * Catálogo de cuerpos con color propio (para el anillo del marcador) y logo/
 * escudo oficial para identificarlos en el mapa. GNB/SEBIN/DGCIM/CICPC vienen
 * de Wikimedia Commons; los escudos de las policías (PNB y las municipales)
 * fueron provistos directamente por el equipo de campo.
 */
export const CATALOGO_CUERPOS: MetaCuerpo[] = [
  { clave: "gnb", label: "GNB", icono: "🪖", color: "#4d7c0f", logo: "/logos-cuerpos/gnb.webp" },
  { clave: "sebin", label: "SEBIN", icono: "🛡️", color: "#1e3a8a", logo: "/logos-cuerpos/sebin.webp" },
  { clave: "dgcim", label: "DGCIM", icono: "🎖️", color: "#334155", logo: "/logos-cuerpos/dgcim.webp" },
  { clave: "cicpc", label: "CICPC", icono: "🔍", color: "#7c3aed", logo: "/logos-cuerpos/cicpc.webp" },
  { clave: "pnb", label: "PNB", icono: "👮", color: "#1d4ed8", logo: "/logos-cuerpos/pnb.webp" },
  { clave: "poli_baruta", label: "Poli Baruta", icono: "🚓", color: "#0ea5e9", logo: "/logos-cuerpos/poli_baruta.webp" },
  { clave: "poli_caracas", label: "PoliCaracas", icono: "🚔", color: "#059669", logo: "/logos-cuerpos/poli_caracas.webp" },
  { clave: "poli_chacao", label: "PoliChacao", icono: "🚨", color: "#d97706", logo: "/logos-cuerpos/poli_chacao.webp" },
  { clave: "poli_hatillo", label: "Poli El Hatillo", icono: "🛵", color: "#db2777", logo: "/logos-cuerpos/poli_hatillo.webp" },
  { clave: "poli_sucre", label: "Poli Sucre", icono: "🚦", color: "#ea580c", logo: "/logos-cuerpos/poli_sucre.webp" },
  { clave: "poli_miranda", label: "Poli Miranda", icono: "🏍️", color: "#65a30d", logo: "/logos-cuerpos/poli_miranda.webp" },
  { clave: "sin_asignar", label: "Sin asignar", icono: "❔", color: "#64748b", logo: null },
];

export const META_CUERPO: Record<ClaveCuerpo, MetaCuerpo> = Object.fromEntries(
  CATALOGO_CUERPOS.map((c) => [c.clave, c]),
) as Record<ClaveCuerpo, MetaCuerpo>;

/**
 * Normaliza el texto crudo del cuerpo de seguridad (con variantes de
 * espacios/mayúsculas) a una clave canónica. Es defensiva: acepta
 * `undefined`/`null`/`""` (centros cargados sin ese campo, p. ej. desde el
 * Excel 03JUL26) y devuelve `"sin_asignar"` en esos casos.
 */
export function normalizarCuerpo(raw: string | undefined | null): ClaveCuerpo {
  if (!raw) return "sin_asignar";
  const limpio = raw.trim().toLowerCase().replace(/\s+/g, "");
  const mapa: Record<string, ClaveCuerpo> = {
    guardianacionalbolivariana: "gnb",
    gnb: "gnb",
    sebin: "sebin",
    dgcim: "dgcim",
    cicpc: "cicpc",
    pnb: "pnb",
    polibaruta: "poli_baruta",
    policaracas: "poli_caracas",
    polichacao: "poli_chacao",
    polihatillo: "poli_hatillo",
    polielhatillo: "poli_hatillo",
    polisucre: "poli_sucre",
    polimiranda: "poli_miranda",
  };
  return mapa[limpio] ?? "sin_asignar";
}

/** Devuelve la metadata (color/ícono/label) del cuerpo a partir del texto crudo del dato. */
export function metaCuerpoDe(raw: string | undefined | null): MetaCuerpo {
  return META_CUERPO[normalizarCuerpo(raw)];
}

/** Estado operativo del centro (semáforo de gestión). */
export type EstadoCentro = "preparacion" | "operativo" | "saturado" | "cerrado";

export const ESTADOS_CENTRO: { valor: EstadoCentro; label: string; color: string }[] = [
  { valor: "preparacion", label: "En preparación", color: "#64748b" },
  { valor: "operativo", label: "Operativo", color: "#22c55e" },
  { valor: "saturado", label: "Saturado", color: "#f59e0b" },
  { valor: "cerrado", label: "Cerrado", color: "#ef4444" },
];

/**
 * Capacidad instalada vs. operativa de cada recurso del centro. La distinción
 * es clave para detectar cuellos de botella: puede haber 100 camas instaladas
 * pero solo 2 pocetas operativas → el centro no debería recibir más gente.
 * "Pocetas" = inodoros/WC. `agua_litros` = capacidad del tanque en litros.
 */
export interface CapacidadCentro {
  camas_instaladas: number;
  camas_operativas: number;
  duchas_instaladas: number;
  duchas_operativas: number;
  pocetas_instaladas: number;
  pocetas_operativas: number;
  /** Lavaderos / puntos de lavado de ropa (Esfera: 1 por cada 100 personas). */
  lavaderos_instalados: number;
  lavaderos_operativos: number;
  contenedores_instalados: number;
  contenedores_operativos: number;
  /** ¿Hay tanque de suministro de agua potable? */
  agua_tanque: boolean;
  /** ¿El suministro de agua está operativo ahora mismo? */
  agua_operativa: boolean;
  /** Capacidad del tanque en litros (0 si no aplica/desconocido). */
  agua_litros: number;
}

export const CAPACIDAD_VACIA: CapacidadCentro = {
  camas_instaladas: 0,
  camas_operativas: 0,
  duchas_instaladas: 0,
  duchas_operativas: 0,
  pocetas_instaladas: 0,
  pocetas_operativas: 0,
  lavaderos_instalados: 0,
  lavaderos_operativos: 0,
  contenedores_instalados: 0,
  contenedores_operativos: 0,
  agua_tanque: false,
  agua_operativa: false,
  agua_litros: 0,
};

/** Normaliza una capacidad tolerando filas viejas o incompletas. */
export function normalizarCapacidad(
  c: Partial<CapacidadCentro> | null | undefined,
): CapacidadCentro {
  return { ...CAPACIDAD_VACIA, ...(c ?? {}) };
}

/** Respuesta de campo: sí, no o pendiente ("EN PROCESO" en el reporte). */
export type RespuestaLevantamiento = boolean | null;

/** Persona de contacto del reporte (coordinador político/ministerial). */
export interface ContactoReporte {
  nombre: string;
  cedula: string;
  telefono: string;
  /** Ministerio, ente u organización responsable. */
  ente: string;
}

export const CONTACTO_VACIO: ContactoReporte = {
  nombre: "",
  cedula: "",
  telefono: "",
  ente: "",
};

/** Jefe de seguridad y despliegue (sección III del reporte). */
export interface SeguridadCentro {
  nombre: string;
  cedula: string;
  telefono: string;
  organismo: string;
  personal_mando: number;
  vehiculos: number;
}

export const SEGURIDAD_VACIA: SeguridadCentro = {
  nombre: "",
  cedula: "",
  telefono: "",
  organismo: "",
  personal_mando: 0,
  vehiculos: 0,
};

/** Servicios de salud y apoyo jurídico (sección IV). */
export interface ServiciosCentro {
  medicos: RespuestaLevantamiento;
  ambulancias: RespuestaLevantamiento;
  psicologo: RespuestaLevantamiento;
  contacto_juez_paz: RespuestaLevantamiento;
}

/** Ítem de necesidad logística solicitada para el centro. */
export interface ItemRequerimiento {
  id: string;
  /** Qué se necesita (camas, colchones, cocina…). */
  concepto: string;
  /** Cantidad solicitada. */
  cantidad: number;
  /** Detalle opcional (urgencia, ubicación, observación). */
  notas?: string;
}

/** Sugerencias rápidas al registrar requerimientos en campo. */
export const CONCEPTOS_REQUERIMIENTO_COMUNES = [
  "Camas",
  "Colchones",
  "Baños / pocetas",
  "Duchas",
  "Contenedores de basura",
  "Filtros de agua",
  "Tanques de agua",
  "Reparación de filtraciones",
  "Cocina / caldero comunitario",
  "Lencería (sábanas, cobijas)",
  "Kit de aseo personal",
  "Generador eléctrico",
  "Iluminación",
  "Material de limpieza",
  "Ventiladores",
] as const;

export const SERVICIOS_VACIOS: ServiciosCentro = {
  medicos: null,
  ambulancias: null,
  psicologo: null,
  contacto_juez_paz: null,
};

export function normalizarContacto(
  c: Partial<ContactoReporte> | null | undefined,
): ContactoReporte {
  return { ...CONTACTO_VACIO, ...(c ?? {}) };
}

export function normalizarSeguridad(
  s: Partial<SeguridadCentro> | null | undefined,
): SeguridadCentro {
  return { ...SEGURIDAD_VACIA, ...(s ?? {}) };
}

export function normalizarServicios(
  s: Partial<ServiciosCentro> | null | undefined,
): ServiciosCentro {
  return { ...SERVICIOS_VACIOS, ...(s ?? {}) };
}

export function normalizarRequerimientos(
  items: ItemRequerimiento[] | null | undefined,
): ItemRequerimiento[] {
  if (!Array.isArray(items)) return [];
  return items.map((i) => ({
    id: i.id,
    concepto: (i.concepto ?? "").trim(),
    cantidad: Math.max(0, Number(i.cantidad) || 0),
    notas: (i.notas ?? "").trim(),
  }));
}

/** Totales del listado de requerimientos (solo ítems con concepto y cantidad > 0). */
export interface TotalesRequerimientos {
  /** Cuántos tipos de ítem distintos se solicitan. */
  lineas: number;
  /** Suma de todas las cantidades. */
  unidades: number;
}

export function totalesRequerimientos(items: ItemRequerimiento[]): TotalesRequerimientos {
  const validos = items.filter((i) => i.concepto.trim() && i.cantidad > 0);
  return {
    lineas: validos.length,
    unidades: validos.reduce((sum, i) => sum + i.cantidad, 0),
  };
}

/** Etiqueta legible para una respuesta sí/no/pendiente. */
export function etiquetaRespuesta(valor: RespuestaLevantamiento): string {
  if (valor === true) return "Sí";
  if (valor === false) return "No";
  return "En proceso";
}

/**
 * Un centro transitorio (refugio) de la red de 50 distribuidos por Caracas.
 * Los campos base (ubicación + cuerpo asignado) vienen del catálogo de
 * referencia; los campos mutables (capacidad, ocupación, responsables, foto,
 * estado) se registran en campo y se sincronizan. Son opcionales para tolerar
 * filas del catálogo estático o de versiones anteriores; usar
 * `normalizarCentro()` al leer para tener valores garantizados.
 * `geom` puede ser `null` si aún no se tiene la coordenada exacta.
 */
export interface CentroTransitorio {
  id: string;
  nro: number;
  nombre: string;
  /** "Área Metropolitana" | "Gran Caracas" (agrupación logística del listado). */
  grupo: string;
  /** Texto crudo del cuerpo responsable (tal cual viene de la fuente). */
  cuerpo: string;
  parroquia: string;
  /** Dirección en texto libre, lista para copiar/pegar en Google Maps. */
  direccion: string;
  mapsUrl: string;
  /** Punto GeoJSON [lng, lat]. `null` si aún no se ubicó en el mapa. */
  geom: GeoJSON.Point | null;
  notas: string;
  // ---- Levantamiento inicial (reporte de campo, secciones I–VI) ----
  /** Fecha del último levantamiento (YYYY-MM-DD). */
  fecha_levantamiento?: string;
  /** Estado federativo (Miranda, Distrito Capital, La Guaira…). */
  estado_federativo?: string;
  municipio?: string;
  coord_politico?: ContactoReporte;
  coord_ministerial?: ContactoReporte;
  seguridad?: SeguridadCentro;
  servicios?: ServiciosCentro;
  /** Total de afectados cuando el censo demográfico aún no está completo. */
  total_afectados?: number;
  /** El desglose por edad/sexo está en proceso de levantamiento. */
  censo_en_proceso?: boolean;
  /** Novedades relevantes del reporte (sección VI). */
  novedades?: string;
  /** Necesidades logísticas solicitadas para el centro. */
  requerimientos?: ItemRequerimiento[];
  // ---- Campos mutables (registro de estado, sincronizables) ----
  capacidad?: CapacidadCentro;
  /** Ocupación actual por edad y sexo (mismo desglose que los sectores). */
  ocupacion?: Vulnerables;
  /** Personal operativo desplegado (funcionarios, salud, justicia). */
  personal?: PersonalCentro;
  familias_ocupadas?: number;
  /** Responsables del centro con teléfono para contacto (llamar/WhatsApp). */
  responsables?: Responsable[];
  /** URL pública de la foto del centro (Supabase Storage). */
  foto_url?: string;
  estado?: EstadoCentro;
  updated_at?: number;
  updated_by?: string;
}

/** Centro con todos los campos mutables garantizados (tras normalizar). */
export interface CentroNormalizado extends CentroTransitorio {
  capacidad: CapacidadCentro;
  ocupacion: Vulnerables;
  personal: PersonalCentro;
  familias_ocupadas: number;
  responsables: Responsable[];
  foto_url: string;
  estado: EstadoCentro;
  fecha_levantamiento: string;
  estado_federativo: string;
  municipio: string;
  coord_politico: ContactoReporte;
  coord_ministerial: ContactoReporte;
  seguridad: SeguridadCentro;
  servicios: ServiciosCentro;
  total_afectados: number;
  censo_en_proceso: boolean;
  novedades: string;
  requerimientos: ItemRequerimiento[];
}

/** Rellena defaults de los campos mutables para leer un centro con seguridad. */
export function normalizarCentro(c: CentroTransitorio): CentroNormalizado {
  return {
    ...c,
    capacidad: normalizarCapacidad(c.capacidad),
    ocupacion: normalizarVulnerables(c.ocupacion),
    personal: normalizarPersonal(c.personal),
    familias_ocupadas: c.familias_ocupadas ?? 0,
    responsables: Array.isArray(c.responsables) ? c.responsables : [],
    foto_url: c.foto_url ?? "",
    estado: c.estado ?? "preparacion",
    notas: c.notas ?? "",
    fecha_levantamiento: c.fecha_levantamiento ?? "",
    estado_federativo: c.estado_federativo ?? "",
    municipio: c.municipio ?? "",
    coord_politico: normalizarContacto(c.coord_politico),
    coord_ministerial: normalizarContacto(c.coord_ministerial),
    seguridad: normalizarSeguridad(c.seguridad),
    servicios: normalizarServicios(c.servicios),
    total_afectados: c.total_afectados ?? 0,
    censo_en_proceso: c.censo_en_proceso ?? false,
    novedades: c.novedades ?? "",
    requerimientos: normalizarRequerimientos(c.requerimientos),
  };
}

/**
 * Ubicación administrativa del centro como cadena compuesta:
 * `estado_federativo · municipio · parroquia` (sin el prefijo "Parroquia ").
 * Devuelve "" si ninguno de los tres campos tiene valor. Es la misma cadena
 * que muestra el panel `DetalleCentro` debajo del logo del cuerpo; se usa
 * también en el popup `InfoCentro` para que ambas vistas coincidan.
 */
export function ubicacionCentro(
  c: Pick<CentroTransitorio, "estado_federativo" | "municipio" | "parroquia">,
): string {
  const parroquia = (c.parroquia ?? "").replace(/^Parroquia\s/i, "").trim();
  return [c.estado_federativo, c.municipio, parroquia]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Población reportada del centro: usa el desglose demográfico si ya tiene datos;
 * si no, el total de afectados del levantamiento preliminar.
 */
export function poblacionCentro(c: CentroTransitorio): number {
  const norm = normalizarCentro(c);
  const desdeDesglose = totalPoblacion(norm.ocupacion);
  if (desdeDesglose > 0) return desdeDesglose;
  return norm.total_afectados;
}

/**
 * Personal operativo desplegado en el centro (no refugiados). Se suma a la
 * población afectada para calcular demanda de agua, comida, baños y duchas.
 */
export interface PersonalCentro {
  /** Funcionarios administrativos / apoyo logístico del centro. */
  funcionarios: number;
  /** Obreros/trabajadores de reparación que requieren comida. */
  trabajadores: number;
  medicos: number;
  psicologos: number;
  /** Tribunal Supremo de Justicia / jueces de paz. */
  justicia_tjs: number;
  /** Ministerio Público. */
  justicia_mp: number;
  /** Defensoría del Pueblo. */
  justicia_defensoria: number;
}

export const PERSONAL_VACIO: PersonalCentro = {
  funcionarios: 0,
  trabajadores: 0,
  medicos: 0,
  psicologos: 0,
  justicia_tjs: 0,
  justicia_mp: 0,
  justicia_defensoria: 0,
};

export function normalizarPersonal(
  p: Partial<PersonalCentro> | null | undefined,
): PersonalCentro {
  const base = { ...PERSONAL_VACIO, ...(p ?? {}) };
  return {
    funcionarios: Math.max(0, Number(base.funcionarios) || 0),
    trabajadores: Math.max(0, Number(base.trabajadores) || 0),
    medicos: Math.max(0, Number(base.medicos) || 0),
    psicologos: Math.max(0, Number(base.psicologos) || 0),
    justicia_tjs: Math.max(0, Number(base.justicia_tjs) || 0),
    justicia_mp: Math.max(0, Number(base.justicia_mp) || 0),
    justicia_defensoria: Math.max(0, Number(base.justicia_defensoria) || 0),
  };
}

/** Total de personal operativo (todas las categorías). */
export function totalPersonalOperativo(p: Partial<PersonalCentro> | null | undefined): number {
  const n = normalizarPersonal(p);
  return (
    n.funcionarios +
    n.trabajadores +
    n.medicos +
    n.psicologos +
    n.justicia_tjs +
    n.justicia_mp +
    n.justicia_defensoria
  );
}

/** Total de funcionarios de justicia (TJS + MP + Defensoría). */
export function totalJusticia(p: Partial<PersonalCentro> | null | undefined): number {
  const n = normalizarPersonal(p);
  return n.justicia_tjs + n.justicia_mp + n.justicia_defensoria;
}

/**
 * Headcount para logística (agua, comida, baños): refugiados + personal
 * operativo desplegado en el centro.
 */
export function personasLogistica(c: CentroTransitorio): number {
  const norm = normalizarCentro(c);
  return poblacionCentro(c) + totalPersonalOperativo(norm.personal);
}

/** Centro de Caracas usado para centrar el mapa general (aprox. Plaza Venezuela). */
export const CARACAS_CENTRO: [number, number] = [-66.9036, 10.4806];
/** Vista general de la red (~35k de ancho en pantallas típicas con sidebar). */
export const CARACAS_ZOOM = 12;
/** Tope al encuadrar la red: evita acercar más de lo necesario para ver todos los centros. */
export const CARACAS_ZOOM_MAX_ENCUDRE = 12;
