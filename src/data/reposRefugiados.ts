// Repos de escritura para registro nominal de damnificados.

import {
  agregarNombresApellidos,
  normalizarAlojamiento,
  normalizarCedula,
  normalizarContacto,
  normalizarDocumentacion,
  normalizarEstatusVivienda,
  normalizarFamiliaCentro,
  normalizarFamiliaresReferencia,
  normalizarFamiliaresSeparados,
  normalizarHabilidades,
  normalizarRefugiado,
  normalizarResidenciaAfectada,
  normalizarSalud,
  normalizarSeguimiento,
  normalizarTallas,
  normalizarVulnerabilidadesRefugiado,
  type AlojamientoRefugiado,
  type ContactoRefugiado,
  type DocumentacionRefugiado,
  type EstatusVivienda,
  type FamiliarReferencia,
  type FamiliarSeparado,
  type FamiliaCentro,
  type HabilidadesRefugiado,
  type Refugiado,
  type ResidenciaAfectada,
  type SaludRefugiado,
  type SeguimientoAlojamiento,
  type SexoRefugiado,
  type TallasRefugiado,
  type TipoDoc,
  type TipoTenencia,
  type VulnerabilidadesRefugiado,
} from "../domain/refugiados";
import {
  normalizarBeneficio,
  normalizarBeneficioFamiliar,
  normalizarItemKit,
  normalizarTipoBeneficioFamiliar,
  normalizarTipoBeneficio,
  type BeneficioOtorgado,
  type BeneficioFamiliar,
  type ItemKit,
  type TipoBeneficioFamiliar,
  type TipoBeneficio,
} from "../domain/beneficios";
import { esFalloDeRed, MENSAJE_SIN_CONEXION } from "@/lib/errorRed";
import { normalizarGeom } from "./normalizarGeom";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";
import { registrarHistorial } from "./historial";

function errorRepos(contexto: string, message: string): Error {
  console.warn(`[reposRefugiados] ${contexto}:`, message);
  if (esFalloDeRed({ message })) return new Error(MENSAJE_SIN_CONEXION);
  return new Error(`[reposRefugiados] ${contexto}: ${message}`);
}

export interface DatosPersonalesRefugiado {
  cedula?: string | null;
  tipo_doc?: TipoDoc | null;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  lugar_nacimiento?: string;
  fecha_nacimiento?: string | null;
  sexo?: SexoRefugiado | null;
  vulnerabilidades?: VulnerabilidadesRefugiado;
  codigo_ficha?: string | null;
  foto_url?: string | null;
  consentimiento_foto?: boolean;
  apodo?: string;
  nacionalidad?: string;
  contacto?: ContactoRefugiado;
  tallas?: TallasRefugiado;
}

function filaRefugiadoDesdeDatos(datos: DatosPersonalesRefugiado, now: number) {
  let cedula: string | null = null;
  let cedula_norm: string | null = null;
  let tipo_doc: TipoDoc | null = datos.tipo_doc ?? null;

  if (datos.cedula) {
    const norm = normalizarCedula(datos.cedula, datos.tipo_doc ?? "V");
    cedula = norm.cedula;
    cedula_norm = norm.cedula_norm;
    tipo_doc = norm.tipo_doc;
  }

  const primer_nombre = datos.primer_nombre.trim();
  const segundo_nombre = (datos.segundo_nombre ?? "").trim();
  const primer_apellido = (datos.primer_apellido ?? "").trim();
  const segundo_apellido = (datos.segundo_apellido ?? "").trim();
  const { nombres, apellidos } = agregarNombresApellidos({
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    nombres: "",
    apellidos: "",
  });

  return {
    cedula,
    tipo_doc,
    cedula_norm,
    nombres,
    apellidos,
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    lugar_nacimiento: (datos.lugar_nacimiento ?? "").trim(),
    fecha_nacimiento: datos.fecha_nacimiento ?? null,
    sexo: datos.sexo ?? null,
    vulnerabilidades: normalizarVulnerabilidadesRefugiado(datos.vulnerabilidades),
    codigo_ficha: datos.codigo_ficha ?? null,
    foto_url: datos.foto_url ?? null,
    consentimiento_foto: Boolean(datos.consentimiento_foto),
    consentimiento_foto_ts: datos.consentimiento_foto ? now : null,
    apodo: (datos.apodo ?? "").trim(),
    nacionalidad: (datos.nacionalidad ?? "Venezolana").trim(),
    contacto: normalizarContacto(datos.contacto),
    tallas: normalizarTallas(datos.tallas),
    updated_at: now,
    updated_by: usuarioActual(),
  };
}

/** Genera código de ficha vía RPC y lo asigna al refugiado. */
export async function asignarCodigoFicha(refugiadoId: string, centroId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generar_codigo_ficha", { p_centro_id: centroId });
  if (error) throw new Error(`[reposRefugiados] generar_codigo_ficha: ${error.message}`);
  const codigo = data as string;
  const now = Date.now();
  const { error: updErr } = await supabase
    .from("refugiados")
    .update({ codigo_ficha: codigo, updated_at: now, updated_by: usuarioActual() })
    .eq("id", refugiadoId);
  if (updErr) throw new Error(`[reposRefugiados] asignar codigo: ${updErr.message}`);
  return codigo;
}

/** Busca una persona por cédula normalizada en toda la red. */
export async function buscarRefugiadoPorCedula(cedulaNorm: string): Promise<Refugiado | null> {
  const norm = cedulaNorm.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!norm) return null;
  const { data, error } = await supabase
    .from("refugiados")
    .select("*")
    .eq("cedula_norm", norm)
    .maybeSingle();
  if (error) {
    throw new Error(`[reposRefugiados] buscar cédula: ${error.message}`);
  }
  if (!data) return null;
  return normalizarRefugiado(data as Refugiado);
}

function terminoBusquedaPostgrest(raw: string): string {
  return raw.trim().replace(/[%(),]/g, " ").replace(/\s+/g, " ");
}

/** Busca personas por cédula, código de ficha, nombres o apellidos. */
export async function buscarRefugiados(texto: string, limite = 12): Promise<Refugiado[]> {
  const termino = terminoBusquedaPostgrest(texto);
  const digitos = texto.replace(/\D/g, "");
  const documento = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (termino.length < 2 && digitos.length < 3 && documento.length < 3) return [];

  const filtros = [
    termino.length >= 2 ? `codigo_ficha.ilike.%${termino}%` : null,
    termino.length >= 2 ? `nombres.ilike.%${termino}%` : null,
    termino.length >= 2 ? `apellidos.ilike.%${termino}%` : null,
    termino.length >= 2 ? `primer_nombre.ilike.%${termino}%` : null,
    termino.length >= 2 ? `segundo_nombre.ilike.%${termino}%` : null,
    termino.length >= 2 ? `primer_apellido.ilike.%${termino}%` : null,
    termino.length >= 2 ? `segundo_apellido.ilike.%${termino}%` : null,
    digitos.length >= 3 ? `cedula_norm.ilike.%${digitos}%` : null,
    digitos.length >= 3 ? `cedula.ilike.%${digitos}%` : null,
    documento.length >= 3 && documento !== digitos ? `cedula_norm.ilike.%${documento}%` : null,
    documento.length >= 3 && documento !== digitos ? `cedula.ilike.%${documento}%` : null,
  ].filter((f): f is string => Boolean(f));

  const { data, error } = await supabase
    .from("refugiados")
    .select("*")
    .or(filtros.join(","))
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`[reposRefugiados] buscar refugiados: ${error.message}`);
  return ((data ?? []) as Refugiado[]).map(normalizarRefugiado);
}

/** Crea identidad de persona nueva. Devuelve el id generado. */
export async function crearRefugiado(
  datos: DatosPersonalesRefugiado,
  centroId?: string,
): Promise<string> {
  const now = Date.now();
  const fila = filaRefugiadoDesdeDatos(datos, now);

  const { data, error } = await supabase.from("refugiados").insert(fila).select("id").single();
  if (error) {
    throw new Error(`[reposRefugiados] insert refugiados: ${error.message}`);
  }
  const id = (data as { id: string }).id;
  if (centroId && !fila.codigo_ficha) {
    try {
      await asignarCodigoFicha(id, centroId);
    } catch (e) {
      console.warn("[reposRefugiados] codigo_ficha:", e);
    }
  }
  registrarHistorial("registrar_refugiado", "refugiado", id, {
    cedula_norm: fila.cedula_norm,
    nombres: fila.nombres,
  });
  return id;
}

export interface ResultadoUpsertRefugiado {
  id: string;
  creado: boolean;
}

/**
 * Encuentra o crea la identidad de una persona por cédula en una sola
 * llamada atómica (RPC `SECURITY DEFINER`). La RLS de `refugiados` oculta a
 * supervisor/operador cualquier persona que no crearon ellos mismos ni está
 * alojada en su propio centro (blindaje_lectura_refugiados); un buscar+crear
 * hecho en el cliente choca con `refugiados_cedula_norm_uq` en cuanto la
 * persona ya existe pero es invisible para esa sesión. La RPC resuelve el
 * find-or-create del lado del servidor, sin ese punto ciego.
 */
export async function upsertRefugiadoIdentidad(
  datos: DatosPersonalesRefugiado,
  centroId?: string,
): Promise<ResultadoUpsertRefugiado> {
  let cedula: string | null = null;
  let cedula_norm: string | null = null;
  let tipo_doc: TipoDoc | null = datos.tipo_doc ?? null;
  if (datos.cedula) {
    const norm = normalizarCedula(datos.cedula, datos.tipo_doc ?? "V");
    cedula = norm.cedula;
    cedula_norm = norm.cedula_norm;
    tipo_doc = norm.tipo_doc;
  }
  const { data, error } = await supabase.rpc("upsert_refugiado_identidad", {
    p_cedula: cedula,
    p_tipo_doc: tipo_doc,
    p_cedula_norm: cedula_norm,
    p_primer_nombre: datos.primer_nombre.trim(),
    p_segundo_nombre: (datos.segundo_nombre ?? "").trim(),
    p_primer_apellido: (datos.primer_apellido ?? "").trim(),
    p_segundo_apellido: (datos.segundo_apellido ?? "").trim(),
    p_fecha_nacimiento: datos.fecha_nacimiento ?? null,
    p_sexo: datos.sexo ?? null,
  });
  if (error) {
    throw errorRepos("upsert identidad", error.message);
  }
  const resultado = data as { id: string; creado: boolean };
  if (resultado.creado && centroId) {
    try {
      await asignarCodigoFicha(resultado.id, centroId);
    } catch (e) {
      console.warn("[reposRefugiados] codigo_ficha:", e);
    }
  }
  registrarHistorial(
    resultado.creado ? "registrar_refugiado" : "editar_refugiado",
    "refugiado",
    resultado.id,
    { cedula_norm },
  );
  return resultado;
}

export interface OtroCentroActivo {
  centroId: string;
  /** Fecha (AAAA-MM-DD) de ingreso al otro campamento. */
  fechaIngreso: string | null;
  /** Epoch ms de cuándo se creó ese alojamiento (fecha + hora exacta). */
  creadaTs: number | null;
  esJefe: boolean;
  /** Username de quién lo registró en ese otro campamento. */
  registradoPor: string | null;
}

export interface EstadoNominalCedulaRed {
  registrado: boolean;
  refugiadoId: string | null;
  enEsteCentro: boolean;
  esJefeAqui: boolean;
  familiaAqui: string | null;
  otrosCentros: OtroCentroActivo[];
}

/**
 * Estado de una cédula en toda la red (RPC `SECURITY DEFINER`, bypassa la RLS
 * a propósito): solo expone `centro_id`s y flags, nunca datos personales, para
 * que el aviso "ya activo en otro campamento" y el bloqueo de duplicados
 * funcionen sin importar en qué centro esté alojada la persona ni quién la
 * creó. Ver `upsertRefugiadoIdentidad` para el porqué.
 */
export async function estadoNominalCedulaRed(
  cedulaNorm: string,
  centroId: string,
): Promise<EstadoNominalCedulaRed> {
  const { data, error } = await supabase.rpc("estado_nominal_cedula", {
    p_cedula_norm: cedulaNorm,
    p_centro_id: centroId,
  });
  if (error) {
    throw new Error(`[reposRefugiados] estado nominal: ${error.message}`);
  }
  const r = data as {
    registrado: boolean;
    refugiado_id: string | null;
    en_este_centro: boolean;
    es_jefe_aqui: boolean;
    familia_aqui: string | null;
    otros_centros: {
      centro_id: string;
      fecha_ingreso: string | null;
      creada_ts: number | null;
      es_jefe: boolean;
      registrado_por: string | null;
    }[];
  };
  return {
    registrado: r.registrado,
    refugiadoId: r.refugiado_id,
    enEsteCentro: r.en_este_centro,
    esJefeAqui: r.es_jefe_aqui,
    familiaAqui: r.familia_aqui,
    otrosCentros: (r.otros_centros ?? []).map((o) => ({
      centroId: o.centro_id,
      fechaIngreso: o.fecha_ingreso,
      creadaTs: o.creada_ts,
      esJefe: o.es_jefe,
      registradoPor: o.registrado_por,
    })),
  };
}

/** Actualiza datos personales de una persona. */
export async function actualizarRefugiado(
  id: string,
  cambios: Partial<DatosPersonalesRefugiado>,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };

  if (cambios.primer_nombre !== undefined) fila.primer_nombre = cambios.primer_nombre.trim();
  if (cambios.segundo_nombre !== undefined) fila.segundo_nombre = cambios.segundo_nombre.trim();
  if (cambios.primer_apellido !== undefined) fila.primer_apellido = cambios.primer_apellido.trim();
  if (cambios.segundo_apellido !== undefined) fila.segundo_apellido = cambios.segundo_apellido.trim();
  if (cambios.lugar_nacimiento !== undefined) fila.lugar_nacimiento = cambios.lugar_nacimiento.trim();
  if (cambios.fecha_nacimiento !== undefined) fila.fecha_nacimiento = cambios.fecha_nacimiento;
  if (cambios.sexo !== undefined) fila.sexo = cambios.sexo;
  if (cambios.vulnerabilidades !== undefined) {
    fila.vulnerabilidades = normalizarVulnerabilidadesRefugiado(cambios.vulnerabilidades);
  }

  if (
    cambios.primer_nombre !== undefined ||
    cambios.segundo_nombre !== undefined ||
    cambios.primer_apellido !== undefined ||
    cambios.segundo_apellido !== undefined
  ) {
    const { nombres, apellidos } = agregarNombresApellidos({
      primer_nombre: (fila.primer_nombre as string) ?? "",
      segundo_nombre: (fila.segundo_nombre as string) ?? "",
      primer_apellido: (fila.primer_apellido as string) ?? "",
      segundo_apellido: (fila.segundo_apellido as string) ?? "",
      nombres: "",
      apellidos: "",
    });
    fila.nombres = nombres;
    fila.apellidos = apellidos;
  }

  if (cambios.cedula !== undefined) {
    if (cambios.cedula) {
      const norm = normalizarCedula(cambios.cedula, cambios.tipo_doc ?? "V");
      fila.cedula = norm.cedula;
      fila.cedula_norm = norm.cedula_norm;
      fila.tipo_doc = norm.tipo_doc;
    } else {
      fila.cedula = null;
      fila.cedula_norm = null;
      fila.tipo_doc = null;
    }
  } else if (cambios.tipo_doc !== undefined) {
    fila.tipo_doc = cambios.tipo_doc;
  }

  const { error } = await supabase.from("refugiados").update(fila).eq("id", id);
  if (error) {
    throw new Error(`[reposRefugiados] update refugiados: ${error.message}`);
  }
  registrarHistorial("editar_refugiado", "refugiado", id, cambios as Record<string, unknown>);
}

export async function actualizarContacto(id: string, contacto: ContactoRefugiado): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("refugiados")
    .update({
      contacto: normalizarContacto(contacto),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposRefugiados] update contacto: ${error.message}`);
  registrarHistorial("editar_contacto", "refugiado", id, { contacto });
}

export async function actualizarTallas(id: string, tallas: TallasRefugiado): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("refugiados")
    .update({
      tallas: normalizarTallas(tallas),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposRefugiados] update tallas: ${error.message}`);
  registrarHistorial("editar_tallas", "refugiado", id, { tallas });
}

export async function actualizarConsentimientoFoto(
  id: string,
  consentimiento: boolean,
  fotoUrl?: string | null,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    consentimiento_foto: consentimiento,
    consentimiento_foto_ts: consentimiento ? now : null,
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (fotoUrl !== undefined) fila.foto_url = fotoUrl;
  const { error } = await supabase.from("refugiados").update(fila).eq("id", id);
  if (error) throw new Error(`[reposRefugiados] update consentimiento foto: ${error.message}`);
}

export async function actualizarSalud(id: string, salud: SaludRefugiado): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("refugiados")
    .update({
      salud: normalizarSalud(salud),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposRefugiados] update salud: ${error.message}`);
  registrarHistorial("editar_salud", "refugiado", id, {});
}

export async function actualizarHabilidades(
  id: string,
  habilidades: HabilidadesRefugiado,
): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("refugiados")
    .update({
      habilidades: normalizarHabilidades(habilidades),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposRefugiados] update habilidades: ${error.message}`);
  registrarHistorial("editar_habilidades", "refugiado", id, {});
}

export async function actualizarDocumentacion(
  id: string,
  documentacion: DocumentacionRefugiado,
): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("refugiados")
    .update({
      documentacion: normalizarDocumentacion(documentacion),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposRefugiados] update documentacion: ${error.message}`);
  registrarHistorial("editar_documentacion", "refugiado", id, {});
}

export async function guardarFamiliaresReferencia(
  familiaId: string,
  referencia: FamiliarReferencia[],
  separados: FamiliarSeparado[],
): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("familias_centro")
    .update({
      familiares_referencia: normalizarFamiliaresReferencia(referencia),
      familiares_separados: normalizarFamiliaresSeparados(separados),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", familiaId);
  if (error) throw new Error(`[reposRefugiados] update familiares referencia: ${error.message}`);
  registrarHistorial("editar_familiares_referencia", "familia", familiaId, {});
}

export async function actualizarFotoFamiliar(
  familiaId: string,
  fotoUrl: string | null,
  consentimiento: boolean,
): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("familias_centro")
    .update({
      foto_familiar_url: fotoUrl,
      consentimiento_foto_familiar: consentimiento,
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", familiaId);
  if (error) throw new Error(`[reposRefugiados] update foto familiar: ${error.message}`);
}

/** Guarda el conteo rápido de damnificación de un hogar (miembros esperados + pérdidas). */
export async function actualizarDamnificacionFamilia(
  familiaId: string,
  datos: {
    miembros_damnificados_declarados?: number | null;
    fallecidos_confirmados?: number;
    desaparecidos?: number;
  },
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = { updated_at: now, updated_by: usuarioActual() };
  if (datos.miembros_damnificados_declarados !== undefined) {
    fila.miembros_damnificados_declarados = datos.miembros_damnificados_declarados;
  }
  if (datos.fallecidos_confirmados !== undefined) {
    fila.fallecidos_confirmados = Math.max(0, datos.fallecidos_confirmados);
  }
  if (datos.desaparecidos !== undefined) {
    fila.desaparecidos = Math.max(0, datos.desaparecidos);
  }
  const { error } = await supabase.from("familias_centro").update(fila).eq("id", familiaId);
  if (error) throw new Error(`[reposRefugiados] update damnificacion: ${error.message}`);
  registrarHistorial("editar_damnificacion", "familia", familiaId, {
    fallecidos_confirmados: datos.fallecidos_confirmados,
    desaparecidos: datos.desaparecidos,
  });
}

export async function actualizarSeguimiento(
  alojamientoId: string,
  seguimiento: SeguimientoAlojamiento,
): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("alojamientos_refugiados")
    .update({
      seguimiento: normalizarSeguimiento(seguimiento),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", alojamientoId);
  if (error) throw new Error(`[reposRefugiados] update seguimiento: ${error.message}`);
  registrarHistorial("editar_seguimiento", "alojamiento", alojamientoId, {});
}

/** Crea un grupo familiar en un campamento. */
export async function crearFamilia(datos: {
  centro_id: string;
  nombre?: string;
  notas?: string;
}): Promise<string> {
  const now = Date.now();
  const fila = {
    centro_id: datos.centro_id,
    nombre: (datos.nombre ?? "").trim(),
    notas: (datos.notas ?? "").trim(),
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase.from("familias_centro").insert(fila).select("id").single();
  if (error) {
    throw new Error(`[reposRefugiados] insert familias_centro: ${error.message}`);
  }
  return (data as { id: string }).id;
}

/** Máximo de líderes de familia activos por hogar (ver supabase/familia_lideres.sql). */
const MAX_LIDERES_FAMILIA = 2;

async function contarLideresActivosFamilia(
  familiaId: string,
  excluirAlojamientoId?: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("alojamientos_refugiados")
    .select("id")
    .eq("familia_id", familiaId)
    .neq("estado", "egresado")
    .eq("es_jefe_familia", true);
  if (error) throw new Error(`[reposRefugiados] contar líderes familia: ${error.message}`);
  return ((data ?? []) as { id: string }[]).filter((a) => a.id !== excluirAlojamientoId).length;
}

async function validarReglasFamilia(datos: {
  familia_id?: string | null;
  es_jefe_familia?: boolean;
  parentesco_jefe?: string;
  alojamiento_id?: string;
}): Promise<void> {
  if (!datos.familia_id) return;
  if (datos.es_jefe_familia) {
    const activos = await contarLideresActivosFamilia(datos.familia_id, datos.alojamiento_id);
    if (activos >= MAX_LIDERES_FAMILIA) {
      throw new Error(
        `Este hogar ya tiene ${MAX_LIDERES_FAMILIA} líderes activos. Ajusta uno existente antes de asignar otro.`,
      );
    }
    return;
  }
  if (!(datos.parentesco_jefe ?? "").trim()) {
    throw new Error("El parentesco con el jefe de familia es obligatorio para miembros no jefes.");
  }
}

/** Registra la presencia de una persona en un refugio. */
export async function registrarAlojamiento(datos: {
  refugiado_id: string;
  centro_id: string;
  familia_id?: string | null;
  fecha_ingreso?: string;
  itinerante?: boolean;
  es_jefe_familia?: boolean;
  parentesco_jefe?: string;
}): Promise<string> {
  await validarReglasFamilia({
    familia_id: datos.familia_id,
    es_jefe_familia: Boolean(datos.es_jefe_familia),
    parentesco_jefe: datos.parentesco_jefe,
  });

  const ts = Date.now();
  const fila = {
    refugiado_id: datos.refugiado_id,
    centro_id: datos.centro_id,
    familia_id: datos.familia_id ?? null,
    fecha_ingreso: datos.fecha_ingreso ?? claveDia(ts),
    fecha_egreso: null,
    estado: "activo",
    itinerante: Boolean(datos.itinerante),
    es_jefe_familia: Boolean(datos.es_jefe_familia),
    parentesco_jefe: (datos.parentesco_jefe ?? "").trim(),
    creada_ts: ts,
    creada_por: usuarioActual(),
    updated_at: ts,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("alojamientos_refugiados")
    .insert(fila)
    .select("id")
    .single();
  if (error) {
    throw new Error(`[reposRefugiados] insert alojamientos: ${error.message}`);
  }
  const id = (data as { id: string }).id;
  registrarHistorial("registrar_refugiado", "alojamiento", id, {
    refugiado_id: datos.refugiado_id,
    centro_id: datos.centro_id,
  });
  return id;
}

/** Asocia una persona existente al hogar del campamento, reutilizando alojamiento activo si ya existe. */
export async function asociarRefugiadoAFamilia(datos: {
  refugiado_id: string;
  centro_id: string;
  familia_id: string;
  fecha_ingreso?: string;
  es_jefe_familia?: boolean;
  parentesco_jefe?: string;
}): Promise<string> {
  const activos = await listarAlojamientosActivosRefugiado(datos.refugiado_id);
  const activoEnCentro = activos.find((a) => a.centro_id === datos.centro_id);

  await validarReglasFamilia({
    familia_id: datos.familia_id,
    es_jefe_familia: Boolean(datos.es_jefe_familia),
    parentesco_jefe: datos.parentesco_jefe,
    alojamiento_id: activoEnCentro?.id,
  });

  if (activoEnCentro) {
    await actualizarAlojamiento(activoEnCentro.id, {
      familia_id: datos.familia_id,
      es_jefe_familia: Boolean(datos.es_jefe_familia),
      parentesco_jefe: datos.es_jefe_familia ? "" : datos.parentesco_jefe,
      fecha_ingreso: datos.fecha_ingreso ?? activoEnCentro.fecha_ingreso,
    });
    return activoEnCentro.id;
  }

  return registrarAlojamiento({
    refugiado_id: datos.refugiado_id,
    centro_id: datos.centro_id,
    familia_id: datos.familia_id,
    fecha_ingreso: datos.fecha_ingreso,
    es_jefe_familia: Boolean(datos.es_jefe_familia),
    parentesco_jefe: datos.es_jefe_familia ? "" : datos.parentesco_jefe,
  });
}

/** Actualiza campos de un alojamiento (itinerante, familia, jefe). */
export async function actualizarAlojamiento(
  id: string,
  cambios: Partial<{
    familia_id: string | null;
    itinerante: boolean;
    es_jefe_familia: boolean;
    parentesco_jefe: string;
    fecha_ingreso: string;
    tipo_alojamiento: string;
    plaza_modulo: string;
  }>,
): Promise<void> {
  if (
    cambios.familia_id !== undefined ||
    cambios.es_jefe_familia !== undefined ||
    cambios.parentesco_jefe !== undefined
  ) {
    const { data: actual, error: actualErr } = await supabase
      .from("alojamientos_refugiados")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (actualErr) {
      throw new Error(`[reposRefugiados] leer alojamiento: ${actualErr.message}`);
    }
    if (actual) {
      const aloj = normalizarAlojamiento(actual as AlojamientoRefugiado);
      await validarReglasFamilia({
        familia_id: cambios.familia_id !== undefined ? cambios.familia_id : aloj.familia_id,
        es_jefe_familia:
          cambios.es_jefe_familia !== undefined ? cambios.es_jefe_familia : aloj.es_jefe_familia,
        parentesco_jefe:
          cambios.parentesco_jefe !== undefined ? cambios.parentesco_jefe : aloj.parentesco_jefe,
        alojamiento_id: id,
      });
    }
  }

  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.familia_id !== undefined) fila.familia_id = cambios.familia_id;
  if (cambios.itinerante !== undefined) fila.itinerante = cambios.itinerante;
  if (cambios.es_jefe_familia !== undefined) fila.es_jefe_familia = cambios.es_jefe_familia;
  if (cambios.parentesco_jefe !== undefined) fila.parentesco_jefe = cambios.parentesco_jefe.trim();
  if (cambios.fecha_ingreso !== undefined) fila.fecha_ingreso = cambios.fecha_ingreso;
  if (cambios.tipo_alojamiento !== undefined) fila.tipo_alojamiento = cambios.tipo_alojamiento.trim();
  if (cambios.plaza_modulo !== undefined) fila.plaza_modulo = cambios.plaza_modulo.trim();

  const { error } = await supabase.from("alojamientos_refugiados").update(fila).eq("id", id);
  if (error) {
    throw new Error(`[reposRefugiados] update alojamiento: ${error.message}`);
  }
  registrarHistorial("editar_refugiado", "alojamiento", id, cambios as Record<string, unknown>);
}

/** Marca egreso con fecha, motivo y destino. */
export async function registrarEgreso(
  id: string,
  opts?: { fechaEgreso?: string; motivo?: string; destino?: string },
): Promise<void> {
  const now = Date.now();
  const fila = {
    estado: "egresado",
    fecha_egreso: opts?.fechaEgreso ?? claveDia(now),
    motivo_egreso: (opts?.motivo ?? "").trim(),
    destino_egreso: (opts?.destino ?? "").trim(),
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { error } = await supabase.from("alojamientos_refugiados").update(fila).eq("id", id);
  if (error) {
    throw new Error(`[reposRefugiados] egreso alojamiento: ${error.message}`);
  }
  registrarHistorial("egreso_refugiado", "alojamiento", id, {
    fecha_egreso: fila.fecha_egreso,
    motivo: fila.motivo_egreso,
    destino: fila.destino_egreso,
  });
}

/** Guarda o actualiza la residencia afectada de una familia. */
export async function guardarResidenciaAfectada(datos: {
  familia_id: string;
  centro_id: string;
  pais?: string;
  estado_federativo?: string;
  municipio?: string;
  parroquia?: string;
  sector?: string;
  direccion?: string;
  referencia?: string;
  estatus_vivienda?: EstatusVivienda;
  lng?: number | null;
  lat?: number | null;
  fotos?: string[];
  observaciones?: string;
  tipo_tenencia?: TipoTenencia;
  perdio_todo?: boolean;
  perdidas_materiales?: string[];
}): Promise<string> {
  const estatus = normalizarEstatusVivienda(datos.estatus_vivienda);
  const { data, error } = await supabase.rpc("upsert_residencia_afectada", {
    p_familia_id: datos.familia_id,
    p_centro_id: datos.centro_id,
    p_pais: (datos.pais ?? "Venezuela").trim() || "Venezuela",
    p_estado_federativo: (datos.estado_federativo ?? "").trim(),
    p_municipio: (datos.municipio ?? "").trim(),
    p_parroquia: (datos.parroquia ?? "").trim(),
    p_sector: (datos.sector ?? "").trim(),
    p_direccion: (datos.direccion ?? "").trim(),
    p_referencia: (datos.referencia ?? "").trim(),
    p_estatus_vivienda: estatus,
    p_lng: datos.lng ?? null,
    p_lat: datos.lat ?? null,
    p_fotos: datos.fotos ?? [],
    p_observaciones: (datos.observaciones ?? "").trim(),
    p_tipo_tenencia: datos.tipo_tenencia ?? "",
    p_perdio_todo: Boolean(datos.perdio_todo),
    p_perdidas_materiales: datos.perdidas_materiales ?? [],
  });
  if (error) {
    throw new Error(`[reposRefugiados] upsert residencia: ${error.message}`);
  }
  const id = data as string;
  registrarHistorial("editar_residencia", "residencia", id, {
    familia_id: datos.familia_id,
    estatus_vivienda: estatus,
  });
  return id;
}

/** Obtiene la residencia afectada de una familia. */
export async function obtenerResidenciaFamilia(
  familiaId: string,
): Promise<ResidenciaAfectada | null> {
  const { data, error } = await supabase
    .from("residencias_afectadas")
    .select("*")
    .eq("familia_id", familiaId)
    .maybeSingle();
  if (error) {
    throw new Error(`[reposRefugiados] select residencia: ${error.message}`);
  }
  if (!data) return null;
  const raw = data as ResidenciaAfectada & { geom?: unknown };
  return normalizarResidenciaAfectada(raw, normalizarGeom(raw.geom));
}

/** Lista miembros activos de una familia en un campamento. */
export async function listarMiembrosFamilia(
  familiaId: string,
  centroId?: string,
): Promise<AlojamientoRefugiado[]> {
  let q = supabase.from("alojamientos_refugiados").select("*").eq("familia_id", familiaId);
  if (centroId) q = q.eq("centro_id", centroId);
  const { data, error } = await q.order("fecha_ingreso");
  if (error) {
    throw new Error(`[reposRefugiados] list miembros familia: ${error.message}`);
  }
  return ((data ?? []) as AlojamientoRefugiado[]).map(normalizarAlojamiento);
}

/** Otorga un ítem del kit mínimo a una persona. */
export async function otorgarItemKit(datos: {
  refugiado_id: string;
  centro_id: string;
  item_kit: ItemKit;
  talla?: string;
  cantidad?: number;
  fecha?: string;
  observacion?: string;
}): Promise<string> {
  const now = Date.now();
  const item = normalizarItemKit(datos.item_kit);
  const fila = {
    refugiado_id: datos.refugiado_id,
    centro_id: datos.centro_id,
    tipo: "ropa" as TipoBeneficio,
    item_kit: item,
    talla: (datos.talla ?? "").trim(),
    cantidad: Math.max(1, datos.cantidad ?? 1),
    fecha: datos.fecha ?? claveDia(now),
    observacion: (datos.observacion ?? "").trim(),
    otorgado_por: usuarioActual(),
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("beneficios_otorgados")
    .insert(fila)
    .select("id")
    .single();
  if (error) throw new Error(`[reposRefugiados] insert item_kit: ${error.message}`);
  const id = (data as { id: string }).id;
  registrarHistorial("otorgar_item_kit", "beneficio", id, {
    refugiado_id: datos.refugiado_id,
    item_kit: item,
    talla: fila.talla,
    centro_id: datos.centro_id,
  });
  return id;
}

/** Otorga un beneficio/dotación a una persona. */
export async function otorgarBeneficio(datos: {
  refugiado_id: string;
  centro_id: string;
  tipo: TipoBeneficio;
  item_kit?: ItemKit | null;
  talla?: string;
  cantidad?: number;
  fecha?: string;
  observacion?: string;
}): Promise<string> {
  const now = Date.now();
  const fila = {
    refugiado_id: datos.refugiado_id,
    centro_id: datos.centro_id,
    tipo: normalizarTipoBeneficio(datos.tipo),
    item_kit: datos.item_kit ? normalizarItemKit(datos.item_kit) : null,
    talla: (datos.talla ?? "").trim(),
    cantidad: Math.max(1, datos.cantidad ?? 1),
    fecha: datos.fecha ?? claveDia(now),
    observacion: (datos.observacion ?? "").trim(),
    otorgado_por: usuarioActual(),
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("beneficios_otorgados")
    .insert(fila)
    .select("id")
    .single();
  if (error) {
    throw new Error(`[reposRefugiados] insert beneficios: ${error.message}`);
  }
  const id = (data as { id: string }).id;
  registrarHistorial("otorgar_beneficio", "beneficio", id, {
    refugiado_id: datos.refugiado_id,
    tipo: fila.tipo,
    centro_id: datos.centro_id,
  });
  return id;
}

/** Anula una entrega registrada por error (DELETE físico; queda trazabilidad en historial). */
export async function eliminarBeneficio(beneficioId: string): Promise<void> {
  const { data: prev, error: errPrev } = await supabase
    .from("beneficios_otorgados")
    .select("*")
    .eq("id", beneficioId)
    .maybeSingle();
  if (errPrev) {
    throw new Error(`[reposRefugiados] leer beneficio: ${errPrev.message}`);
  }
  if (!prev) {
    throw new Error("Entrega no encontrada");
  }

  const { error } = await supabase.from("beneficios_otorgados").delete().eq("id", beneficioId);
  if (error) {
    throw new Error(`[reposRefugiados] eliminar beneficio: ${error.message}`);
  }

  const fila = prev as BeneficioOtorgado;
  registrarHistorial("eliminar_beneficio", "beneficio", beneficioId, {
    refugiado_id: fila.refugiado_id,
    centro_id: fila.centro_id,
    tipo: fila.tipo,
    item_kit: fila.item_kit,
    talla: fila.talla,
    cantidad: fila.cantidad,
    fecha: fila.fecha,
  });
}

/** Lista beneficios de una persona (histórico red-wide). */
export async function listarBeneficiosRefugiado(
  refugiadoId: string,
): Promise<BeneficioOtorgado[]> {
  const { data, error } = await supabase
    .from("beneficios_otorgados")
    .select("*")
    .eq("refugiado_id", refugiadoId)
    .order("fecha", { ascending: false });
  if (error) {
    throw new Error(`[reposRefugiados] list beneficios: ${error.message}`);
  }
  return ((data ?? []) as BeneficioOtorgado[]).map(normalizarBeneficio);
}

/** Lista apoyos entregados a un hogar. */
export async function listarBeneficiosFamiliares(familiaId: string): Promise<BeneficioFamiliar[]> {
  const { data, error } = await supabase
    .from("beneficios_familiares")
    .select("*")
    .eq("familia_id", familiaId)
    .order("fecha", { ascending: false });
  if (error) {
    throw new Error(`[reposRefugiados] list beneficios familiares: ${error.message}`);
  }
  return ((data ?? []) as BeneficioFamiliar[]).map(normalizarBeneficioFamiliar);
}

/** Registra un apoyo del hogar sin mezclarlo con dotaciones personales. */
export async function otorgarBeneficioFamiliar(datos: {
  familia_id: string;
  centro_id: string;
  tipo: TipoBeneficioFamiliar;
  cantidad?: number;
  fecha?: string;
  observacion?: string;
}): Promise<string> {
  const now = Date.now();
  const fila = {
    familia_id: datos.familia_id,
    centro_id: datos.centro_id,
    tipo: normalizarTipoBeneficioFamiliar(datos.tipo),
    cantidad: Math.max(1, datos.cantidad ?? 1),
    fecha: datos.fecha ?? claveDia(now),
    observacion: (datos.observacion ?? "").trim(),
    otorgado_por: usuarioActual(),
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("beneficios_familiares")
    .insert(fila)
    .select("id")
    .single();
  if (error) throw new Error(`[reposRefugiados] insert beneficio familiar: ${error.message}`);
  const id = (data as { id: string }).id;
  registrarHistorial("otorgar_beneficio_hogar", "familia", datos.familia_id, {
    beneficio_id: id,
    centro_id: datos.centro_id,
    tipo: fila.tipo,
    cantidad: fila.cantidad,
  });
  return id;
}

/** Anula un apoyo del hogar registrado por error. */
export async function eliminarBeneficioFamiliar(beneficioId: string): Promise<void> {
  const { data: prev, error: errPrev } = await supabase
    .from("beneficios_familiares")
    .select("*")
    .eq("id", beneficioId)
    .maybeSingle();
  if (errPrev) {
    throw new Error(`[reposRefugiados] leer beneficio familiar: ${errPrev.message}`);
  }
  if (!prev) throw new Error("Apoyo del hogar no encontrado");

  const { error } = await supabase.from("beneficios_familiares").delete().eq("id", beneficioId);
  if (error) throw new Error(`[reposRefugiados] eliminar beneficio familiar: ${error.message}`);

  const fila = normalizarBeneficioFamiliar(prev as BeneficioFamiliar);
  registrarHistorial("eliminar_beneficio_hogar", "familia", fila.familia_id, {
    beneficio_id: beneficioId,
    centro_id: fila.centro_id,
    tipo: fila.tipo,
    cantidad: fila.cantidad,
    fecha: fila.fecha,
  });
}

/** Alojamientos vigentes de una persona (todos los centros visibles por RLS). */
export async function listarAlojamientosActivosRefugiado(
  refugiadoId: string,
): Promise<AlojamientoRefugiado[]> {
  const { data, error } = await supabase
    .from("alojamientos_refugiados")
    .select("*")
    .eq("refugiado_id", refugiadoId)
    .neq("estado", "egresado");
  if (error) {
    throw new Error(`[reposRefugiados] list alojamientos activos: ${error.message}`);
  }
  return ((data ?? []) as AlojamientoRefugiado[]).map(normalizarAlojamiento);
}

/** Familias de un campamento. */
export async function listarFamiliasCentro(centroId: string): Promise<FamiliaCentro[]> {
  const { data, error } = await supabase
    .from("familias_centro")
    .select("*")
    .eq("centro_id", centroId)
    .order("nombre");
  if (error) {
    throw new Error(`[reposRefugiados] list familias: ${error.message}`);
  }
  return ((data ?? []) as FamiliaCentro[]).map(normalizarFamiliaCentro);
}

export { normalizarEstadoAlojamiento } from "../domain/refugiados";
