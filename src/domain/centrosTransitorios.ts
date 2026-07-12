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
import {
  responsablesCoordinacionDeCentro,
  type ResponsableCoordinacion,
} from "./coordinacionCentro";
import { normalizarUbicacionCentro } from "./catalogosHumanitarios";
import {
  metaUnidadSebinDe,
  normalizarUnidadSebin,
  type ClaveUnidadSebin,
  type MetaUnidadSebin,
} from "./unidadesSebin";

export type { ClaveUnidadSebin, MetaUnidadSebin };
export {
  CATALOGO_UNIDADES_SEBIN,
  LOGO_SEBIN,
  metaUnidadSebinDe,
  normalizarUnidadSebin,
} from "./unidadesSebin";

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
  | "psuv"
  | "min_educacion"
  | "alcaldia_ccs"
  | "milicia"
  | "gbp"
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
  { clave: "psuv", label: "PSUV", icono: "🌹", color: "#dc2626", logo: "/logos-cuerpos/psuv.webp" },
  {
    clave: "min_educacion",
    label: "Min Educación",
    icono: "📚",
    color: "#2563eb",
    logo: "/logos-cuerpos/min_educacion.webp",
  },
  {
    clave: "alcaldia_ccs",
    label: "Alcaldía de Caracas",
    icono: "🏛️",
    color: "#ca8a04",
    logo: "/logos-cuerpos/alcaldia_ccs.webp",
  },
  {
    clave: "milicia",
    label: "Milicia",
    icono: "⚔️",
    color: "#15803d",
    logo: "/logos-cuerpos/milicia.webp",
  },
  {
    clave: "gbp",
    label: "Guardia del Pueblo",
    icono: "🛡️",
    color: "#b91c1c",
    logo: "/logos-cuerpos/gbp.webp",
  },
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
    psuv: "psuv",
    mineducacion: "min_educacion",
    ministeriodeducacion: "min_educacion",
    btssantateresa: "min_educacion",
    bts: "min_educacion",
    alcaldiadecaracas: "alcaldia_ccs",
    alcaldiadeccs: "alcaldia_ccs",
    alcaldiaccs: "alcaldia_ccs",
    milicia: "milicia",
    miliciabolivariana: "milicia",
    gbp: "gbp",
    guardiadelpueblo: "gbp",
    guardiabolivarianadelpueblo: "gbp",
    sinasignar: "sin_asignar",
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
 * Fase de instalación según el registro oficial (Vicepresidencia / MIJ).
 * Distinto de `EstadoCentro` (saturado/cerrado = gestión operativa).
 */
export type EstatusInstalacionOficial = "instalado" | "proceso_de_instalacion";

export const ESTATUS_INSTALACION_OFICIAL: {
  valor: EstatusInstalacionOficial;
  label: string;
}[] = [
  { valor: "instalado", label: "Instalado" },
  { valor: "proceso_de_instalacion", label: "En proceso de instalación" },
];

/**
 * Variables del censo oficial de campamentos transitorios.
 * Fuente: registro Vicepresidencia Sectorial / MIJ (`campamentos_transitorios.json`).
 * `capacidad_instalada` es el aforo habilitado editable; el cupo oficial se deriva
 * como instalada − damnificados (puede ser negativo = sobrecupo).
 */
export interface CensoOficialCentro {
  id_oficial: number | null;
  /** Fecha de corte del registro oficial (ISO). */
  fecha_corte: string | null;
  ministerio_ente: string;
  estatus_instalacion: EstatusInstalacionOficial | null;
  capacidad_maxima: number | null;
  capacidad_instalada: number | null;
}

export const CENSO_OFICIAL_VACIO: CensoOficialCentro = {
  id_oficial: null,
  fecha_corte: null,
  ministerio_ente: "",
  estatus_instalacion: null,
  capacidad_maxima: null,
  capacidad_instalada: null,
};

/** Normaliza el bloque de censo oficial tolerando filas viejas o incompletas. */
export function normalizarCensoOficial(
  c: Partial<CensoOficialCentro> | null | undefined,
): CensoOficialCentro {
  const raw = c ?? {};
  const estatus = raw.estatus_instalacion;
  const estatusOk =
    estatus === "instalado" || estatus === "proceso_de_instalacion" ? estatus : null;
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    id_oficial: numOrNull(raw.id_oficial),
    fecha_corte: typeof raw.fecha_corte === "string" ? raw.fecha_corte : null,
    ministerio_ente: typeof raw.ministerio_ente === "string" ? raw.ministerio_ente : "",
    estatus_instalacion: estatusOk,
    capacidad_maxima: numOrNull(raw.capacidad_maxima),
    capacidad_instalada: numOrNull(raw.capacidad_instalada),
  };
}

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

/** Supervisión SEBIN: dirección interna y supervisor asignado al campamento. */
export interface SupervisionCentro {
  /** Dirección/unidad interna del SEBIN (ej. "DIR. REG - SEBIN"). */
  unidad_sebin: string;
  /** Comisario o supervisor de la unidad (opcional). */
  supervisor_sebin: string;
  /**
   * Analistas SAE asignados al campamento (`perfiles.user_id` con rol
   * `analista_sae`). Uno o varios; alimenta el filtro del tablero.
   */
  analistas_sae: string[];
}

export const SUPERVISION_VACIA: SupervisionCentro = {
  unidad_sebin: "",
  supervisor_sebin: "",
  analistas_sae: [],
};

export function normalizarSupervision(
  s: Partial<SupervisionCentro> | null | undefined,
): SupervisionCentro {
  const base = { ...SUPERVISION_VACIA, ...(s ?? {}) };
  return {
    ...base,
    analistas_sae: Array.isArray(s?.analistas_sae)
      ? [...new Set(s.analistas_sae.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [],
  };
}

/** Unidad SEBIN del campamento (clave canónica). */
export function unidadSebinDe(
  c: Pick<CentroTransitorio, "supervision">,
): ClaveUnidadSebin {
  return normalizarUnidadSebin(c.supervision?.unidad_sebin);
}

/** Metadata visual de la unidad SEBIN asignada. */
export function metaUnidadSebinCentro(c: Pick<CentroTransitorio, "supervision">): MetaUnidadSebin {
  return metaUnidadSebinDe(c.supervision?.unidad_sebin);
}

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

/** Etiqueta legible para una respuesta sí / no / en proceso. */
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
/** Id fijo del campamento sandbox (no cuenta en KPIs ni partes de la red). */
export const ID_CENTRO_PRUEBA = "centro-prueba";

export interface CentroTransitorio {
  id: string;
  nro: number;
  nombre: string;
  /**
   * Campamento de desarrollo/pruebas: visible en mapa y ficha, excluido de
   * agregados de red (KPIs, partes, PDF, Telegram).
   */
  es_prueba?: boolean;
  /**
   * Si varios edificios forman un solo campamento oficial (p. ej. Gran Colombia),
   * comparten el mismo `complejoId` y el mismo `nro`. En totales de red cuentan
   * como 1; en listados operativos siguen siendo filas separadas.
   */
  complejoId?: string | null;
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
  /** Supervisión SEBIN: dirección interna y supervisor. */
  supervision?: SupervisionCentro;
  /** Necesidades logísticas solicitadas para el centro. */
  requerimientos?: ItemRequerimiento[];
  // ---- Campos mutables (registro de estado, sincronizables) ----
  capacidad?: CapacidadCentro;
  /**
   * Censo oficial (capacidad máxima/instalada, ente, estatus de instalación).
   * El cupo de personas usa `capacidad_instalada`, no el mínimo Esfera de camas.
   */
  censo_oficial?: CensoOficialCentro;
  /** Ocupación actual por edad y sexo (mismo desglose que los sectores). */
  ocupacion?: Vulnerables;
  /** Personal operativo desplegado (funcionarios, salud, justicia). */
  personal?: PersonalCentro;
  familias_ocupadas?: number;
  /** Responsables del centro con teléfono para contacto (llamar/WhatsApp). */
  responsables?: Responsable[];
  /** Responsables de coordinación (política, seguridad física, supervisión, etc.). */
  responsables_coordinacion?: ResponsableCoordinacion[];
  /**
   * Ámbitos del directorio marcados explícitamente como «sin autoridades»
   * (p. ej. desde /terreno). Confirmación operativa por categoría.
   */
  ambitos_sin_autoridad?: string[];
  /**
   * Marcas de tiempo (epoch ms) de la última guardada desde /terreno por tarea.
   * Sirve para mostrar «última act.» en las cards del portal.
   */
  terreno_actualizado?: {
    capacidad?: number;
    autoridades?: number;
    geolocalizacion?: number;
  };
  /** URL pública de la foto del centro (Supabase Storage). */
  foto_url?: string;
  estado?: EstadoCentro;
  updated_at?: number;
  updated_by?: string;
}

/** Centro con todos los campos mutables garantizados (tras normalizar). */
export interface CentroNormalizado extends CentroTransitorio {
  capacidad: CapacidadCentro;
  censo_oficial: CensoOficialCentro;
  ocupacion: Vulnerables;
  personal: PersonalCentro;
  familias_ocupadas: number;
  responsables: Responsable[];
  responsables_coordinacion: ResponsableCoordinacion[];
  ambitos_sin_autoridad: string[];
  terreno_actualizado: {
    capacidad?: number;
    autoridades?: number;
    geolocalizacion?: number;
  };
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
  supervision: SupervisionCentro;
  requerimientos: ItemRequerimiento[];
}

/** ¿Es el campamento sandbox de pruebas? */
export function esCentroDePrueba(c: { id: string; es_prueba?: boolean }): boolean {
  return c.es_prueba === true || c.id === ID_CENTRO_PRUEBA;
}

export function idCentroEsPrueba(centroId: string): boolean {
  return centroId === ID_CENTRO_PRUEBA;
}

/** Centros que sí entran en totales y partes de la red. */
export function centrosDeProduccion(centros: CentroTransitorio[]): CentroTransitorio[] {
  return centros.filter((c) => !esCentroDePrueba(c));
}

/** Rellena defaults de los campos mutables para leer un centro con seguridad. */
export function normalizarCentro(c: CentroTransitorio): CentroNormalizado {
  const ubicacion = normalizarUbicacionCentro({
    estado_federativo: c.estado_federativo,
    municipio: c.municipio,
    parroquia: c.parroquia,
  });
  return {
    ...c,
    capacidad: normalizarCapacidad(c.capacidad),
    censo_oficial: normalizarCensoOficial(c.censo_oficial),
    ocupacion: normalizarVulnerables(c.ocupacion),
    personal: normalizarPersonal(c.personal),
    familias_ocupadas: c.familias_ocupadas ?? 0,
    responsables: Array.isArray(c.responsables) ? c.responsables : [],
    responsables_coordinacion: responsablesCoordinacionDeCentro(c),
    ambitos_sin_autoridad: Array.isArray(c.ambitos_sin_autoridad)
      ? c.ambitos_sin_autoridad.filter((v): v is string => typeof v === "string" && v.trim() !== "")
      : [],
    terreno_actualizado: (() => {
      const raw = c.terreno_actualizado;
      if (!raw || typeof raw !== "object") return {};
      const out: { capacidad?: number; autoridades?: number; geolocalizacion?: number } = {};
      for (const k of ["capacidad", "autoridades", "geolocalizacion"] as const) {
        const n = Number(raw[k]);
        if (Number.isFinite(n) && n > 0) out[k] = n;
      }
      return out;
    })(),
    foto_url: c.foto_url ?? "",
    estado: c.estado ?? "preparacion",
    notas: c.notas ?? "",
    fecha_levantamiento: c.fecha_levantamiento ?? "",
    estado_federativo: ubicacion.estado_federativo,
    municipio: ubicacion.municipio,
    parroquia: ubicacion.parroquia,
    coord_politico: normalizarContacto(c.coord_politico),
    coord_ministerial: normalizarContacto(c.coord_ministerial),
    seguridad: normalizarSeguridad(c.seguridad),
    servicios: normalizarServicios(c.servicios),
    total_afectados: c.total_afectados ?? 0,
    censo_en_proceso: c.censo_en_proceso ?? false,
    novedades: c.novedades ?? "",
    supervision: normalizarSupervision(c.supervision),
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
  const ubi = normalizarUbicacionCentro(c);
  return [ubi.estado_federativo, ubi.municipio, ubi.parroquia]
    .map((s) => s.trim())
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

/** Presencia de damnificados en el campamento (derivado de la población reportada). */
export type MarcadorOcupacionCentro = "activo" | "sin_refugiados";

export const META_MARCADOR_OCUPACION: Record<
  MarcadorOcupacionCentro,
  { label: string; color: string }
> = {
  activo: { label: "Activo", color: "#22c55e" },
  sin_refugiados: { label: "Sin damnificados", color: "#64748b" },
};

export const ORDEN_MARCADOR_OCUPACION: MarcadorOcupacionCentro[] = [
  "activo",
  "sin_refugiados",
];

export function marcadorOcupacionCentro(c: CentroTransitorio): MarcadorOcupacionCentro {
  return poblacionCentro(c) > 0 ? "activo" : "sin_refugiados";
}

/**
 * Personal operativo desplegado en el centro (no damnificados). Se suma a la
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

/** Tope por categoría: por encima se considera dato corrupto (p. ej. teléfono pegado). */
export const MAX_PERSONAL_CATEGORIA = 2_000;

function enteroPersonalNoNegativo(valor: unknown): number {
  const n = Math.max(0, Math.floor(Number(valor) || 0));
  if (n > MAX_PERSONAL_CATEGORIA) return 0;
  return n;
}

export function normalizarPersonal(
  p: Partial<PersonalCentro> | null | undefined,
): PersonalCentro {
  const base = { ...PERSONAL_VACIO, ...(p ?? {}) };
  return {
    funcionarios: enteroPersonalNoNegativo(base.funcionarios),
    trabajadores: enteroPersonalNoNegativo(base.trabajadores),
    medicos: enteroPersonalNoNegativo(base.medicos),
    psicologos: enteroPersonalNoNegativo(base.psicologos),
    justicia_tjs: enteroPersonalNoNegativo(base.justicia_tjs),
    justicia_mp: enteroPersonalNoNegativo(base.justicia_mp),
    justicia_defensoria: enteroPersonalNoNegativo(base.justicia_defensoria),
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
 * Headcount para logística (agua, comida, baños): damnificados + personal
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
