// Export Excel del censo nominal de un campamento (reportes internos).
// Cada fila vuelca la ficha nominal completa y se enriquece con la caché de
// consultas Nexus/SAIME (`nexus_consultas`): estado civil, teléfonos SAIME,
// dirección fiscal y si existe foto SAIME. La caché la puebla el censo por
// cédula; personas sin cédula (niños) o nunca consultadas salen sin ese bloque.

import { supabase } from "@/data/supabaseClient";
import type { PersonaNexusCenso } from "@/domain/nexusPersona";
import {
  calcularEdad,
  formatearCedula,
  nombreCompleto,
  type AlojamientoEnriquecido,
  type EstadoDocumento,
  type Refugiado,
} from "@/domain/refugiados";

function etiquetaSexo(sexo: string | null | undefined): string {
  if (sexo === "M") return "M";
  if (sexo === "F") return "F";
  if (sexo === "O") return "Otro";
  return "";
}

const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  vigente: "Vigente",
  perdida: "Perdida",
  danada: "Dañada",
  en_tramite: "En trámite",
};

function slugCentro(nombre: string): string {
  return (
    nombre
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "campamento"
  );
}

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatearFechaHora(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Condiciones de salud relevantes en una sola celda legible. */
function resumenSalud(r: Refugiado): string {
  const s = r.salud ?? {};
  const partes: string[] = [];
  if (s.lesiones?.trim()) partes.push(`Lesiones: ${s.lesiones.trim()}`);
  if (s.condiciones_cronicas?.trim()) {
    partes.push(`Crónicas: ${s.condiciones_cronicas.trim()}`);
  }
  if (s.medicamentos_urgente) partes.push("Medicamentos urgentes");
  if (s.medicamentos_perdidos?.trim()) {
    partes.push(`Medicamentos perdidos: ${s.medicamentos_perdidos.trim()}`);
  }
  if ((s.embarazo_semanas ?? 0) > 0) {
    partes.push(`Embarazo ${s.embarazo_semanas} sem.`);
  }
  if (s.lactancia) partes.push("Lactancia");
  if (s.notas?.trim()) partes.push(s.notas.trim());
  return partes.join(" · ");
}

/**
 * Clave de la caché Nexus para una persona (letra + dígitos). Los pasaportes
 * no existen en Nexus; se omiten.
 */
function claveNexus(r: Refugiado): string | null {
  const digits = (r.cedula_norm ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (r.tipo_doc === "P") return null;
  const letra = r.tipo_doc === "E" ? "E" : "V";
  return `${letra}:${digits}`;
}

/**
 * Carga en lote las fichas Nexus cacheadas para las personas del export.
 * Best-effort: si la lectura falla (sin sesión, RLS), el Excel sale sin el
 * bloque SAIME en vez de romper la descarga.
 */
async function cargarFichasNexus(
  filas: AlojamientoEnriquecido[],
): Promise<Map<string, PersonaNexusCenso>> {
  const mapa = new Map<string, PersonaNexusCenso>();
  const claves = new Set<string>();
  for (const f of filas) {
    const clave = claveNexus(f.refugiado);
    if (clave) claves.add(clave);
  }
  if (claves.size === 0) return mapa;

  const digitsUnicos = [...new Set([...claves].map((c) => c.split(":")[1]))];
  const LOTE = 200;
  try {
    for (let i = 0; i < digitsUnicos.length; i += LOTE) {
      // Vía RPC `nexus_cache_lote` (SECURITY DEFINER, solo roles que exportan):
      // la RLS de `nexus_consultas` ya no permite la lectura directa.
      const { data, error } = await supabase.rpc("nexus_cache_lote", {
        p_cedulas: digitsUnicos.slice(i, i + LOTE),
      });
      if (error) {
        console.warn("[exportarCensoNominal] caché Nexus:", error.message);
        return mapa;
      }
      for (const row of data ?? []) {
        const persona = row.data as PersonaNexusCenso | null;
        if (!persona || persona.ok === false) continue;
        mapa.set(`${String(row.letra).toUpperCase()}:${row.cedula}`, persona);
      }
    }
  } catch (err) {
    console.warn("[exportarCensoNominal] caché Nexus:", err);
  }
  return mapa;
}

function filaExcel(
  a: AlojamientoEnriquecido,
  numero: number,
  nexus: PersonaNexusCenso | null,
) {
  const r = a.refugiado;
  const edad = calcularEdad(r.fecha_nacimiento);
  const parentesco = a.es_jefe_familia
    ? "Jefe/a"
    : (a.parentesco_jefe?.trim() || "");
  const familia =
    a.familia?.nombre?.trim() ||
    (a.familia_id ? a.familia_id.slice(0, 8) : "");
  const vul = r.vulnerabilidades ?? {};

  return {
    "#": numero,
    Nombre: nombreCompleto(r),
    Documento: formatearCedula(r.cedula || r.cedula_norm || "", r.tipo_doc),
    "Fecha nacimiento": r.fecha_nacimiento ?? "",
    Edad: edad == null ? "" : edad,
    Sexo: etiquetaSexo(r.sexo),
    Nacionalidad: r.nacionalidad?.trim() || "",
    "Estado civil (SAIME)": nexus?.estado_civil?.trim() || "",
    Parentesco: parentesco,
    Familia: familia,
    Embarazada: vul.embarazada ? "Sí" : "No",
    Discapacidad: vul.discapacidad ? "Sí" : "No",
    "Detalle discapacidad": vul.discapacidad_detalle?.trim() || "",
    Salud: resumenSalud(r),
    "Desaparecidos hogar": a.familia?.desaparecidos ?? 0,
    "Fallecidos hogar": a.familia?.fallecidos_confirmados ?? 0,
    Teléfono: r.contacto?.telefono_principal?.trim() || "",
    "Teléfonos (SAIME)": nexus?.telefonos?.length
      ? nexus.telefonos.join(" / ")
      : "",
    "Dirección fiscal (SAIME)": nexus?.direccion_fiscal?.trim() || "",
    "Ocupación previa": r.habilidades?.ocupacion_previa?.trim() || "",
    "Estado documento": ETIQUETA_ESTADO_DOCUMENTO[r.estado_documento] ?? "",
    "Verificado Nexus": nexus ? "Sí" : "No",
    "Foto SAIME": nexus ? (nexus.tiene_foto_saime ? "Sí" : "No") : "",
    Estado: a.estado,
    Itinerante: a.itinerante ? "Sí" : "No",
    "Registrado por": (a.creada_por || a.updated_by || "").trim(),
    "Fecha registro": formatearFechaHora(a.creada_ts),
  };
}

/** Ancho de columna (caracteres) acotado para que el Excel abra legible. */
function anchosColumnas(datos: Record<string, unknown>[]): { wch: number }[] {
  if (datos.length === 0) return [];
  const claves = Object.keys(datos[0]);
  return claves.map((clave) => {
    let ancho = clave.length;
    for (const fila of datos) {
      const valor = fila[clave];
      const largo = valor == null ? 0 : String(valor).length;
      if (largo > ancho) ancho = largo;
    }
    return { wch: Math.min(Math.max(ancho + 2, 6), 45) };
  });
}

/**
 * Descarga un .xlsx con la ficha nominal completa (enriquecida con la caché
 * Nexus/SAIME) del censo filtrado.
 */
export async function exportarCensoNominalExcel(
  filas: AlojamientoEnriquecido[],
  centroNombre: string,
  opts?: { nombresCentros?: Map<string, string> },
): Promise<void> {
  if (filas.length === 0) throw new Error("No hay registros para exportar");

  const [XLSX, fichasNexus] = await Promise.all([
    import("xlsx"),
    cargarFichasNexus(filas),
  ]);

  const conCampamento = Boolean(opts?.nombresCentros);
  const datos = filas.map((f, i) => {
    const clave = claveNexus(f.refugiado);
    const base = filaExcel(f, i + 1, clave ? (fichasNexus.get(clave) ?? null) : null);
    if (!conCampamento || !opts?.nombresCentros) return base;
    return {
      ...base,
      Campamento:
        opts.nombresCentros.get(f.centro_id) ?? f.centro_id,
    };
  });
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = anchosColumnas(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Censo nominal");
  XLSX.writeFile(
    libro,
    `censo-nominal-${slugCentro(centroNombre)}-${fechaArchivo()}.xlsx`,
  );
}

/** @deprecated Usar exportarCensoNominalExcel. */
export async function exportarCensoNominalCsv(
  filas: AlojamientoEnriquecido[],
  centroNombre: string,
): Promise<void> {
  return exportarCensoNominalExcel(filas, centroNombre);
}
