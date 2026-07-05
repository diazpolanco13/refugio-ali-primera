// Exporta ficha humanitaria a PDF con código QR.

import { nombreCompleto, formatearCedula, direccionResidencia } from "@/domain/refugiados";
import type { DetalleAlojamiento } from "@/data/useAlojamientoDetalle";

export async function exportarFichaPdf(
  detalle: DetalleAlojamiento,
  nombreCampamento: string,
  baseUrl?: string,
): Promise<void> {
  // Import dinámico: jspdf/qrcode son pesadas y solo se necesitan al exportar,
  // así no engordan el grafo de módulos del arranque (evidencia debug H3).
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);
  const { refugiado } = detalle;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margen = 15;
  let y = margen;

  const titulo = "Ficha humanitaria — Registro nominal";
  doc.setFontSize(14);
  doc.text(titulo, margen, y);
  y += 8;

  doc.setFontSize(10);
  const lineas = [
    `Código: ${refugiado.codigo_ficha ?? "—"}`,
    `Nombre: ${nombreCompleto(refugiado)}`,
    `Documento: ${formatearCedula(refugiado.cedula, refugiado.tipo_doc)}`,
    `Campamento: ${nombreCampamento}`,
    `Estado alojamiento: ${detalle.estado}`,
    `Ingreso: ${detalle.fecha_ingreso}`,
    `Teléfono: ${refugiado.contacto.telefono_principal ?? "—"}`,
    `Familia: ${detalle.familia?.nombre ?? "—"}`,
  ];

  if (detalle.residencia) {
    lineas.push(`Residencia afectada: ${direccionResidencia(detalle.residencia)}`);
    lineas.push(`Estatus vivienda: ${detalle.residencia.estatus_vivienda}`);
  }

  for (const linea of lineas) {
    doc.text(linea, margen, y);
    y += 6;
  }

  y += 4;
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString("es")}`, margen, y);
  y += 10;

  const origin = baseUrl ?? window.location.origin;
  const urlFicha = `${origin}/centros/refugiados/${detalle.id}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(urlFicha, { width: 120, margin: 1 });
    doc.addImage(qrDataUrl, "PNG", margen, y, 35, 35);
    doc.setFontSize(8);
    doc.text("Escanear para abrir ficha en línea:", margen + 40, y + 8);
    doc.text(urlFicha, margen + 40, y + 14, { maxWidth: 130 });
  } catch {
    doc.text(`URL: ${urlFicha}`, margen, y);
  }

  const slug = (refugiado.codigo_ficha ?? refugiado.id).replace(/[^a-zA-Z0-9-]/g, "_");
  doc.save(`ficha-${slug}.pdf`);
}
