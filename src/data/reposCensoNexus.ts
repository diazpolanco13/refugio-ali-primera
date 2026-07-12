// Alta en la base nominal desde una ficha Nexus verificada (censo por cédula).

import {
  asociarRefugiadoAFamilia,
  actualizarContacto,
  crearFamilia,
  crearRefugiado,
  estadoNominalCedulaRed,
  listarMiembrosFamilia,
  registrarAlojamiento,
  upsertRefugiadoIdentidad,
  type EstadoNominalCedulaRed,
} from "./reposRefugiados";
import { marcarCensoProcesado } from "./reposCenso";
import { supabase } from "./supabaseClient";
import type { PersonaNexusCenso } from "@/domain/nexusPersona";
import type { Refugiado, SexoRefugiado, TipoDoc } from "@/domain/refugiados";
import { normalizarCedula, normalizarRefugiado } from "@/domain/refugiados";

function sexoNexus(s: string | null | undefined): SexoRefugiado | null {
  if (s === "M" || s === "F" || s === "O") return s;
  return null;
}

function tipoDocNexus(letra: string): TipoDoc {
  if (letra === "E") return "E";
  if (letra === "P") return "P";
  return "V";
}

export interface ResultadoAltaNexus {
  refugiadoId: string;
  alojamientoId: string;
  familiaId: string;
  creado: boolean;
  yaEstabaEnCentro: boolean;
  otrosCentros: string[];
}

/** Crea o actualiza la persona en nominal y la aloja en el campamento (como jefe o familiar). */
export async function registrarPersonaNexusEnNominal(opts: {
  persona: PersonaNexusCenso;
  centroId: string;
  familiaId?: string | null;
  esJefe: boolean;
  parentescoJefe?: string;
  /** Permite crear el hogar aunque esJefe sea false — la persona funda el
   * hogar como miembro (no líder) porque el líder no está presente. */
  crearHogarSiFalta?: boolean;
  /** Teléfonos confirmados con la persona (el primero queda como principal). */
  telefonosConfirmados?: string[];
}): Promise<ResultadoAltaNexus> {
  const letra = (opts.persona.letra || "V").toUpperCase();
  const { cedula, cedula_norm, tipo_doc } = normalizarCedula(
    opts.persona.cedula,
    tipoDocNexus(letra),
  );
  if (!cedula_norm) throw new Error("Cédula inválida");

  // Find-or-create atómico en el servidor: un buscar+crear hecho en el
  // cliente choca con refugiados_cedula_norm_uq en cuanto la persona ya
  // existe pero la RLS la oculta (creada por otro usuario o alojada en otro
  // centro — blindaje_lectura_refugiados).
  const { id: refugiadoId, creado } = await upsertRefugiadoIdentidad(
    {
      primer_nombre: opts.persona.primer_nombre,
      segundo_nombre: opts.persona.segundo_nombre,
      primer_apellido: opts.persona.primer_apellido,
      segundo_apellido: opts.persona.segundo_apellido,
      fecha_nacimiento: opts.persona.fecha_nacimiento,
      sexo: sexoNexus(opts.persona.sexo),
      cedula,
      tipo_doc,
    },
    opts.centroId,
  );

  // Teléfonos: si el funcionario confirmó alguno con la persona, esos mandan
  // (el primero como principal, el resto alternos). Sin confirmación se
  // conserva el comportamiento previo: primer teléfono que trajo Nexus.
  // OJO: se guarda DESPUÉS de crear el alojamiento (más abajo), no aquí: la
  // RLS de refugiados_update exige que ya exista un alojamiento de esta
  // persona en un centro del operador/supervisor, que todavía no existe en
  // este punto para una persona nueva en este campamento.
  async function guardarTelefonosConfirmados(): Promise<void> {
    const confirmados = (opts.telefonosConfirmados ?? []).filter(Boolean);
    const telPrincipal = confirmados[0] ?? opts.persona.telefonos?.[0];
    if (!telPrincipal) return;
    try {
      await actualizarContacto(refugiadoId, {
        telefono_principal: telPrincipal,
        telefonos_alternos: confirmados.slice(1).map((numero) => ({ numero })),
        tiene_acceso_telefono: true,
        ...(confirmados.length > 0
          ? { notas: "Teléfono confirmado en censo por cédula" }
          : {}),
      });
    } catch {
      /* contacto opcional */
    }
  }

  // También bypassa la RLS a propósito (misma razón que el upsert de arriba):
  // listar alojamientos por refugiado_id se filtra a los centros del
  // operador, así que "otros centros" salía incompleto para una sesión de
  // un solo campamento.
  const estado = await estadoNominalCedulaRed(cedula_norm, opts.centroId);
  const otrosCentros = estado.otrosCentros.map((o) => o.centroId);

  let familiaId = opts.familiaId ?? null;
  if (opts.esJefe) {
    if (!familiaId && estado.familiaAqui && estado.esJefeAqui) {
      // Ya es jefe de un hogar en este campamento: se reanuda ese hogar en
      // lugar de crear una familia duplicada.
      familiaId = estado.familiaAqui;
    }
    if (!familiaId) {
      const nombreHogar = `Hogar ${tipo_doc}-${cedula} · ${opts.persona.primer_apellido}`.trim();
      familiaId = await crearFamilia({
        centro_id: opts.centroId,
        nombre: nombreHogar,
        notas: `Jefe: ${tipo_doc}-${cedula}`,
      });
    }
    const alojamientoId = await asociarRefugiadoAFamilia({
      refugiado_id: refugiadoId,
      centro_id: opts.centroId,
      familia_id: familiaId,
      es_jefe_familia: true,
      parentesco_jefe: "",
    });
    await guardarTelefonosConfirmados();
    marcarCensoProcesado(cedula_norm, opts.centroId);
    return {
      refugiadoId,
      alojamientoId,
      familiaId,
      creado,
      yaEstabaEnCentro: estado.enEsteCentro,
      otrosCentros,
    };
  }

  if (!familiaId) {
    if (!opts.crearHogarSiFalta) {
      throw new Error("Falta el hogar para agregar al familiar.");
    }
    // Fundador sin líder presente: crea el hogar igual, sin marcar líder —
    // el parentesco declarado queda respecto al líder que se asigne después.
    const nombreHogar = `Hogar ${tipo_doc}-${cedula} · ${opts.persona.primer_apellido}`.trim();
    familiaId = await crearFamilia({
      centro_id: opts.centroId,
      nombre: nombreHogar,
      notas: `Fundado sin líder presente por ${tipo_doc}-${cedula}`,
    });
  }
  const alojamientoId = await asociarRefugiadoAFamilia({
    refugiado_id: refugiadoId,
    centro_id: opts.centroId,
    familia_id: familiaId,
    es_jefe_familia: false,
    parentesco_jefe: (opts.parentescoJefe || "Otro familiar").trim(),
  });
  await guardarTelefonosConfirmados();
  marcarCensoProcesado(cedula_norm, opts.centroId);

  return {
    refugiadoId,
    alojamientoId,
    familiaId,
    creado,
    yaEstabaEnCentro: estado.enEsteCentro,
    otrosCentros,
  };
}

/** Situación de una cédula en la base nominal, para avisar antes de registrar. */
export type EstadoNominalCedula = EstadoNominalCedulaRed;

export async function estadoNominalPorCedula(
  cedula: string,
  letra: string,
  centroId: string,
): Promise<EstadoNominalCedula> {
  const vacio: EstadoNominalCedula = {
    registrado: false,
    refugiadoId: null,
    enEsteCentro: false,
    esJefeAqui: false,
    familiaAqui: null,
    otrosCentros: [],
  };
  const { cedula_norm } = normalizarCedula(cedula, tipoDocNexus(letra.toUpperCase()));
  if (!cedula_norm) return vacio;
  // RPC SECURITY DEFINER: ve toda la red (solo centro_ids/flags, sin PII),
  // no solo los centros asignados a esta sesión. Ver upsertRefugiadoIdentidad.
  return estadoNominalCedulaRed(cedula_norm, centroId);
}

/** Alta de un miembro sin documento (típicamente menores) directo al hogar activo. */
export async function registrarMiembroSinDocumento(opts: {
  centroId: string;
  familiaId: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  sexo: SexoRefugiado | null;
  fecha_nacimiento: string | null;
  parentescoJefe: string;
}): Promise<{ refugiadoId: string; alojamientoId: string }> {
  const refugiadoId = await crearRefugiado(
    {
      primer_nombre: opts.primer_nombre,
      segundo_nombre: opts.segundo_nombre,
      primer_apellido: opts.primer_apellido,
      segundo_apellido: opts.segundo_apellido,
      sexo: opts.sexo,
      fecha_nacimiento: opts.fecha_nacimiento,
    },
    opts.centroId,
  );
  const alojamientoId = await registrarAlojamiento({
    refugiado_id: refugiadoId,
    centro_id: opts.centroId,
    familia_id: opts.familiaId,
    parentesco_jefe: (opts.parentescoJefe || "Hijo/a").trim(),
  });
  return { refugiadoId, alojamientoId };
}

export async function miembrosHogarActual(
  familiaId: string,
): Promise<
  {
    alojamientoId: string;
    refugiadoId: string;
    es_jefe: boolean;
    parentesco: string;
    nombre: string;
    cedula: string | null;
    fotoUrl: string | null;
    fechaNacimiento: string | null;
    creadaTs: number;
  }[]
> {
  const alojamientos = await listarMiembrosFamilia(familiaId);
  const activos = alojamientos.filter((a) => a.estado !== "egresado");
  if (activos.length === 0) return [];

  const ids = [...new Set(activos.map((a) => a.refugiado_id))];
  const { data, error } = await supabase.from("refugiados").select("*").in("id", ids);
  if (error) throw new Error(`[reposCensoNexus] miembros: ${error.message}`);
  const porId = new Map(
    ((data ?? []) as Refugiado[]).map((r) => [r.id, normalizarRefugiado(r)]),
  );

  return activos
    .map((a) => {
      const r = porId.get(a.refugiado_id);
      const nombre = r
        ? [r.primer_nombre, r.primer_apellido].filter(Boolean).join(" ") || r.nombres
        : a.refugiado_id.slice(0, 8);
      const foto = (r?.foto_url ?? "").trim();
      return {
        alojamientoId: a.id,
        refugiadoId: a.refugiado_id,
        es_jefe: a.es_jefe_familia,
        parentesco: a.parentesco_jefe || (a.es_jefe_familia ? "Jefe/a" : ""),
        nombre,
        cedula: r?.cedula_norm ?? r?.cedula ?? null,
        fotoUrl: foto.length > 0 ? foto : null,
        fechaNacimiento: r?.fecha_nacimiento ?? null,
        creadaTs: a.creada_ts || a.updated_at || 0,
      };
    })
    .sort((a, b) => {
      if (a.es_jefe && !b.es_jefe) return -1;
      if (!a.es_jefe && b.es_jefe) return 1;
      return (a.creadaTs || 0) - (b.creadaTs || 0);
    });
}
