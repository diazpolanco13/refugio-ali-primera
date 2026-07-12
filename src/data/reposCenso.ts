// Censo rápido en terreno (sin login): RPCs censo_registrar /
// censo_actualizar / censo_eliminar / censo_listado / censo_completar /
// censo_cierre. La escritura pasa por funciones security definer en Supabase;
// el rol anon no tiene acceso directo a las tablas y, desde la migración
// tokens_terreno_censo, sin sesión cada RPC exige el token de terreno del
// campamento (?t= del QR). Con sesión autenticada el token es irrelevante.

import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { ResumenCensoCentro } from "@/domain/censoResumen";
import { tokenTerrenoActual } from "@/lib/tokenTerreno";
import { supabase } from "./supabaseClient";

/** Token de terreno a adjuntar en las RPC (null si el dispositivo no tiene). */
function tokenActual(): string | null {
  return tokenTerrenoActual() || null;
}

/** PostgREST/Supabase devuelve como máximo 1000 filas por petición RPC. */
const LIMITE_FILAS_RPC = 1000;

/** Tamaño de bloque al descargar todos los registros (p. ej. exportación). */
export const LIMITE_BLOQUE_EXPORTACION_CENSO_RED = LIMITE_FILAS_RPC;

async function rpcSetofPaginado<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<PostgrestSingleResponse<T[]>>,
): Promise<T[]> {
  const acumulado: T[] = [];
  let desde = 0;

  for (;;) {
    const hasta = desde + LIMITE_FILAS_RPC - 1;
    const { data, error } = await consultar(desde, hasta);
    if (error) throw new Error(error.message);

    const pagina = data ?? [];
    acumulado.push(...pagina);
    if (pagina.length < LIMITE_FILAS_RPC) break;
    desde += LIMITE_FILAS_RPC;
  }

  return acumulado;
}

export interface AnalistaContactoTerreno {
  nombre: string;
  telegram: string | null;
  whatsapp: string | null;
}

export interface CentroCenso {
  id: string;
  nombre: string;
  /** True si el campamento ya tiene coordenada en BD. */
  geolocalizado?: boolean;
  /** True si hay responsables o ámbitos «sin autoridades» en el directorio. */
  autoridades_ok?: boolean;
  /** True si hay aforo oficial, recurso Esfera o agua medida. */
  capacidad_ok?: boolean;
  /** Epoch ms de última actualización por tarea (portal /terreno). */
  geolocalizacion_ts?: number | null;
  autoridades_ts?: number | null;
  capacidad_ts?: number | null;
  /** Analistas SAE del campamento (nombre + Telegram) vía `terreno_centro`. */
  analistas_contacto?: AnalistaContactoTerreno[];
  /** Meta del parte numérico (último snapshot de ocupación). */
  parte_personas?: number;
  parte_familias?: number;
  /** Censo nominal activo en el campamento. */
  censados_personas?: number;
  censados_familias?: number;
}

/** Funcionario que dirige el levantamiento en la escuela. */
export interface FuncionarioCenso {
  jerarquia: string;
  nombre: string;
  institucion: string;
  telefono: string;
}

/** Geolocalización opcional del censador (validador de presencia en el refugio). */
export interface UbicacionCensador {
  en_refugio: boolean;
  lat: number | null;
  lng: number | null;
  /** Precisión del GPS en metros. */
  precision: number | null;
}

export function ubicacionCensadorVacia(): UbicacionCensador {
  return { en_refugio: true, lat: null, lng: null, precision: null };
}

/** Condición de la vivienda perdida (planilla física). */
export type CondicionVivienda = "" | "destruida" | "inhabitable" | "no_posee";

export const CONDICIONES_VIVIENDA: { valor: CondicionVivienda; label: string }[] = [
  { valor: "destruida", label: "Destruida" },
  { valor: "inhabitable", label: "Inhabitable" },
  { valor: "no_posee", label: "No posee" },
];

/** Parentesco de un menor con el jefe de su familia. */
export const PARENTESCOS_MENOR = [
  "Hijo/a",
  "Nieto/a",
  "Hermano/a",
  "Sobrino/a",
  "Otro familiar",
] as const;

/** Datos de la persona damnificada capturados en terreno (planilla física). */
export interface RegistroCenso {
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  edad: number | null;
  tipo_doc: "V" | "E" | "P" | "";
  documento: string;
  sexo: "M" | "F" | "";
  telefono: string;
  embarazada: boolean;
  embarazo_semanas: number | null;
  discapacidad: boolean;
  discapacidad_detalle: string;
  enfermedad: boolean;
  enfermedad_detalle: string;
  /** Menores de edad: cédula del jefe de familia y parentesco. */
  jefe_tipo_doc: "V" | "E" | "P" | "";
  jefe_documento: string;
  parentesco_jefe: string;
  pais: string;
  estado_federativo: string;
  municipio: string;
  parroquia: string;
  condicion_vivienda: CondicionVivienda;
  calle: string;
  casa_edificio: string;
}

/** Fila devuelta por censo_listado (registros de un refugio). */
export interface RegistroCensoGuardado {
  id: string;
  creado_en: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  edad: number | null;
  tipo_doc: string | null;
  documento: string;
  sexo: string | null;
  telefono: string;
  embarazada: boolean;
  embarazo_semanas: number | null;
  discapacidad: boolean;
  discapacidad_detalle: string;
  enfermedad: boolean;
  enfermedad_detalle: string;
  jefe_tipo_doc: string | null;
  jefe_documento: string;
  parentesco_jefe: string;
  jefe_registro_id: string | null;
  pais: string;
  condicion_vivienda: string;
  estado_federativo: string;
  municipio: string;
  parroquia: string;
  calle: string;
  casa_edificio: string;
}

/** Fila devuelta por censo_listado_red (registro + campamento). */
export interface RegistroCensoRed extends RegistroCensoGuardado {
  centro_id: string;
  centro_nombre: string;
}

/** Último cierre declarado del censo de un refugio. */
export interface CierreCenso {
  creado_en: string;
  funcionario_nombre: string;
  funcionario_institucion: string;
  total_registrados: number;
}

/** Payload JSON que esperan censo_registrar y censo_actualizar. */
function payloadRegistro(registro: RegistroCenso) {
  return {
    primer_nombre: registro.primer_nombre.trim(),
    segundo_nombre: registro.segundo_nombre.trim(),
    primer_apellido: registro.primer_apellido.trim(),
    segundo_apellido: registro.segundo_apellido.trim(),
    edad: registro.edad != null ? String(registro.edad) : "",
    tipo_doc: registro.tipo_doc,
    documento: registro.documento.trim(),
    sexo: registro.sexo,
    telefono: registro.telefono.trim(),
    embarazada: registro.embarazada,
    embarazo_semanas:
      registro.embarazada && registro.embarazo_semanas != null
        ? String(registro.embarazo_semanas)
        : "",
    discapacidad: registro.discapacidad,
    discapacidad_detalle: registro.discapacidad ? registro.discapacidad_detalle.trim() : "",
    enfermedad: registro.enfermedad,
    enfermedad_detalle: registro.enfermedad ? registro.enfermedad_detalle.trim() : "",
    jefe_tipo_doc: registro.jefe_tipo_doc,
    jefe_documento: registro.jefe_documento.trim(),
    parentesco_jefe: registro.parentesco_jefe,
    pais: registro.pais,
    estado_federativo: registro.estado_federativo,
    municipio: registro.municipio,
    parroquia: registro.parroquia,
    condicion_vivienda: registro.condicion_vivienda,
    calle: registro.calle.trim(),
    casa_edificio: registro.casa_edificio.trim(),
  };
}

/** Convierte una fila guardada al formulario de edición. */
export function registroDesdeGuardado(fila: RegistroCensoGuardado): RegistroCenso {
  const tipoDoc = fila.tipo_doc === "V" || fila.tipo_doc === "E" || fila.tipo_doc === "P"
    ? fila.tipo_doc
    : "V";
  const jefeTipoDoc =
    fila.jefe_tipo_doc === "V" || fila.jefe_tipo_doc === "E" || fila.jefe_tipo_doc === "P"
      ? fila.jefe_tipo_doc
      : "V";
  const sexo = fila.sexo === "M" || fila.sexo === "F" ? fila.sexo : "";
  const condicion =
    fila.condicion_vivienda === "destruida" ||
    fila.condicion_vivienda === "inhabitable" ||
    fila.condicion_vivienda === "no_posee"
      ? fila.condicion_vivienda
      : "";

  return {
    primer_nombre: fila.primer_nombre,
    segundo_nombre: fila.segundo_nombre,
    primer_apellido: fila.primer_apellido,
    segundo_apellido: fila.segundo_apellido,
    edad: fila.edad,
    tipo_doc: tipoDoc,
    documento: fila.documento,
    sexo,
    telefono: fila.telefono,
    embarazada: fila.embarazada,
    embarazo_semanas: fila.embarazo_semanas,
    discapacidad: fila.discapacidad,
    discapacidad_detalle: fila.discapacidad_detalle,
    enfermedad: fila.enfermedad,
    enfermedad_detalle: fila.enfermedad_detalle,
    jefe_tipo_doc: jefeTipoDoc,
    jefe_documento: fila.jefe_documento,
    parentesco_jefe: fila.parentesco_jefe,
    pais: fila.pais || "Venezuela",
    estado_federativo: fila.estado_federativo,
    municipio: fila.municipio,
    parroquia: fila.parroquia,
    condicion_vivienda: condicion,
    calle: fila.calle,
    casa_edificio: fila.casa_edificio,
  };
}

/** Fila de contexto del censo manual viejo para una cédula, mostrada como
 * referencia de solo lectura en el flujo "Por cédula" — no se usa para
 * autocompletar el alta nominal, el censador confirma con lo que ve/verifica. */
export interface RegistroCensoViejoResumen {
  creadoEn: string;
  funcionarioNombre: string;
  centroId: string;
  direccion: string;
  telefono: string;
  jefeDocumento: string;
  jefeTipoDoc: string | null;
  parentescoJefe: string;
}

/** Busca en `censo_registros` (planilla vieja) una fila con esa cédula
 * normalizada — la más reciente si hubiera más de una. Solo lectura: la RLS
 * de `censo_registros` permite `select` a cualquier sesión autenticada. */
export async function buscarCensoRegistroPorDocumento(
  documentoNorm: string,
): Promise<RegistroCensoViejoResumen | null> {
  if (!documentoNorm) return null;
  const { data, error } = await supabase
    .from("censo_registros")
    .select(
      "creado_en, funcionario_nombre, centro_id, calle, casa_edificio, parroquia, municipio, estado_federativo, telefono, jefe_tipo_doc, jefe_documento, parentesco_jefe",
    )
    .eq("documento_norm", documentoNorm)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const direccion = [data.calle, data.casa_edificio, data.parroquia, data.municipio, data.estado_federativo]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");

  return {
    creadoEn: data.creado_en,
    funcionarioNombre: data.funcionario_nombre || "",
    centroId: data.centro_id,
    direccion,
    telefono: data.telefono || "",
    jefeDocumento: data.jefe_documento || "",
    jefeTipoDoc: data.jefe_tipo_doc,
    parentescoJefe: data.parentesco_jefe || "",
  };
}

/** Lista de refugios activos (id + nombre). Requiere sesión autenticada. */
export async function listarCentrosCenso(): Promise<CentroCenso[]> {
  const { data, error } = await supabase.rpc("censo_centros");
  if (error) throw new Error(error.message);
  return (data ?? []) as CentroCenso[];
}

/** Campamento asociado a un token de terreno (null si es inválido o fue revocado). */
export async function obtenerCentroTerreno(token: string): Promise<CentroCenso | null> {
  const { data, error } = await supabase.rpc("terreno_centro", { p_token: token });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as CentroCenso[];
  return filas[0] ?? null;
}

/** Registra una persona en el censo rápido. Devuelve el id del registro. */
export async function registrarCenso(
  centroId: string,
  funcionario: FuncionarioCenso,
  registro: RegistroCenso,
  ubicacion?: UbicacionCensador,
): Promise<string> {
  const { data, error } = await supabase.rpc("censo_registrar", {
    p_centro_id: centroId,
    p_funcionario: {
      jerarquia: funcionario.jerarquia.trim(),
      nombre: funcionario.nombre.trim(),
      institucion: funcionario.institucion.trim(),
      telefono: funcionario.telefono.trim(),
      en_refugio: ubicacion?.en_refugio ?? false,
      lat: ubicacion?.lat ?? null,
      lng: ubicacion?.lng ?? null,
      precision: ubicacion?.precision ?? null,
    },
    p_registro: payloadRegistro(registro),
    p_token: tokenActual(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Corrige un registro existente del censo. */
export async function actualizarCenso(id: string, registro: RegistroCenso): Promise<void> {
  const { error } = await supabase.rpc("censo_actualizar", {
    p_id: id,
    p_registro: payloadRegistro(registro),
    p_token: tokenActual(),
  });
  if (error) throw new Error(error.message);
}

/** Elimina un registro del censo (irreversible). */
export async function eliminarCenso(id: string): Promise<void> {
  const { error } = await supabase.rpc("censo_eliminar", { p_id: id, p_token: tokenActual() });
  if (error) throw new Error(error.message);
}

/** Registros del censo de un refugio (vista de estadística del operador). */
export async function listarRegistrosCenso(centroId: string): Promise<RegistroCensoGuardado[]> {
  return rpcSetofPaginado<RegistroCensoGuardado>((desde, hasta) =>
    supabase
      .rpc("censo_listado", { p_centro_id: centroId, p_token: tokenActual() })
      .range(desde, hasta),
  );
}

/** Ids de `censo_registros` ya marcados `procesado = true` en un centro (para
 * pintar el badge "verificado" en la lista "Registrados"). Solo lectura
 * directa a la tabla: la RLS de select es abierta a cualquier autenticado. */
export async function listarIdsCensoProcesados(centroId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("censo_registros")
    .select("id")
    .eq("centro_id", centroId)
    .eq("procesado", true);
  if (error || !data) return new Set();
  return new Set(data.map((f) => f.id as string));
}

/** Marca una fila del censo manual viejo como ya verificada en el censo
 * nominal (alta exitosa vía "Por cédula"). Fire-and-forget: nunca debe
 * interrumpir el flujo de alta si falla. */
export function marcarCensoProcesado(documentoNorm: string, centroId: string): void {
  if (!documentoNorm || !centroId) return;
  void supabase
    .rpc("censo_marcar_procesado", { p_documento_norm: documentoNorm, p_centro_id: centroId })
    .then(({ error }) => {
      if (error) console.warn("[reposCenso] marcarCensoProcesado:", error.message);
    });
}

/** Declara completado el registro del refugio. Devuelve el total al momento del cierre. */
export async function completarCenso(
  centroId: string,
  funcionario: FuncionarioCenso,
): Promise<number> {
  const { data, error } = await supabase.rpc("censo_completar", {
    p_centro_id: centroId,
    p_funcionario: {
      jerarquia: funcionario.jerarquia.trim(),
      nombre: funcionario.nombre.trim(),
      institucion: funcionario.institucion.trim(),
      telefono: funcionario.telefono.trim(),
    },
    p_token: tokenActual(),
  });
  if (error) throw new Error(error.message);
  return data as number;
}

/** Anula el cierre declarado y deja el censo en curso / sin iniciar según registros. */
export async function reabrirCenso(centroId: string): Promise<number> {
  const { data, error } = await supabase.rpc("censo_reabrir", {
    p_centro_id: centroId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Último cierre declarado del censo de un refugio (null si nunca se completó). */
export async function obtenerCierreCenso(centroId: string): Promise<CierreCenso | null> {
  const { data, error } = await supabase.rpc("censo_cierre", {
    p_centro_id: centroId,
    p_token: tokenActual(),
  });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as CierreCenso[];
  return filas[0] ?? null;
}

interface FilaResumenCensoRed {
  centro_id: string;
  centro_nombre: string;
  total_registrados: number;
  ultimo_registro_en: string | null;
  cierre_en: string | null;
  cierre_total: number | null;
  cierre_funcionario: string | null;
  hombres: number;
  mujeres: number;
  otros_sexo: number;
  recien_nacidos_h: number;
  recien_nacidos_m: number;
  ninos: number;
  ninas: number;
  adolescentes_h: number;
  adolescentes_m: number;
  adultos_h: number;
  adultos_m: number;
  adultos_mayores_h: number;
  adultos_mayores_m: number;
  embarazadas: number;
  discapacidad: number;
  discapacidad_h: number;
  discapacidad_m: number;
  enfermedad: number;
  vivienda_destruida: number;
  vivienda_inhabitable: number;
  vivienda_no_posee: number;
  sin_condicion_vivienda: number;
  parte_total: number | null;
  parte_familias: number | null;
  parte_dia: string | null;
  sin_cedula: number;
  importados_planilla: number;
  sin_edad: number;
}

function mapearResumenCensoCentro(fila: FilaResumenCensoRed): ResumenCensoCentro {
  return {
    centroId: fila.centro_id,
    centroNombre: fila.centro_nombre,
    totalRegistrados: Number(fila.total_registrados ?? 0),
    ultimoRegistroEn: fila.ultimo_registro_en,
    cierreEn: fila.cierre_en,
    cierreTotal: fila.cierre_total != null ? Number(fila.cierre_total) : null,
    cierreFuncionario: fila.cierre_funcionario,
    hombres: Number(fila.hombres ?? 0),
    mujeres: Number(fila.mujeres ?? 0),
    otrosSexo: Number(fila.otros_sexo ?? 0),
    recienNacidosH: Number(fila.recien_nacidos_h ?? 0),
    recienNacidosM: Number(fila.recien_nacidos_m ?? 0),
    ninos: Number(fila.ninos ?? 0),
    ninas: Number(fila.ninas ?? 0),
    adolescentesH: Number(fila.adolescentes_h ?? 0),
    adolescentesM: Number(fila.adolescentes_m ?? 0),
    adultosH: Number(fila.adultos_h ?? 0),
    adultosM: Number(fila.adultos_m ?? 0),
    adultosMayoresH: Number(fila.adultos_mayores_h ?? 0),
    adultosMayoresM: Number(fila.adultos_mayores_m ?? 0),
    embarazadas: Number(fila.embarazadas ?? 0),
    discapacidad: Number(fila.discapacidad ?? 0),
    discapacidadH: Number(fila.discapacidad_h ?? 0),
    discapacidadM: Number(fila.discapacidad_m ?? 0),
    enfermedad: Number(fila.enfermedad ?? 0),
    viviendaDestruida: Number(fila.vivienda_destruida ?? 0),
    viviendaInhabitable: Number(fila.vivienda_inhabitable ?? 0),
    viviendaNoPosee: Number(fila.vivienda_no_posee ?? 0),
    sinCondicionVivienda: Number(fila.sin_condicion_vivienda ?? 0),
    parteTotal: fila.parte_total != null ? Number(fila.parte_total) : null,
    parteFamilias: fila.parte_familias != null ? Number(fila.parte_familias) : null,
    parteDia: fila.parte_dia,
    sinCedula: Number(fila.sin_cedula ?? 0),
    importadosPlanilla: Number(fila.importados_planilla ?? 0),
    sinEdad: Number(fila.sin_edad ?? 0),
  };
}

/** Resumen agregado del censo rápido de toda la red (solo roles autorizados). */
export async function obtenerResumenCensoRed(): Promise<ResumenCensoCentro[]> {
  const { data, error } = await supabase.rpc("censo_resumen_red");
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaResumenCensoRed[]).map(mapearResumenCensoCentro);
}

type FilaListadoCensoRed = RegistroCensoRed;

export const FILAS_POR_PAGINA_CENSO_RED = 50;

export interface FiltrosListadoCensoRed {
  centroId?: string;
  sexo?: string;
  busqueda?: string;
  orden?: string;
}

function paramsFiltrosListadoCensoRed(filtros: FiltrosListadoCensoRed) {
  return {
    p_centro_id: filtros.centroId && filtros.centroId !== "todos" ? filtros.centroId : null,
    p_sexo: filtros.sexo && filtros.sexo !== "todos" ? filtros.sexo : null,
    p_busqueda: filtros.busqueda?.trim() || null,
    p_orden: filtros.orden ?? "reciente",
  };
}

/** Total de registros del listado general con filtros (sin paginar). */
export async function contarListadoCensoRed(filtros: FiltrosListadoCensoRed = {}): Promise<number> {
  const { p_centro_id, p_sexo, p_busqueda } = paramsFiltrosListadoCensoRed(filtros);
  const { data, error } = await supabase.rpc("censo_listado_red_conteo", {
    p_centro_id,
    p_sexo,
    p_busqueda,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Página del listado general del censo rápido en la red. */
export async function obtenerListadoCensoRedPaginado(
  filtros: FiltrosListadoCensoRed,
  pagina: number,
  filasPorPagina = FILAS_POR_PAGINA_CENSO_RED,
): Promise<RegistroCensoRed[]> {
  const { p_centro_id, p_sexo, p_busqueda, p_orden } = paramsFiltrosListadoCensoRed(filtros);
  const { data, error } = await supabase.rpc("censo_listado_red_paginado", {
    p_limit: filasPorPagina,
    p_offset: pagina * filasPorPagina,
    p_centro_id,
    p_sexo,
    p_busqueda,
    p_orden,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaListadoCensoRed[];
}

/** Todos los registros que coinciden con filtros (p. ej. exportación). */
export async function obtenerListadoCensoRedFiltrado(
  filtros: FiltrosListadoCensoRed = {},
  onProgreso?: (cargados: number, total: number) => void,
): Promise<RegistroCensoRed[]> {
  const totalEsperado = await contarListadoCensoRed(filtros);
  const acumulado: RegistroCensoRed[] = [];
  let pagina = 0;

  for (;;) {
    const bloque = await obtenerListadoCensoRedPaginado(
      filtros,
      pagina,
      LIMITE_BLOQUE_EXPORTACION_CENSO_RED,
    );
    acumulado.push(...bloque);
    onProgreso?.(acumulado.length, totalEsperado);
    if (bloque.length < LIMITE_BLOQUE_EXPORTACION_CENSO_RED) break;
    pagina += 1;
  }

  return acumulado;
}

/** @deprecated Usar obtenerListadoCensoRedPaginado o obtenerListadoCensoRedFiltrado. */
export async function obtenerListadoCensoRed(): Promise<RegistroCensoRed[]> {
  return obtenerListadoCensoRedFiltrado();
}
