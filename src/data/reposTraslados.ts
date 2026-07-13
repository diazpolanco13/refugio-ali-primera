// Repos de traslados formales entre campamentos.

import {
  formatearCedula,
  nombreCompleto,
  normalizarCedula,
  type TipoDoc,
} from "../domain/refugiados";
import {
  normalizarTraslado,
  type HogarTrasladable,
  type InputEjecutarTraslado,
  type MiembroHogarTraslado,
  type ResultadoTraslado,
  type Traslado,
} from "../domain/traslados";
import { esFalloDeRed, MENSAJE_SIN_CONEXION } from "@/lib/errorRed";
import { supabase } from "./supabaseClient";
import { registrarHistorial } from "./historial";

function errorRepos(contexto: string, message: string): Error {
  console.warn(`[reposTraslados] ${contexto}:`, message);
  if (esFalloDeRed({ message })) return new Error(MENSAJE_SIN_CONEXION);
  return new Error(`[reposTraslados] ${contexto}: ${message}`);
}

interface RefugiadoJoin {
  id: string;
  cedula: string | null;
  cedula_norm: string | null;
  tipo_doc: string | null;
  nombres: string;
  apellidos: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
}

interface FamiliaJoin {
  id: string;
  nombre: string;
  centro_id: string;
}

interface FilaAlojJoin {
  id: string;
  refugiado_id: string;
  centro_id: string;
  familia_id: string | null;
  estado: string;
  es_jefe_familia: boolean;
  parentesco_jefe: string;
  refugiados: RefugiadoJoin | RefugiadoJoin[] | null;
  familias_centro: FamiliaJoin | FamiliaJoin[] | null;
}

function uno<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function miembroDeFila(fila: FilaAlojJoin): MiembroHogarTraslado {
  const r = uno(fila.refugiados);
  const nombre = r ? nombreCompleto(r) : "Sin nombre";
  return {
    alojamiento_id: fila.id,
    refugiado_id: fila.refugiado_id,
    nombre,
    cedula: r?.cedula ?? null,
    tipo_doc: r?.tipo_doc ?? null,
    es_jefe_familia: Boolean(fila.es_jefe_familia),
    parentesco_jefe: fila.parentesco_jefe ?? "",
    estado: fila.estado,
  };
}

/**
 * Hogares activos en un campamento, filtrables por nombre de familia o
 * cédula/nombre de un miembro.
 */
export async function buscarHogaresTrasladables(
  centroId: string,
  busqueda?: string,
): Promise<HogarTrasladable[]> {
  const { data, error } = await supabase
    .from("alojamientos_refugiados")
    .select(
      `
      id, refugiado_id, centro_id, familia_id, estado,
      es_jefe_familia, parentesco_jefe,
      refugiados (
        id, cedula, cedula_norm, tipo_doc,
        nombres, apellidos,
        primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
      ),
      familias_centro ( id, nombre, centro_id )
    `,
    )
    .eq("centro_id", centroId)
    .in("estado", ["activo", "observacion"])
    .order("es_jefe_familia", { ascending: false });

  if (error) {
    throw errorRepos("buscar hogares", error.message);
  }

  const filas = (data ?? []) as unknown as FilaAlojJoin[];
  const porClave = new Map<string, HogarTrasladable>();

  for (const fila of filas) {
    const esFamilia = Boolean(fila.familia_id);
    const clave = esFamilia
      ? `fam:${fila.familia_id}`
      : `solo:${fila.id}`;

    let hogar = porClave.get(clave);
    if (!hogar) {
      const fam = uno(fila.familias_centro);
      const nombreFam = fam?.nombre?.trim();
      hogar = {
        clave,
        familia_id: fila.familia_id,
        alojamiento_id: esFamilia ? null : fila.id,
        centro_id: centroId,
        nombre_hogar: esFamilia
          ? nombreFam || "Familia sin nombre"
          : "Persona sin hogar",
        miembros: [],
      };
      porClave.set(clave, hogar);
    }
    hogar.miembros.push(miembroDeFila(fila));
  }

  // Persona sola: nombre del hogar = nombre de la persona
  for (const hogar of porClave.values()) {
    if (!hogar.familia_id && hogar.miembros[0]) {
      hogar.nombre_hogar = hogar.miembros[0].nombre || "Persona sin hogar";
    }
    hogar.miembros.sort((a, b) => {
      if (a.es_jefe_familia !== b.es_jefe_familia) {
        return a.es_jefe_familia ? -1 : 1;
      }
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }

  let lista = [...porClave.values()];
  const q = (busqueda ?? "").trim();
  if (q) {
    const qLower = q.toLowerCase();
    const qDoc = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    lista = lista.filter((h) => {
      if (h.nombre_hogar.toLowerCase().includes(qLower)) return true;
      return h.miembros.some((m) => {
        if (m.nombre.toLowerCase().includes(qLower)) return true;
        const ced = (m.cedula ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (qDoc && ced.includes(qDoc)) return true;
        try {
          const norm = normalizarCedula(q, (m.tipo_doc as TipoDoc) || "V");
          if (norm.cedula_norm && ced.includes(norm.cedula_norm)) return true;
        } catch {
          /* ignore */
        }
        return false;
      });
    });
  }

  return lista.sort((a, b) =>
    a.nombre_hogar.localeCompare(b.nombre_hogar, "es"),
  );
}

/** Historial de traslados (más recientes primero). */
export async function listarTraslados(opts?: {
  centroId?: string;
  limite?: number;
}): Promise<Traslado[]> {
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
  return ((data ?? []) as Record<string, unknown>[]).map(normalizarTraslado);
}

/** Ejecuta el traslado atómico vía RPC. */
export async function ejecutarTraslado(
  input: InputEjecutarTraslado,
): Promise<ResultadoTraslado> {
  const familiaId = input.familiaId ?? null;
  const alojamientoId = input.alojamientoId ?? null;

  if ((familiaId && alojamientoId) || (!familiaId && !alojamientoId)) {
    throw new Error(
      "Indique exactamente una familia o un alojamiento (persona sin hogar).",
    );
  }

  const { data, error } = await supabase.rpc("trasladar_entre_centros", {
    p_centro_origen: input.centroOrigen,
    p_centro_destino: input.centroDestino,
    p_motivo: input.motivo.trim(),
    p_familia_id: familiaId,
    p_alojamiento_id: alojamientoId,
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

  registrarHistorial("trasladar_familia", "traslado", resultado.traslado_id, {
    familia_id_origen: familiaId,
    familia_id_destino: resultado.familia_id_destino,
    centro_origen: resultado.centro_origen,
    centro_destino: resultado.centro_destino,
    motivo: input.motivo.trim(),
    miembros: resultado.miembros.length,
  });

  return resultado;
}

/** Etiqueta corta de documento para tablas. */
export function etiquetaDocumentoMiembro(m: MiembroHogarTraslado): string {
  return formatearCedula(m.cedula, m.tipo_doc as TipoDoc | null);
}
