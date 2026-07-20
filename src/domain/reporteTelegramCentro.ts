// Texto plano del parte diario de un campamento, con el mismo formato de los
// reportes que circulan por el grupo de Telegram de enlaces (CONTROL
// OPERACIONAL / RELACIÓN GENERAL / NOVEDADES). Lo consume el botón "Copiar
// parte» / «COPIAR REPORTE» de la pestaña Reporte: el dato nace en la app y se pega en el grupo.

import type { CentroTransitorio } from "./centrosTransitorios";
import { normalizarVulnerables } from "./tipos";
import type { SnapshotOcupacion } from "./serieOcupacionCentros";
import type { ReporteDiario } from "./reporteDiario";
import type { ReporteControlDia } from "./controlReporte";
import type { EventoReporte } from "./eventosReportes";
import {
  META_ESTATUS_TRABAJO,
  trabajosParaParteDelDia,
  type TrabajoCentro,
} from "./reparaciones";
import type { RequerimientoSeguimiento } from "./requerimientosSeguimiento";
import { metaUnidadSebinDe } from "./unidadesSebin";
import { META_ESTATUS_CASO_SALUD, type CasoSaludCentro } from "./casosSalud";
import { diasAbierto } from "./antiguedadSeguimiento";

/** "05" — los partes del grupo rellenan a dos dígitos. */
export function n2(v: number): string {
  return String(v).padStart(2, "0");
}

function siNo(v: boolean | null): string {
  if (v === null) return "SIN REPORTE";
  return v ? "SÍ" : "NO";
}

function lineaControl(etiqueta: string, valor: boolean | null, nota: string): string {
  const base = `- ${etiqueta}: ${siNo(valor)}`;
  return nota.trim() ? `${base} (${nota.trim()})` : base;
}

/** "2026-07-07" → "07/07/2026". */
export function fechaLegible(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/** "2026-07-08" → "08/07". */
export function fechaCorta(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** "DESDE 04/07 · 4 DÍAS" (antigüedad de un ítem de seguimiento). */
export function antiguedadTexto(reportadoDia: string, hoyClave: string): string {
  const dias = diasAbierto(reportadoDia, hoyClave);
  return `DESDE ${fechaCorta(reportadoDia)} · ${dias} ${dias === 1 ? "DÍA" : "DÍAS"}`;
}

export interface DatosReporteTelegram {
  centro: CentroTransitorio;
  /** Día del parte (YYYY-MM-DD). */
  dia: string;
  snapshot?: SnapshotOcupacion;
  reporte?: ReporteDiario;
  controlDia?: ReporteControlDia;
  eventosDia: EventoReporte[];
  trabajosActivos?: TrabajoCentro[];
  requerimientosActivos?: RequerimientoSeguimiento[];
  /** Casos de salud abiertos (activo / en proceso) del campamento. */
  casosSaludAbiertos?: CasoSaludCentro[];
  /** Momento de generación (para la línea HORA). */
  ahora?: Date;
}

export function textoReporteTelegramCentro({
  centro,
  dia,
  snapshot,
  reporte,
  controlDia,
  eventosDia,
  trabajosActivos = [],
  requerimientosActivos = [],
  casosSaludAbiertos = [],
  ahora = new Date(),
}: DatosReporteTelegram): string {
  const partes: string[] = [];
  const hoyClave = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
    ahora.getDate(),
  ).padStart(2, "0")}`;

  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  // CUERPO: "SEBIN - DIR. SECRETARÍA" (cuerpo + unidad interna asignada).
  const unidad = metaUnidadSebinDe(centro.supervision?.unidad_sebin);
  const cuerpoLinea = [
    centro.cuerpo?.toUpperCase(),
    unidad.clave !== "sin_asignar" ? unidad.label.toUpperCase() : "",
  ]
    .filter(Boolean)
    .join(" - ");

  partes.push(
    [
      `**CAMPAMENTO:** ${centro.nombre.toUpperCase()}`,
      ...(centro.parroquia ? [`**PARROQUIA:** ${centro.parroquia.toUpperCase()}`] : []),
      ...(cuerpoLinea ? [`**CUERPO:** ${cuerpoLinea}`] : []),
      "",
      `**FECHA:** ${fechaLegible(dia)}`,
      `**HORA:** ${hora}`,
    ].join("\n"),
  );

  // ---- Relación general (parte numérico) ----
  if (snapshot) {
    const v = normalizarVulnerables(snapshot.ocupacion);
    const ninos = v.recien_nacidos_h + v.ninos + v.adolescentes_h;
    const ninas = v.recien_nacidos_m + v.ninas + v.adolescentes_m;
    partes.push(
      [
        "**RELACIÓN GENERAL EN EL CAMPAMENTO:**",
        "",
        `- CANTIDAD DE DAMNIFICADOS: ${snapshot.total_afectados.toLocaleString("es")}`,
        `- NRO. DE FAMILIAS: ${snapshot.familias.toLocaleString("es")}`,
        `- HOMBRES: ${n2(v.adultos_h)}`,
        `- MUJERES: ${n2(v.adultos_m)}`,
        `- NIÑOS: ${n2(ninos)}`,
        `- NIÑAS: ${n2(ninas)}`,
        `- ADULTOS MAYORES HOMBRES: ${n2(v.adultos_mayores_h)}`,
        `- ADULTOS MAYORES MUJERES: ${n2(v.adultos_mayores_m)}`,
        `- MUJERES EMBARAZADAS: ${n2(v.embarazadas)}`,
        `- PERSONAS CON DISCAPACIDAD: ${n2(v.discapacidad_h + v.discapacidad_m)}`,
        `- CASOS DE SALUD: ${n2(Math.max(snapshot.incidencias_salud ?? 0, casosSaludAbiertos.length))}`,
        `- MASCOTAS: ${n2(v.mascotas)}`,
        `- PERSONAL OPERATIVO: ${n2(snapshot.personal_total)}`,
      ].join("\n"),
    );
  } else {
    partes.push("**RELACIÓN GENERAL EN EL CAMPAMENTO:**\n\n- PARTE NUMÉRICO SIN CONFIRMAR ESTE DÍA.");
  }

  // ---- Control operativo ----
  if (controlDia) {
    partes.push(
      [
        "**CONTROL OPERATIVO:**",
        lineaControl("CAPTAHUELLA", controlDia.captahuella, controlDia.captahuella_nota),
        lineaControl("JUEZ DE PAZ", controlDia.juez_paz, controlDia.juez_paz_nota),
        lineaControl("SERVICIO MÉDICO", controlDia.servicio_medico, controlDia.servicio_medico_nota),
        lineaControl("AMBULANCIA", controlDia.ambulancia, controlDia.ambulancia_nota),
      ].join("\n"),
    );
  }

  // ---- Casos de salud en seguimiento ----
  if (casosSaludAbiertos.length > 0) {
    partes.push(
      [
        "**CASOS DE SALUD EN SEGUIMIENTO:**",
        ...casosSaludAbiertos.map(
          (c) =>
            `- ${c.titulo.toUpperCase()}${c.descripcion.trim() ? `: ${c.descripcion.trim()}` : ""} (${META_ESTATUS_CASO_SALUD[c.estatus].label.toUpperCase()} · ${antiguedadTexto(c.reportado_dia, hoyClave)})`,
        ),
      ].join("\n"),
    );
  }

  // ---- Trabajos en ejecución ----
  // Incluye archivados resueltos ese día (parte histórico tras auto-archivo).
  const trabajos = trabajosParaParteDelDia(trabajosActivos, dia);
  if (trabajos.length > 0) {
    partes.push(
      [
        "**TRABAJOS EN EL PLANTEL:**",
        ...trabajos.map(
          (t) =>
            `- ${t.titulo.toUpperCase()} (${META_ESTATUS_TRABAJO[t.estatus].label.toUpperCase()} · ${antiguedadTexto(t.reportada_dia, hoyClave)})`,
        ),
      ].join("\n"),
    );
  } else if (reporte?.trabajos_revisados) {
    partes.push("**TRABAJOS EN EL PLANTEL:**\n- SIN TRABAJOS ACTIVOS.");
  }

  // ---- Requerimientos ----
  if (requerimientosActivos.length > 0) {
    partes.push(
      [
        "**REQUERIMIENTOS:**",
        ...requerimientosActivos.map((r) => {
          const cantidad = r.cantidad > 0 ? `${r.cantidad.toLocaleString("es")} ` : "";
          const nota = r.notas.trim() ? ` (${r.notas.trim()})` : "";
          return `- ${cantidad}${r.concepto.toUpperCase()}${nota}`;
        }),
      ].join("\n"),
    );
  } else if (reporte?.requerimientos_revisados) {
    partes.push("**REQUERIMIENTOS:**\n- SIN REQUERIMIENTOS PENDIENTES.");
  }

  // ---- Novedades ----
  if (eventosDia.length > 0) {
    partes.push(
      [
        "**NOVEDADES RESALTANTES:**",
        ...eventosDia.map((e) => {
          const detalle = e.descripcion.trim();
          return detalle ? `- ${e.titulo}: ${detalle}` : `- ${e.titulo}`;
        }),
      ].join("\n"),
    );
  } else if (reporte?.eventos_revisados) {
    partes.push("**NOVEDADES RESALTANTES:**\n- SIN NOVEDAD.");
  }

  // Referencia máquina-legible: permite a un bot/agente casar el mensaje con
  // la fila exacta de Supabase sin matching difuso de nombres.
  // Formato estable: REF: <centro_id> | <YYYY-MM-DD>
  partes.push(`\`REF: ${centro.id} | ${dia}\``);

  return partes.join("\n\n");
}
