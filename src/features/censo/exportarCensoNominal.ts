// Export Excel del censo nominal de un campamento (reportes internos).

import {
  calcularEdad,
  formatearCedula,
  nombreCompleto,
  type AlojamientoEnriquecido,
} from "@/domain/refugiados";

function etiquetaSexo(sexo: string | null | undefined): string {
  if (sexo === "M") return "M";
  if (sexo === "F") return "F";
  if (sexo === "O") return "Otro";
  return "";
}

function slugCentro(nombre: string): string {
  return (
    nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
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

function filaExcel(a: AlojamientoEnriquecido, numero: number) {
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
    Edad: edad == null ? "" : edad,
    Sexo: etiquetaSexo(r.sexo),
    Parentesco: parentesco,
    Familia: familia,
    Embarazada: vul.embarazada ? "Sí" : "No",
    Discapacidad: vul.discapacidad ? "Sí" : "No",
    "Desaparecidos hogar": a.familia?.desaparecidos ?? 0,
    "Fallecidos hogar": a.familia?.fallecidos_confirmados ?? 0,
    Teléfono: r.contacto?.telefono_principal?.trim() || "",
    Estado: a.estado,
    "Registrado por": (a.creada_por || a.updated_by || "").trim(),
    "Fecha registro": formatearFechaHora(a.creada_ts),
  };
}

/** Descarga un .xlsx con columnas tipadas del censo nominal filtrado. */
export async function exportarCensoNominalExcel(
  filas: AlojamientoEnriquecido[],
  centroNombre: string,
  opts?: { nombresCentros?: Map<string, string> },
): Promise<void> {
  if (filas.length === 0) throw new Error("No hay registros para exportar");

  const XLSX = await import("xlsx");
  const conCampamento = Boolean(opts?.nombresCentros);
  const datos = filas.map((f, i) => {
    const base = filaExcel(f, i + 1);
    if (!conCampamento || !opts?.nombresCentros) return base;
    return {
      ...base,
      Campamento:
        opts.nombresCentros.get(f.centro_id) ?? f.centro_id,
    };
  });
  const hoja = XLSX.utils.json_to_sheet(datos);
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
