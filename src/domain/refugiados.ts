// Dominio del registro nominal de damnificados por campamento.
// Tablas: refugiados, familias_centro, alojamientos_refugiados, residencias_afectadas.

import { normalizarNacionalidad as normalizarNacionalidadCatalogo } from "./catalogosHumanitarios";

/** Tipo de documento de identidad (adultos): venezolano, extranjero o pasaporte. */
export type TipoDoc = "V" | "E" | "P";

/** Sexo registrado en la ficha nominal. */
export type SexoRefugiado = "M" | "F" | "O";

/** Estado del alojamiento de una persona en un campamento. */
export type EstadoAlojamiento = "activo" | "observacion" | "transito" | "egresado";

/** Estado del documento de identidad. */
export type EstadoDocumento = "vigente" | "perdida" | "danada" | "en_tramite";

/** Tipo de tenencia de la vivienda afectada. */
export type TipoTenencia = "" | "propia" | "alquilada" | "prestada" | "ocupacion" | "otro";

/** Teléfono de contacto con indicador WhatsApp. */
export interface TelefonoContacto {
  numero: string;
  whatsapp?: boolean;
  notas?: string;
}

/** Bloque de contacto de una persona. */
export interface ContactoRefugiado {
  telefono_principal?: string;
  whatsapp_principal?: boolean;
  telefonos_alternos?: TelefonoContacto[];
  email?: string;
  contacto_emergencia?: string;
  telefono_emergencia?: string;
  tiene_acceso_telefono?: boolean;
  puede_recibir_carga?: boolean;
  notas?: string;
}

/** Tallas para dotaciones. */
export interface TallasRefugiado {
  camisa?: string;
  pantalon?: string;
  zapatos?: string;
  ropa_interior?: string;
  calcetines?: string;
  notas?: string;
}

/** Documento adicional (pasaporte, partida, etc.). */
export interface OtroDocumento {
  tipo: string;
  estado: EstadoDocumento;
  notas?: string;
}

/** Familiar de referencia (no alojado actualmente en el refugio). */
export interface FamiliarReferencia {
  id: string;
  nombres: string;
  fecha_nacimiento?: string | null;
  parentesco: string;
  sexo?: SexoRefugiado | null;
  en_mismo_campamento?: boolean;
  ubicacion?: string;
  contacto?: string;
  salud_breve?: string;
  documento?: string;
  estado_doc?: EstadoDocumento;
}

/** Familiar separado, desaparecido o fallecido (trazabilidad reunificación / pérdidas). */
export interface FamiliarSeparado {
  id: string;
  nombre: string;
  parentesco: string;
  ultima_ubicacion?: string;
  contacto?: string;
  estado: "desaparecido" | "separado" | "contacto_perdido" | "fallecido";
  edad_aproximada?: number | null;
  fecha_fallecimiento?: string | null;
  notas?: string;
  /** Cédula opcional si el censista la conoce (verificable en Nexus). */
  cedula?: string | null;
  tipo_doc?: TipoDoc | null;
  cedula_norm?: string | null;
  /** true si nombre/edad se rellenaron desde una consulta Nexus exitosa. */
  verificado_nexus?: boolean;
}

/** Bloque de salud y bienestar. */
export interface SaludRefugiado {
  lesiones?: string;
  condiciones_cronicas?: string;
  medicamentos_perdidos?: string;
  medicamentos_urgente?: boolean;
  discapacidad_ayudas?: string;
  salud_mental?: string;
  embarazo_semanas?: number | null;
  lactancia?: boolean;
  puerperio?: boolean;
  notas?: string;
}

/** Habilidad con nivel de competencia. */
export interface HabilidadRefugiado {
  nombre: string;
  nivel: "basico" | "intermedio" | "avanzado";
}

/** Bloque de habilidades y medios de vida. */
export interface HabilidadesRefugiado {
  ocupacion_previa?: string;
  habilidades?: HabilidadRefugiado[];
  disponible_campamento?: boolean;
  herramientas_perdidas?: string;
  notas?: string;
}

/** Documento perdido o dañado. */
export interface DocumentoPerdido {
  tipo: string;
  estado: EstadoDocumento;
  notas?: string;
}

/** Documentos personales censados uno a uno (operativos de emisión). */
export type TipoDocumentoPersonal = "cedula" | "partida_nacimiento" | "pasaporte" | "licencia";

/** Estado de un documento del catálogo fijo ("no_posee" = nunca lo tuvo). */
export type EstadoDocumentoPersonal = EstadoDocumento | "no_posee";

/** Bloque de documentación legal. */
export interface DocumentacionRefugiado {
  estado_general?: EstadoDocumento;
  /** Estado por documento del catálogo fijo (cédula, partida, pasaporte, licencia). */
  documentos?: Partial<Record<TipoDocumentoPersonal, EstadoDocumentoPersonal>>;
  /** Otros documentos perdidos o dañados fuera del catálogo. */
  documentos_perdidos?: DocumentoPerdido[];
  notas?: string;
}

/** Derivación o apoyo en seguimiento. */
export interface DerivacionSeguimiento {
  id: string;
  fecha: string;
  destino: string;
  motivo: string;
  estado?: "pendiente" | "completada";
}

/** Plan de egreso. */
export interface PlanEgreso {
  motivo?: string;
  destino_probable?: string;
  apoyos_necesarios?: string;
  fecha_estimada?: string | null;
}

/** Bloque de seguimiento de caso (alojamiento). */
export interface SeguimientoAlojamiento {
  notas_caso?: string;
  derivaciones?: DerivacionSeguimiento[];
  plan_egreso?: PlanEgreso;
}

/** Estatus de la vivienda afectada al momento de la emergencia. */
export type EstatusVivienda =
  | "destruida"
  | "inabitable"
  | "parcial_habitable"
  | "habitable_con_riesgo"
  | "sin_dano"
  | "sin_verificar";

export interface MetaEstatusVivienda {
  valor: EstatusVivienda;
  label: string;
  color: string;
}

export const ESTATUS_VIVIENDA: MetaEstatusVivienda[] = [
  { valor: "destruida", label: "Destruida completamente", color: "#ef4444" },
  { valor: "inabitable", label: "Declarada inabitable", color: "#f97316" },
  { valor: "parcial_habitable", label: "Parcialmente habitable", color: "#eab308" },
  { valor: "habitable_con_riesgo", label: "Habitable con riesgo", color: "#84cc16" },
  { valor: "sin_dano", label: "Sin daño (evacuación preventiva)", color: "#22c55e" },
  { valor: "sin_verificar", label: "Sin verificar", color: "#94a3b8" },
];

export const META_ESTATUS_VIVIENDA: Record<EstatusVivienda, MetaEstatusVivienda> =
  Object.fromEntries(ESTATUS_VIVIENDA.map((e) => [e.valor, e])) as Record<
    EstatusVivienda,
    MetaEstatusVivienda
  >;

/** Parentesco con el jefe de familia (vacío si es el jefe). */
export const PARENTESCOS_JEFE = [
  "Cónyuge",
  "Hijo/a",
  "Padre/Madre",
  "Hermano/a",
  "Abuelo/a",
  "Nieto/a",
  "Tío/a",
  "Sobrino/a",
  "Otro familiar",
] as const;

export type ParentescoJefe = (typeof PARENTESCOS_JEFE)[number] | string;

/** Flags personales de vulnerabilidad (subconjunto de Vulnerables agregado). */
export interface VulnerabilidadesRefugiado {
  embarazada?: boolean;
  discapacidad?: boolean;
  discapacidad_detalle?: string;
}

/** Identidad global de una persona en la red. */
export interface Refugiado {
  id: string;
  cedula: string | null;
  tipo_doc: TipoDoc | null;
  cedula_norm: string | null;
  /** @deprecated Usar campos desglosados; se mantiene por compatibilidad. */
  nombres: string;
  /** @deprecated Usar campos desglosados; se mantiene por compatibilidad. */
  apellidos: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  lugar_nacimiento: string;
  fecha_nacimiento: string | null;
  sexo: SexoRefugiado | null;
  vulnerabilidades: VulnerabilidadesRefugiado;
  codigo_ficha: string | null;
  foto_url: string | null;
  consentimiento_foto: boolean;
  consentimiento_foto_ts: number | null;
  apodo: string;
  nacionalidad: string;
  estado_documento: EstadoDocumento;
  otros_documentos: OtroDocumento[];
  contacto: ContactoRefugiado;
  tallas: TallasRefugiado;
  salud: SaludRefugiado;
  habilidades: HabilidadesRefugiado;
  documentacion: DocumentacionRefugiado;
  updated_at: number;
  updated_by: string;
}

/** Grupo familiar dentro de un campamento. */
export interface FamiliaCentro {
  id: string;
  centro_id: string;
  nombre: string;
  notas: string;
  foto_familiar_url?: string | null;
  consentimiento_foto_familiar?: boolean;
  familiares_referencia: FamiliarReferencia[];
  familiares_separados: FamiliarSeparado[];
  /** Cuántos miembros de la familia nuclear se declararon damnificados (dato declarado, no el conteo real de miembros registrados). */
  miembros_damnificados_declarados: number | null;
  /** Conteo rápido de pérdidas: fuente de verdad para el nivel de afectación, independiente de si hay detalle nominal en familiares_separados. */
  fallecidos_confirmados: number;
  desaparecidos: number;
  updated_at: number;
  updated_by: string;
}

/** Registro de alojamiento de una persona en un campamento. */
export interface AlojamientoRefugiado {
  id: string;
  refugiado_id: string;
  centro_id: string;
  familia_id: string | null;
  fecha_ingreso: string;
  fecha_egreso: string | null;
  estado: EstadoAlojamiento;
  itinerante: boolean;
  es_jefe_familia: boolean;
  parentesco_jefe: string;
  tipo_alojamiento: string;
  plaza_modulo: string;
  motivo_egreso: string;
  destino_egreso: string;
  seguimiento: SeguimientoAlojamiento;
  creada_ts: number;
  creada_por: string;
  updated_at: number;
  updated_by: string;
}

/** Residencia afectada de una familia (una por familia). */
export interface ResidenciaAfectada {
  id: string;
  familia_id: string;
  centro_id: string;
  pais: string;
  estado_federativo: string;
  municipio: string;
  parroquia: string;
  sector: string;
  direccion: string;
  referencia: string;
  estatus_vivienda: EstatusVivienda;
  geom: GeoJSON.Point | null;
  fotos: string[];
  observaciones: string;
  tipo_tenencia: TipoTenencia;
  perdio_todo: boolean;
  perdidas_materiales: string[];
  updated_at: number;
  updated_by: string;
}

/** Alojamiento enriquecido con datos de la persona (join client-side). */
export interface AlojamientoEnriquecido extends AlojamientoRefugiado {
  refugiado: Refugiado;
  familia?: FamiliaCentro | null;
}

export interface MetaEstadoAlojamiento {
  valor: EstadoAlojamiento;
  label: string;
  color: string;
}

export const ESTADOS_ALOJAMIENTO: MetaEstadoAlojamiento[] = [
  { valor: "activo", label: "Activo", color: "#22c55e" },
  { valor: "observacion", label: "En observación", color: "#eab308" },
  { valor: "transito", label: "En tránsito", color: "#38bdf8" },
  { valor: "egresado", label: "Egresado", color: "#94a3b8" },
];

export const ESTADOS_DOCUMENTO: { valor: EstadoDocumento; label: string }[] = [
  { valor: "vigente", label: "Vigente" },
  { valor: "perdida", label: "Perdida" },
  { valor: "danada", label: "Dañada" },
  { valor: "en_tramite", label: "En trámite" },
];

/** Catálogo fijo de documentos personales que se censan uno a uno. */
export const CATALOGO_DOCUMENTOS_PERSONALES: { valor: TipoDocumentoPersonal; label: string }[] = [
  { valor: "cedula", label: "Cédula de identidad" },
  { valor: "partida_nacimiento", label: "Partida de nacimiento" },
  { valor: "pasaporte", label: "Pasaporte" },
  { valor: "licencia", label: "Licencia de conducir" },
];

/** Estados posibles de cada documento del catálogo (incluye "no posee"). */
export const ESTADOS_DOCUMENTO_PERSONAL: {
  valor: EstadoDocumentoPersonal;
  label: string;
  /** Requiere operativo de emisión/reposición de documentos. */
  requiereTramite: boolean;
}[] = [
  { valor: "vigente", label: "Vigente", requiereTramite: false },
  { valor: "perdida", label: "Perdido", requiereTramite: true },
  { valor: "danada", label: "Dañado", requiereTramite: true },
  { valor: "en_tramite", label: "En trámite", requiereTramite: false },
  { valor: "no_posee", label: "No posee", requiereTramite: true },
];

/** Documentos del catálogo que requieren reposición (para operativos de emisión). */
export function documentosPorTramitar(
  documentacion: DocumentacionRefugiado | null | undefined,
): TipoDocumentoPersonal[] {
  const docs = documentacion?.documentos;
  if (!docs) return [];
  const conTramite = new Set(
    ESTADOS_DOCUMENTO_PERSONAL.filter((e) => e.requiereTramite).map((e) => e.valor),
  );
  return CATALOGO_DOCUMENTOS_PERSONALES.filter((d) => {
    const estado = docs[d.valor];
    return estado != null && conTramite.has(estado);
  }).map((d) => d.valor);
}

export const TIPOS_TENENCIA: { valor: TipoTenencia; label: string }[] = [
  { valor: "", label: "Sin especificar" },
  { valor: "propia", label: "Propia" },
  { valor: "alquilada", label: "Alquilada" },
  { valor: "prestada", label: "Prestada" },
  { valor: "ocupacion", label: "Ocupación" },
  { valor: "otro", label: "Otro" },
];

export const CATALOGO_HABILIDADES = [
  "Cocina",
  "Limpieza",
  "Electricidad",
  "Plomería",
  "Carpintería",
  "Enfermería",
  "Docencia",
  "Cuidado infantil",
  "Seguridad",
  "Logística",
  "Informática",
  "Agricultura",
] as const;

export const META_ESTADO_ALOJAMIENTO: Record<EstadoAlojamiento, MetaEstadoAlojamiento> =
  Object.fromEntries(ESTADOS_ALOJAMIENTO.map((e) => [e.valor, e])) as Record<
    EstadoAlojamiento,
    MetaEstadoAlojamiento
  >;

export type GrupoEtarioRefugiado =
  | "sin_fecha"
  | "menor5"
  | "ninez"
  | "adolescente"
  | "adulto"
  | "adulto_mayor";

export const GRUPOS_ETARIOS_REFUGIADO: {
  valor: GrupoEtarioRefugiado;
  label: string;
  descripcion: string;
}[] = [
  { valor: "menor5", label: "Menor <5", descripcion: "0 a 4 años" },
  { valor: "ninez", label: "Niñez", descripcion: "5 a 11 años" },
  { valor: "adolescente", label: "Adolescente", descripcion: "12 a 17 años" },
  { valor: "adulto", label: "Adulto", descripcion: "18 a 59 años" },
  { valor: "adulto_mayor", label: "Adulto mayor", descripcion: "60 años o más" },
  { valor: "sin_fecha", label: "Sin edad", descripcion: "Sin fecha de nacimiento" },
];

export const META_GRUPO_ETARIO_REFUGIADO = Object.fromEntries(
  GRUPOS_ETARIOS_REFUGIADO.map((g) => [g.valor, g]),
) as Record<GrupoEtarioRefugiado, (typeof GRUPOS_ETARIOS_REFUGIADO)[number]>;

const EDAD_MENOR = 18;
const EDAD_MENOR_5 = 5;
const EDAD_NINEZ = 12;
const EDAD_ADULTO_MAYOR = 60;

/** Calcula edad en años a partir de fecha de nacimiento. */
export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const [y, m, d] = fechaNacimiento.split("-").map(Number);
  if (!y || !m || !d) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  const mes = hoy.getMonth() + 1;
  if (mes < m || (mes === m && hoy.getDate() < d)) edad--;
  return edad;
}

/** ¿Menor de 5 años? */
export function esMenor5(fechaNacimiento: string | null | undefined): boolean {
  const edad = calcularEdad(fechaNacimiento);
  return edad != null && edad < EDAD_MENOR_5;
}

/** ¿Adulto mayor (60+)? */
export function esAdultoMayor(fechaNacimiento: string | null | undefined): boolean {
  const edad = calcularEdad(fechaNacimiento);
  return edad != null && edad >= EDAD_ADULTO_MAYOR;
}

/** Clasifica la persona en grupos útiles para filtros operativos. */
export function grupoEtarioRefugiado(
  fechaNacimiento: string | null | undefined,
): GrupoEtarioRefugiado {
  const edad = calcularEdad(fechaNacimiento);
  if (edad == null) return "sin_fecha";
  if (edad < EDAD_MENOR_5) return "menor5";
  if (edad < EDAD_NINEZ) return "ninez";
  if (edad < EDAD_MENOR) return "adolescente";
  if (edad < EDAD_ADULTO_MAYOR) return "adulto";
  return "adulto_mayor";
}

/** ¿Es menor de edad según fecha de nacimiento? (sin cédula obligatoria). */
export function esMenor(fechaNacimiento: string | null | undefined): boolean {
  if (!fechaNacimiento) return false;
  const [y, m, d] = fechaNacimiento.split("-").map(Number);
  if (!y || !m || !d) return false;
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  const mes = hoy.getMonth() + 1;
  if (mes < m || (mes === m && hoy.getDate() < d)) edad--;
  return edad < EDAD_MENOR;
}

/** Normaliza documento: cédula a dígitos, pasaporte a clave alfanumérica. */
export function normalizarCedula(
  cedula: string,
  tipoDoc: TipoDoc = "V",
): { cedula: string; cedula_norm: string | null; tipo_doc: TipoDoc } {
  if (tipoDoc === "P") {
    const pasaporte = cedula.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return {
      cedula: pasaporte,
      cedula_norm: pasaporte || null,
      tipo_doc: tipoDoc,
    };
  }
  const digits = cedula.replace(/\D/g, "");
  return {
    cedula: digits,
    cedula_norm: digits ? digits : null,
    tipo_doc: tipoDoc,
  };
}

/** Formatea cédula para display (V-12.345.678). */
export function formatearCedula(
  cedula: string | null | undefined,
  tipoDoc: TipoDoc | null | undefined,
): string {
  if (!cedula) return "—";
  if (tipoDoc === "P") return `P-${cedula.toUpperCase()}`;
  const d = cedula.replace(/\D/g, "");
  if (d.length <= 8) {
    const fmt = d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${tipoDoc ?? "V"}-${fmt}`;
  }
  return `${tipoDoc ?? "V"}-${d}`;
}

/** Construye nombres/apellidos agregados a partir de campos desglosados. */
export function agregarNombresApellidos(
  r: Pick<
    Refugiado,
    "primer_nombre" | "segundo_nombre" | "primer_apellido" | "segundo_apellido" | "nombres" | "apellidos"
  >,
): { nombres: string; apellidos: string } {
  const nombres = [r.primer_nombre, r.segundo_nombre].filter(Boolean).join(" ").trim()
    || (r.nombres ?? "").trim();
  const apellidos = [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(" ").trim()
    || (r.apellidos ?? "").trim();
  return { nombres, apellidos };
}

export function nombreCompleto(
  r: Pick<
    Refugiado,
    | "nombres"
    | "apellidos"
    | "primer_nombre"
    | "segundo_nombre"
    | "primer_apellido"
    | "segundo_apellido"
  >,
): string {
  const { nombres, apellidos } = agregarNombresApellidos(r);
  return [nombres, apellidos].filter(Boolean).join(" ").trim() || "Sin nombre";
}

export function normalizarVulnerabilidadesRefugiado(
  raw: Partial<VulnerabilidadesRefugiado> | null | undefined,
): VulnerabilidadesRefugiado {
  if (!raw || typeof raw !== "object") return {};
  return {
    embarazada: Boolean(raw.embarazada),
    discapacidad: Boolean(raw.discapacidad),
    discapacidad_detalle:
      typeof raw.discapacidad_detalle === "string" ? raw.discapacidad_detalle : undefined,
  };
}

export function normalizarEstatusVivienda(raw: string | null | undefined): EstatusVivienda {
  const validos: EstatusVivienda[] = [
    "destruida",
    "inabitable",
    "parcial_habitable",
    "habitable_con_riesgo",
    "sin_dano",
    "sin_verificar",
  ];
  return validos.includes(raw as EstatusVivienda) ? (raw as EstatusVivienda) : "sin_verificar";
}

export function normalizarEstadoDocumento(raw: string | null | undefined): EstadoDocumento {
  const validos: EstadoDocumento[] = ["vigente", "perdida", "danada", "en_tramite"];
  return validos.includes(raw as EstadoDocumento) ? (raw as EstadoDocumento) : "vigente";
}

export function normalizarContacto(raw: Partial<ContactoRefugiado> | null | undefined): ContactoRefugiado {
  if (!raw || typeof raw !== "object") return {};
  const alternos = Array.isArray(raw.telefonos_alternos)
    ? raw.telefonos_alternos.filter((t): t is TelefonoContacto => typeof t?.numero === "string")
    : [];
  return {
    telefono_principal: typeof raw.telefono_principal === "string" ? raw.telefono_principal : undefined,
    whatsapp_principal: Boolean(raw.whatsapp_principal),
    telefonos_alternos: alternos,
    email: typeof raw.email === "string" ? raw.email : undefined,
    contacto_emergencia: typeof raw.contacto_emergencia === "string" ? raw.contacto_emergencia : undefined,
    telefono_emergencia: typeof raw.telefono_emergencia === "string" ? raw.telefono_emergencia : undefined,
    tiene_acceso_telefono: raw.tiene_acceso_telefono !== false,
    puede_recibir_carga: Boolean(raw.puede_recibir_carga),
    notas: typeof raw.notas === "string" ? raw.notas : undefined,
  };
}

export function normalizarTallas(raw: Partial<TallasRefugiado> | null | undefined): TallasRefugiado {
  if (!raw || typeof raw !== "object") return {};
  return {
    camisa: typeof raw.camisa === "string" ? raw.camisa : undefined,
    pantalon: typeof raw.pantalon === "string" ? raw.pantalon : undefined,
    zapatos: typeof raw.zapatos === "string" ? raw.zapatos : undefined,
    ropa_interior: typeof raw.ropa_interior === "string" ? raw.ropa_interior : undefined,
    calcetines: typeof raw.calcetines === "string" ? raw.calcetines : undefined,
    notas: typeof raw.notas === "string" ? raw.notas : undefined,
  };
}

export function normalizarSalud(raw: Partial<SaludRefugiado> | null | undefined): SaludRefugiado {
  if (!raw || typeof raw !== "object") return {};
  return {
    lesiones: typeof raw.lesiones === "string" ? raw.lesiones : undefined,
    condiciones_cronicas: typeof raw.condiciones_cronicas === "string" ? raw.condiciones_cronicas : undefined,
    medicamentos_perdidos: typeof raw.medicamentos_perdidos === "string" ? raw.medicamentos_perdidos : undefined,
    medicamentos_urgente: Boolean(raw.medicamentos_urgente),
    discapacidad_ayudas: typeof raw.discapacidad_ayudas === "string" ? raw.discapacidad_ayudas : undefined,
    salud_mental: typeof raw.salud_mental === "string" ? raw.salud_mental : undefined,
    embarazo_semanas: typeof raw.embarazo_semanas === "number" ? raw.embarazo_semanas : null,
    lactancia: Boolean(raw.lactancia),
    puerperio: Boolean(raw.puerperio),
    notas: typeof raw.notas === "string" ? raw.notas : undefined,
  };
}

export function normalizarHabilidades(
  raw: Partial<HabilidadesRefugiado> | null | undefined,
): HabilidadesRefugiado {
  if (!raw || typeof raw !== "object") return {};
  const habilidades = Array.isArray(raw.habilidades)
    ? raw.habilidades.filter((h): h is HabilidadRefugiado => typeof h?.nombre === "string")
    : [];
  return {
    ocupacion_previa: typeof raw.ocupacion_previa === "string" ? raw.ocupacion_previa : undefined,
    habilidades,
    disponible_campamento: raw.disponible_campamento !== false,
    herramientas_perdidas: typeof raw.herramientas_perdidas === "string" ? raw.herramientas_perdidas : undefined,
    notas: typeof raw.notas === "string" ? raw.notas : undefined,
  };
}

export function normalizarDocumentacion(
  raw: Partial<DocumentacionRefugiado> | null | undefined,
): DocumentacionRefugiado {
  if (!raw || typeof raw !== "object") return {};
  const docs = Array.isArray(raw.documentos_perdidos) ? raw.documentos_perdidos : [];
  const estadosValidos = new Set(ESTADOS_DOCUMENTO_PERSONAL.map((e) => e.valor));
  const documentos: DocumentacionRefugiado["documentos"] = {};
  if (raw.documentos && typeof raw.documentos === "object") {
    for (const { valor } of CATALOGO_DOCUMENTOS_PERSONALES) {
      const estado = raw.documentos[valor];
      if (estado && estadosValidos.has(estado)) documentos[valor] = estado;
    }
  }
  return {
    estado_general: raw.estado_general ? normalizarEstadoDocumento(raw.estado_general) : undefined,
    documentos,
    documentos_perdidos: docs.filter((d): d is DocumentoPerdido => typeof d?.tipo === "string"),
    notas: typeof raw.notas === "string" ? raw.notas : undefined,
  };
}

export function normalizarSeguimiento(
  raw: Partial<SeguimientoAlojamiento> | null | undefined,
): SeguimientoAlojamiento {
  if (!raw || typeof raw !== "object") return {};
  return {
    notas_caso: typeof raw.notas_caso === "string" ? raw.notas_caso : undefined,
    derivaciones: Array.isArray(raw.derivaciones) ? raw.derivaciones : [],
    plan_egreso: raw.plan_egreso && typeof raw.plan_egreso === "object" ? raw.plan_egreso : undefined,
  };
}

export function normalizarFamiliaresReferencia(raw: unknown): FamiliarReferencia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is FamiliarReferencia => typeof f?.id === "string" && typeof f?.nombres === "string")
    .map((f) => ({
      id: f.id,
      nombres: f.nombres.trim(),
      fecha_nacimiento: f.fecha_nacimiento ?? null,
      parentesco: (f.parentesco ?? "").trim(),
      sexo: f.sexo === "M" || f.sexo === "F" || f.sexo === "O" ? f.sexo : null,
      en_mismo_campamento: Boolean(f.en_mismo_campamento),
      ubicacion: typeof f.ubicacion === "string" ? f.ubicacion : undefined,
      contacto: typeof f.contacto === "string" ? f.contacto : undefined,
      salud_breve: typeof f.salud_breve === "string" ? f.salud_breve : undefined,
      documento: typeof f.documento === "string" ? f.documento : undefined,
      estado_doc: f.estado_doc ? normalizarEstadoDocumento(f.estado_doc) : undefined,
    }));
}

export function normalizarFamiliaresSeparados(raw: unknown): FamiliarSeparado[] {
  if (!Array.isArray(raw)) return [];
  const estados = ["desaparecido", "separado", "contacto_perdido", "fallecido"] as const;
  return raw
    .filter((f): f is FamiliarSeparado => typeof f?.id === "string" && typeof f?.nombre === "string")
    .map((f) => {
      const tipoRaw = f.tipo_doc;
      const tipo_doc: TipoDoc | null =
        tipoRaw === "V" || tipoRaw === "E" || tipoRaw === "P" ? tipoRaw : null;
      let cedula: string | null =
        typeof f.cedula === "string" && f.cedula.trim() ? f.cedula.trim() : null;
      let cedula_norm: string | null =
        typeof f.cedula_norm === "string" && f.cedula_norm.trim()
          ? f.cedula_norm.trim()
          : null;
      if (cedula && !cedula_norm) {
        const norm = normalizarCedula(cedula, tipo_doc ?? "V");
        cedula = norm.cedula;
        cedula_norm = norm.cedula_norm;
      }
      return {
        id: f.id,
        nombre: f.nombre.trim(),
        parentesco: (f.parentesco ?? "").trim(),
        ultima_ubicacion: typeof f.ultima_ubicacion === "string" ? f.ultima_ubicacion : undefined,
        contacto: typeof f.contacto === "string" ? f.contacto : undefined,
        estado: estados.includes(f.estado as (typeof estados)[number])
          ? (f.estado as FamiliarSeparado["estado"])
          : "separado",
        edad_aproximada: typeof f.edad_aproximada === "number" ? f.edad_aproximada : null,
        fecha_fallecimiento: typeof f.fecha_fallecimiento === "string" ? f.fecha_fallecimiento : null,
        notas: typeof f.notas === "string" ? f.notas : undefined,
        cedula,
        tipo_doc: tipo_doc ?? (cedula ? "V" : null),
        cedula_norm,
        verificado_nexus: f.verificado_nexus === true,
      };
    });
}

export function resumenFamiliaVulnerable(
  miembros: { refugiado: Refugiado }[],
  referencia: FamiliarReferencia[],
): { menores5: number; adultosMayores: number; discapacidad: number; urgentes: number } {
  const todos = [
    ...miembros.map((m) => m.refugiado),
    ...referencia.map((r) => ({
      fecha_nacimiento: r.fecha_nacimiento,
      vulnerabilidades: {},
    })),
  ];
  let menores5 = 0;
  let adultosMayores = 0;
  let discapacidad = 0;
  for (const p of todos) {
    if (esMenor5(p.fecha_nacimiento)) menores5++;
    if (esAdultoMayor(p.fecha_nacimiento)) adultosMayores++;
  }
  for (const m of miembros) {
    if (m.refugiado.vulnerabilidades.discapacidad) discapacidad++;
    if (m.refugiado.vulnerabilidades.embarazada) discapacidad++;
  }
  return { menores5, adultosMayores, discapacidad, urgentes: menores5 + discapacidad };
}

export function normalizarRefugiado(raw: Partial<Refugiado> & { id: string }): Refugiado {
  const primerNombre = (raw.primer_nombre ?? raw.nombres ?? "").trim();
  const primerApellido = (raw.primer_apellido ?? raw.apellidos ?? "").trim();
  const { nombres, apellidos } = agregarNombresApellidos({
    primer_nombre: primerNombre,
    segundo_nombre: (raw.segundo_nombre ?? "").trim(),
    primer_apellido: primerApellido,
    segundo_apellido: (raw.segundo_apellido ?? "").trim(),
    nombres: (raw.nombres ?? "").trim(),
    apellidos: (raw.apellidos ?? "").trim(),
  });

  return {
    id: raw.id,
    cedula: raw.cedula ?? null,
    tipo_doc: raw.tipo_doc === "V" || raw.tipo_doc === "E" ? raw.tipo_doc : null,
    cedula_norm: raw.cedula_norm ?? null,
    nombres,
    apellidos,
    primer_nombre: primerNombre,
    segundo_nombre: (raw.segundo_nombre ?? "").trim(),
    primer_apellido: primerApellido,
    segundo_apellido: (raw.segundo_apellido ?? "").trim(),
    lugar_nacimiento: (raw.lugar_nacimiento ?? "").trim(),
    fecha_nacimiento: raw.fecha_nacimiento ?? null,
    sexo: raw.sexo === "M" || raw.sexo === "F" || raw.sexo === "O" ? raw.sexo : null,
    vulnerabilidades: normalizarVulnerabilidadesRefugiado(raw.vulnerabilidades),
    codigo_ficha: raw.codigo_ficha ?? null,
    foto_url: raw.foto_url ?? null,
    consentimiento_foto: Boolean(raw.consentimiento_foto),
    consentimiento_foto_ts: raw.consentimiento_foto_ts ?? null,
    apodo: (raw.apodo ?? "").trim(),
    nacionalidad: normalizarNacionalidadCatalogo(raw.nacionalidad),
    estado_documento: normalizarEstadoDocumento(raw.estado_documento),
    otros_documentos: Array.isArray(raw.otros_documentos)
      ? raw.otros_documentos.filter((d): d is OtroDocumento => typeof d?.tipo === "string")
      : [],
    contacto: normalizarContacto(raw.contacto),
    tallas: normalizarTallas(raw.tallas),
    salud: normalizarSalud(raw.salud),
    habilidades: normalizarHabilidades(raw.habilidades),
    documentacion: normalizarDocumentacion(raw.documentacion),
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

export function normalizarFamiliaCentro(
  raw: Partial<FamiliaCentro> & { id: string; centro_id: string },
): FamiliaCentro {
  return {
    id: raw.id,
    centro_id: raw.centro_id,
    nombre: (raw.nombre ?? "").trim(),
    notas: (raw.notas ?? "").trim(),
    foto_familiar_url: raw.foto_familiar_url ?? null,
    consentimiento_foto_familiar: Boolean(raw.consentimiento_foto_familiar),
    familiares_referencia: normalizarFamiliaresReferencia(raw.familiares_referencia),
    familiares_separados: normalizarFamiliaresSeparados(raw.familiares_separados),
    miembros_damnificados_declarados:
      typeof raw.miembros_damnificados_declarados === "number"
        ? raw.miembros_damnificados_declarados
        : null,
    fallecidos_confirmados:
      typeof raw.fallecidos_confirmados === "number" ? raw.fallecidos_confirmados : 0,
    desaparecidos: typeof raw.desaparecidos === "number" ? raw.desaparecidos : 0,
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

export function normalizarEstadoAlojamiento(raw: string | null | undefined): EstadoAlojamiento {
  const validos: EstadoAlojamiento[] = ["activo", "observacion", "transito", "egresado"];
  return validos.includes(raw as EstadoAlojamiento) ? (raw as EstadoAlojamiento) : "activo";
}

export function normalizarAlojamiento(
  raw: Partial<AlojamientoRefugiado> & { id: string; refugiado_id: string; centro_id: string },
): AlojamientoRefugiado {
  return {
    id: raw.id,
    refugiado_id: raw.refugiado_id,
    centro_id: raw.centro_id,
    familia_id: raw.familia_id ?? null,
    fecha_ingreso: raw.fecha_ingreso ?? "",
    fecha_egreso: raw.fecha_egreso ?? null,
    estado: normalizarEstadoAlojamiento(raw.estado),
    itinerante: Boolean(raw.itinerante),
    es_jefe_familia: Boolean(raw.es_jefe_familia),
    parentesco_jefe: (raw.parentesco_jefe ?? "").trim(),
    tipo_alojamiento: (raw.tipo_alojamiento ?? "").trim(),
    plaza_modulo: (raw.plaza_modulo ?? "").trim(),
    motivo_egreso: (raw.motivo_egreso ?? "").trim(),
    destino_egreso: (raw.destino_egreso ?? "").trim(),
    seguimiento: normalizarSeguimiento(raw.seguimiento),
    creada_ts: raw.creada_ts ?? 0,
    creada_por: raw.creada_por ?? "",
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

export function normalizarResidenciaAfectada(
  raw: Partial<ResidenciaAfectada> & { id: string; familia_id: string; centro_id: string },
  geomNormalizado?: GeoJSON.Point | null,
): ResidenciaAfectada {
  let fotos: string[] = [];
  if (Array.isArray(raw.fotos)) {
    fotos = raw.fotos.filter((f): f is string => typeof f === "string");
  }

  return {
    id: raw.id,
    familia_id: raw.familia_id,
    centro_id: raw.centro_id,
    pais: (raw.pais ?? "Venezuela").trim() || "Venezuela",
    estado_federativo: (raw.estado_federativo ?? "").trim(),
    municipio: (raw.municipio ?? "").trim(),
    parroquia: (raw.parroquia ?? "").trim(),
    sector: (raw.sector ?? "").trim(),
    direccion: (raw.direccion ?? "").trim(),
    referencia: (raw.referencia ?? "").trim(),
    estatus_vivienda: normalizarEstatusVivienda(raw.estatus_vivienda),
    geom: geomNormalizado ?? null,
    fotos,
    observaciones: (raw.observaciones ?? "").trim(),
    tipo_tenencia: (raw.tipo_tenencia ?? "") as TipoTenencia,
    perdio_todo: Boolean(raw.perdio_todo),
    perdidas_materiales: Array.isArray(raw.perdidas_materiales)
      ? raw.perdidas_materiales.filter((p): p is string => typeof p === "string")
      : [],
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

/** Filtra alojamientos con estado activo. */
export function alojamientosActivos(alojamientos: AlojamientoRefugiado[]): AlojamientoRefugiado[] {
  return alojamientos.filter((a) => a.estado === "activo");
}

/** Agrupa alojamientos enriquecidos por familia_id (null = sin familia). */
export function agruparPorFamilia(
  items: AlojamientoEnriquecido[],
): Map<string | null, AlojamientoEnriquecido[]> {
  const map = new Map<string | null, AlojamientoEnriquecido[]>();
  for (const item of items) {
    const key = item.familia_id;
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

/** Cédulas con 2+ campamentos activos distintos (alerta anti-fraude). */
export function detectarDuplicadosCedula(
  alojamientos: AlojamientoEnriquecido[],
): Map<string, string[]> {
  const porCedula = new Map<string, Set<string>>();
  for (const a of alojamientos) {
    if (a.estado !== "activo") continue;
    const norm = a.refugiado.cedula_norm;
    if (!norm) continue;
    const set = porCedula.get(norm) ?? new Set<string>();
    set.add(a.centro_id);
    porCedula.set(norm, set);
  }
  const duplicados = new Map<string, string[]>();
  for (const [cedula, centros] of porCedula) {
    if (centros.size >= 2) {
      duplicados.set(cedula, [...centros]);
    }
  }
  return duplicados;
}

export interface ProgresoCenso {
  metaRefugiados: number;
  metaFamilias: number;
  registradosRefugiados: number;
  registradosFamilias: number;
  pctRefugiados: number;
  pctFamilias: number;
}

/** Progreso del censo nominal vs meta del parte numérico. */
export function progresoCensoNominal(
  meta: { refugiados: number; familias: number },
  registrados: { refugiados: number; familias: number },
): ProgresoCenso {
  const pct = (actual: number, total: number) =>
    total > 0 ? Math.min(100, Math.round((actual / total) * 100)) : 0;
  return {
    metaRefugiados: meta.refugiados,
    metaFamilias: meta.familias,
    registradosRefugiados: registrados.refugiados,
    registradosFamilias: registrados.familias,
    pctRefugiados: pct(registrados.refugiados, meta.refugiados),
    pctFamilias: pct(registrados.familias, meta.familias),
  };
}

/** Cuenta familias distintas con al menos un miembro activo. */
export function contarFamiliasActivas(alojamientos: AlojamientoRefugiado[]): number {
  const familias = new Set<string>();
  let sinFamilia = 0;
  for (const a of alojamientos) {
    if (a.estado !== "activo") continue;
    if (a.familia_id) familias.add(a.familia_id);
    else sinFamilia++;
  }
  return familias.size + (sinFamilia > 0 ? 1 : 0);
}

/** Dirección legible de una residencia afectada. */
export function direccionResidencia(r: Pick<
  ResidenciaAfectada,
  "pais" | "direccion" | "sector" | "parroquia" | "municipio" | "estado_federativo" | "referencia"
>): string {
  const partes = [
    r.direccion,
    r.sector,
    r.parroquia,
    r.municipio,
    r.estado_federativo,
    r.pais && r.pais !== "Venezuela" ? r.pais : "",
  ].filter(Boolean);
  const base = partes.join(", ");
  if (r.referencia) return base ? `${base} (${r.referencia})` : r.referencia;
  return base || "—";
}
