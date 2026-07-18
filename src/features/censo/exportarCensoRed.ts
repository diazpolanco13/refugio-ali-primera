// Exporta el listado de censo rápido (red) a PDF (jsPDF) o Excel (xlsx).

import { CONDICIONES_VIVIENDA, type RegistroCensoRed } from "@/data/reposCenso";
import { nombreCompletoRegistro } from "./censoRegistrosUtil";

function fechaArchivo(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatearDocumento(fila: RegistroCensoRed): string {
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

function etiquetaVivienda(valor: string): string {
  return CONDICIONES_VIVIENDA.find((c) => c.valor === valor)?.label ?? valor;
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

function filaPdf(fila: RegistroCensoRed, numero: number): string[] {
  return [
    String(numero),
    nombreCompletoRegistro(fila),
    formatearDocumento(fila),
    fila.edad != null ? String(fila.edad) : "",
    fila.sexo ?? "",
    fila.centro_nombre,
    fila.telefono,
    fila.parroquia || fila.municipio,
    etiquetaVivienda(fila.condicion_vivienda),
    fila.solicitado ? "Sí" : "",
    fila.registro_policial ? "Sí" : "",
    fila.firmo_contra_presidente ? "Sí" : "",
    formatearFechaRegistro(fila.creado_en),
  ];
}

const ENCABEZADOS_PDF = [
  "#",
  "Nombre",
  "Documento",
  "Edad",
  "Sexo",
  "Campamento",
  "Teléfono",
  "Parroquia",
  "Vivienda",
  "Solic.",
  "Reg. pol.",
  "Referéndum",
  "Registro",
];

const ANCHOS_PDF_MM = [8, 40, 22, 9, 9, 34, 20, 22, 16, 12, 14, 18, 26];

function truncar(texto: string, max = 42): string {
  const t = texto.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}...`;
}

export async function exportarCensoRedPdf(filas: RegistroCensoRed[]): Promise<void> {
  if (filas.length === 0) throw new Error("No hay registros para exportar");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const margen = 12;
  const altoPagina = 210;
  const altoFila = 5;
  let y = margen;

  doc.setFontSize(13);
  doc.text("Censo rápido (red) — Damnificados registrados", margen, y);
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
      idx === 1 || idx === 5 || idx === 7 ? truncar(c, idx === 1 ? 38 : 28) : c,
    );
    let x = margen;
    for (let j = 0; j < celdas.length; j++) {
      doc.text(celdas[j], x, y, { maxWidth: ANCHOS_PDF_MM[j] - 1 });
      x += ANCHOS_PDF_MM[j];
    }
    y += altoFila;
  }

  doc.save(`censo-rapido-personas-${fechaArchivo()}.pdf`);
}

function filaExcel(fila: RegistroCensoRed, numero: number): Record<string, string | number | boolean> {
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
    Campamento: fila.centro_nombre,
    Embarazada: fila.embarazada ? "Sí" : "No",
    "Semanas embarazo": fila.embarazo_semanas ?? "",
    Discapacidad: fila.discapacidad ? "Sí" : "No",
    "Detalle discapacidad": fila.discapacidad_detalle,
    Enfermedad: fila.enfermedad ? "Sí" : "No",
    "Detalle enfermedad": fila.enfermedad_detalle,
    "Parentesco jefe": fila.parentesco_jefe,
    "Cédula jefe": fila.jefe_documento,
    País: fila.pais,
    Estado: fila.estado_federativo,
    Municipio: fila.municipio,
    Parroquia: fila.parroquia,
    "Condición vivienda": etiquetaVivienda(fila.condicion_vivienda),
    Calle: fila.calle,
    "Casa / edificio": fila.casa_edificio,
    Solicitado: fila.solicitado ? "Sí" : "No",
    "Registro policial": fila.registro_policial ? "Sí" : "No",
    "Firmó contra Presidente": fila.firmo_contra_presidente ? "Sí" : "No",
    Deportado: fila.deportado ? "Sí" : "No",
    "Tipo registro policial": fila.tipo_registro_policial ?? "",
    "Observaciones seguridad": fila.observaciones_seguridad ?? "",
    "Verificación seguridad": fila.verificacion_seguridad_en
      ? formatearFechaRegistro(fila.verificacion_seguridad_en)
      : "",
    "Fecha registro": formatearFechaRegistro(fila.creado_en),
  };
}

export async function exportarCensoRedExcel(filas: RegistroCensoRed[]): Promise<void> {
  if (filas.length === 0) throw new Error("No hay registros para exportar");

  const XLSX = await import("xlsx");
  const datos = filas.map((f, i) => filaExcel(f, filas.length - i));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Personas");
  XLSX.writeFile(libro, `censo-rapido-personas-${fechaArchivo()}.xlsx`);
}
