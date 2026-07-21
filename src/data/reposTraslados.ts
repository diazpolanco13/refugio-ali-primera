// Repos de traslados formales entre campamentos.

import {
  formatearCedula,
  nombreCompleto,
  type TipoDoc,
} from "../domain/refugiados";
import {
  normalizarTraslado,
  type CandidatoTrasladoNombre,
  type FiltrosTrasladoNombre,
  type HogarTrasladable,
  type InputEjecutarTraslado,
  type MiembroHogarTraslado,
  type PersonaTrasladoVista,
  type ResultadoTraslado,
  type Traslado,
  type TrasladoEnriquecido,
} from "../domain/traslados";
import { esFalloDeRed, MENSAJE_SIN_CONEXION } from "@/lib/errorRed";
import { supabase } from "./supabaseClient";

function errorRepos(contexto: string, message: string): Error {
  console.warn(`[reposTraslados] ${contexto}:`, message);
  if (esFalloDeRed({ message })) return new Error(MENSAJE_SIN_CONEXION);
  return new Error(`[reposTraslados] ${contexto}: ${message}`);
}

function normalizarMiembroHogar(raw: unknown): MiembroHogarTraslado {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    alojamiento_id: String(m.alojamiento_id ?? ""),
    refugiado_id: String(m.refugiado_id ?? ""),
    nombre: String(m.nombre ?? "Sin nombre"),
    cedula: m.cedula != null ? String(m.cedula) : null,
    tipo_doc: m.tipo_doc != null ? String(m.tipo_doc) : null,
    es_jefe_familia: Boolean(m.es_jefe_familia),
    parentesco_jefe: String(m.parentesco_jefe ?? ""),
    estado: String(m.estado ?? "activo"),
  };
}

function normalizarHogarTrasladable(raw: unknown): HogarTrasladable | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const miembrosRaw = Array.isArray(h.miembros) ? h.miembros : [];
  return {
    clave: String(h.clave ?? ""),
    familia_id: h.familia_id ? String(h.familia_id) : null,
    alojamiento_id: h.alojamiento_id ? String(h.alojamiento_id) : null,
    centro_id: String(h.centro_id ?? ""),
    centro_nombre: h.centro_nombre ? String(h.centro_nombre) : undefined,
    nombre_hogar: String(h.nombre_hogar ?? "Hogar"),
    referencia_alojamiento_id: h.referencia_alojamiento_id
      ? String(h.referencia_alojamiento_id)
      : null,
    miembros: miembrosRaw.map(normalizarMiembroHogar),
  };
}

function normalizarCandidatoNombre(raw: unknown): CandidatoTrasladoNombre {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    alojamiento_id: String(c.alojamiento_id ?? ""),
    refugiado_id: String(c.refugiado_id ?? ""),
    nombre: String(c.nombre ?? "Sin nombre"),
    cedula: c.cedula != null ? String(c.cedula) : null,
    tipo_doc: c.tipo_doc != null ? String(c.tipo_doc) : null,
    sexo: c.sexo != null ? String(c.sexo) : null,
    edad: c.edad != null && c.edad !== "" ? Number(c.edad) : null,
    centro_id: String(c.centro_id ?? ""),
    centro_nombre: String(c.centro_nombre ?? ""),
  };
}

/** Búsqueda exacta por cédula (botón explícito, sin debounce). */
export async function buscarTrasladoPorCedula(
  cedula: string,
  tipoDoc: TipoDoc = "V",
): Promise<HogarTrasladable | null> {
  const { data, error } = await supabase.rpc("buscar_trasladable_por_cedula", {
    p_cedula: cedula.trim(),
    p_tipo_doc: tipoDoc,
  });
  if (error) {
    throw errorRepos("buscar por cédula", error.message);
  }
  return normalizarHogarTrasladable(data);
}

/** Búsqueda por nombre/apellidos con filtros (máx. 20 en servidor). */
export async function buscarTrasladoPorNombre(
  filtros: FiltrosTrasladoNombre,
): Promise<CandidatoTrasladoNombre[]> {
  const { data, error } = await supabase.rpc("buscar_trasladables_por_nombre", {
    p_nombres: filtros.nombres?.trim() || null,
    p_apellidos: filtros.apellidos?.trim() || null,
    p_sexo: filtros.sexo || null,
    p_edad_min: filtros.edadMin ?? null,
    p_edad_max: filtros.edadMax ?? null,
    p_limite: 20,
  });
  if (error) {
    throw errorRepos("buscar por nombre", error.message);
  }
  const raw = (data ?? {}) as Record<string, unknown>;
  const lista = Array.isArray(raw.resultados) ? raw.resultados : [];
  return lista.map(normalizarCandidatoNombre);
}

/** Carga hogar completo tras elegir candidato de búsqueda por nombre. */
export async function obtenerHogarTrasladable(
  alojamientoId: string,
  referenciaAlojamientoId?: string | null,
): Promise<HogarTrasladable | null> {
  const { data, error } = await supabase.rpc("obtener_hogar_trasladable", {
    p_alojamiento_id: alojamientoId,
    p_referencia_alojamiento_id: referenciaAlojamientoId ?? alojamientoId,
  });
  if (error) {
    throw errorRepos("obtener hogar", error.message);
  }
  return normalizarHogarTrasladable(data);
}

async function resolverPersonasTraslado(
  traslados: Traslado[],
): Promise<Map<string, PersonaTrasladoVista>> {
  const ids = [
    ...new Set(
      traslados.flatMap((t) =>
        t.miembros.map((m) => m.refugiado_id).filter(Boolean),
      ),
    ),
  ];
  const mapa = new Map<string, PersonaTrasladoVista>();
  if (ids.length === 0) return mapa;

  const { data, error } = await supabase
    .from("refugiados")
    .select(
      "id, nombres, apellidos, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cedula, tipo_doc",
    )
    .in("id", ids);
  if (error) {
    console.warn("[reposTraslados] resolver personas:", error.message);
    return mapa;
  }

  for (const raw of data ?? []) {
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!id) continue;
    mapa.set(id, {
      refugiado_id: id,
      nombre: nombreCompleto({
        nombres: String(r.nombres ?? ""),
        apellidos: String(r.apellidos ?? ""),
        primer_nombre: String(r.primer_nombre ?? ""),
        segundo_nombre: String(r.segundo_nombre ?? ""),
        primer_apellido: String(r.primer_apellido ?? ""),
        segundo_apellido: String(r.segundo_apellido ?? ""),
      }),
      cedula: r.cedula != null ? String(r.cedula) : null,
      tipo_doc: r.tipo_doc != null ? String(r.tipo_doc) : null,
      es_jefe_familia: false,
    });
  }
  return mapa;
}

function enriquecerTraslados(
  traslados: Traslado[],
  personas: Map<string, PersonaTrasladoVista>,
): TrasladoEnriquecido[] {
  return traslados.map((t) => ({
    ...t,
    personas: t.miembros.map((m) => {
      const base = personas.get(m.refugiado_id);
      return {
        refugiado_id: m.refugiado_id,
        nombre: base?.nombre ?? "Persona",
        cedula: base?.cedula ?? null,
        tipo_doc: base?.tipo_doc ?? null,
        es_jefe_familia: m.es_jefe_familia,
      };
    }),
  }));
}

/** Historial de traslados (más recientes primero), con nombres de miembros. */
export async function listarTraslados(opts?: {
  centroId?: string;
  limite?: number;
}): Promise<TrasladoEnriquecido[]> {
  let q = supabase
    .from("traslados")
    .select("*")
    .order("creada_ts", { ascending: false })
    .limit(opts?.limite ?? 100);

  if (opts?.centroId) {
    q = q.or(
      `centro_origen.eq.${opts.centroId},centro_destino.eq.${opts.centroId}`,
    );
  }

  const { data, error } = await q;
  if (error) {
    throw errorRepos("listar traslados", error.message);
  }
  const lista = ((data ?? []) as Record<string, unknown>[]).map(
    normalizarTraslado,
  );
  const personas = await resolverPersonasTraslado(lista);
  return enriquecerTraslados(lista, personas);
}

/** Traslados donde el refugiado figura en `miembros` (jsonb). */
export async function listarTrasladosPorRefugiado(
  refugiadoId: string,
  opts?: { limite?: number },
): Promise<TrasladoEnriquecido[]> {
  const id = refugiadoId.trim();
  if (!id) return [];

  // PostgREST `cs` exige literal JSON; `.contains([{...}])` a veces manda
  // sintaxis inválida ("invalid input syntax for type json").
  const filtroMiembros = JSON.stringify([{ refugiado_id: id }]);

  const { data, error } = await supabase
    .from("traslados")
    .select("*")
    .filter("miembros", "cs", filtroMiembros)
    .order("creada_ts", { ascending: false })
    .limit(opts?.limite ?? 50);

  if (error) {
    throw errorRepos("listar traslados por refugiado", error.message);
  }
  const lista = ((data ?? []) as Record<string, unknown>[]).map(
    normalizarTraslado,
  );
  const personas = await resolverPersonasTraslado(lista);
  return enriquecerTraslados(lista, personas);
}

/** Ejecuta traslado parcial vía RPC dedicada. */
export async function ejecutarTraslado(
  input: InputEjecutarTraslado,
): Promise<ResultadoTraslado> {
  const ids = input.alojamientoIds.filter(Boolean);
  if (ids.length === 0) {
    throw new Error("Seleccione al menos un miembro para trasladar.");
  }

  const { data, error } = await supabase.rpc("trasladar_miembros_entre_centros", {
    p_centro_origen: input.centroOrigen,
    p_centro_destino: input.centroDestino,
    p_motivo: input.motivo.trim(),
    p_alojamiento_ids: ids,
    p_jefe_alojamiento_id: input.jefeAlojamientoId ?? null,
    p_fecha: input.fecha ?? null,
  });

  if (error) {
    throw errorRepos("ejecutar traslado", error.message);
  }

  const raw = (data ?? {}) as Record<string, unknown>;
  const resultado: ResultadoTraslado = {
    traslado_id: String(raw.traslado_id ?? ""),
    familia_id_destino: String(raw.familia_id_destino ?? ""),
    miembros: Array.isArray(raw.miembros)
      ? (raw.miembros as ResultadoTraslado["miembros"])
      : [],
    centro_origen: String(raw.centro_origen ?? input.centroOrigen),
    centro_destino: String(raw.centro_destino ?? input.centroDestino),
  };

  // Bitácora por persona la escribe la RPC (entidad = refugiado).
  return resultado;
}

/** Etiqueta corta de documento para tablas. */
export function etiquetaDocumentoMiembro(m: MiembroHogarTraslado): string {
  return formatearCedula(m.cedula, m.tipo_doc as TipoDoc | null);
}
