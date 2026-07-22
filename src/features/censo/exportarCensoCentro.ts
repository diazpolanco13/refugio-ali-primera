// Exporta personas registradas de un campamento (censo rápido) a PDF (jsPDF) o Excel (xlsx).

import { type RegistroCensoGuardado } from "@/data/reposCenso";
import { nombreCompletoRegistro } from "./censoRegistrosUtil";

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugCentro(nombre: string): string {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "centro"
  );
}

function formatearDocumento(fila: RegistroCensoGuardado): string {
  if (!fila.documento) return "";
  const prefijo = fila.tipo_doc === "P" ? "PP " : `${fila.tipo_doc ?? "V"}-`;
  return `${prefijo}${fila.documento}`;
}

function etiquetaSexo(sexo: string | null): string {
  if (sexo === "M") return "Hombre";
  if (sexo === "F") return "Mujer";
  if (sexo === "O") return "Otro";
  return "";
}

function formatearFechaRegistro(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncar(texto: string, max = 42): string {
  const t = texto.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}...`;
}

const ENCABEZADOS_PDF = [
  "#",
  "Nombre",
  "Documento",
  "Edad",
  "Sexo",
  "Teléfono",
  "Parroquia",
  "Registro",
];

const ANCHOS_PDF_MM = [8, 52, 28, 10, 10, 26, 30, 30];

function filaPdf(fila: RegistroCensoGuardado, numero: number): string[] {
  return [
    String(numero),
    nombreCompletoRegistro(fila),
    formatearDocumento(fila),
    fila.edad != null ? String(fila.edad) : "",
    fila.sexo ?? "",
    fila.telefono,
    fila.parroquia || fila.municipio,
    formatearFechaRegistro(fila.creado_en),
  ];
}

/** Todos los campos del formulario del censo, en orden fijo (columnas siempre presentes). */
function filaExcel(
  fila: RegistroCensoGuardado,
  numero: number,
): Record<string, string | number> {
  return {
    "N°": numero,
    "Primer nombre": fila.primer_nombre,
    "Segundo nombre": fila.segundo_nombre,
    "Primer apellido": fila.primer_apellido,
    "Segundo apellido": fila.segundo_apellido,
    "Tipo doc.": fila.tipo_doc ?? "",
    Documento: fila.documento,
    Edad: fila.edad ?? "",
    Sexo: etiquetaSexo(fila.sexo),
    Teléfono: fila.telefono,
    "Tipo doc. jefe": fila.jefe_tipo_doc ?? "",
    "Cédula jefe": fila.jefe_documento,
    "Parentesco jefe": fila.parentesco_jefe,
    País: fila.pais,
    Estado: fila.estado_federativo,
    Municipio: fila.municipio,
    Parroquia: fila.parroquia,
    "Fecha registro": formatearFechaRegistro(fila.creado_en),
  };
}

export async function exportarCensoCentroPdf(
  filas: RegistroCensoGuardado[],
  centroNombre: string,
): Promise<void> {
  if (filas.length === 0) throw new Error("No hay registros para exportar");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const margen = 12;
  const altoPagina = 210;
  const altoFila = 5;
  let y = margen;

  doc.setFontSize(13);
  doc.text(`Censo rápido — ${centroNombre}`, margen, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Generado: ${new Date().toLocaleString("es")} · ${filas.length} persona${filas.length === 1 ? "" : "s"}`,
    margen,
    y,
  );
  doc.setTextColor(0);
  y += 8;

  function dibujarEncabezado() {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    let x = margen;
    for (let i = 0; i < ENCABEZADOS_PDF.length; i++) {
      doc.text(ENCABEZADOS_PDF[i], x, y);
      x += ANCHOS_PDF_MM[i];
    }
    doc.setFont("helvetica", "normal");
    y += altoFila;
  }

  dibujarEncabezado();

  doc.setFontSize(6.5);
  for (let i = 0; i < filas.length; i++) {
    if (y > altoPagina - margen) {
      doc.addPage();
      y = margen;
      dibujarEncabezado();
    }
    const celdas = filaPdf(filas[i], filas.length - i).map((c, idx) =>
      idx === 1 || idx === 6 ? truncar(c, idx === 1 ? 42 : 26) : c,
    );
    let x = margen;
    for (let j = 0; j < celdas.length; j++) {
      doc.text(celdas[j], x, y, { maxWidth: ANCHOS_PDF_MM[j] - 1 });
      x += ANCHOS_PDF_MM[j];
    }
    y += altoFila;
  }

  doc.save(`censo-${slugCentro(centroNombre)}-${fechaArchivo()}.pdf`);
}

export async function exportarCensoCentroExcel(
  filas: RegistroCensoGuardado[],
  centroNombre: string,
): Promise<void> {
  if (filas.length === 0) throw new Error("No hay registros para exportar");

  const XLSX = await import("xlsx");
  const datos = filas.map((f, i) => filaExcel(f, filas.length - i));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Personas");
  XLSX.writeFile(libro, `censo-${slugCentro(centroNombre)}-${fechaArchivo()}.xlsx`);
}
