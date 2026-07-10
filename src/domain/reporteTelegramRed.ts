// Parte general de la RED en texto plano (formato Telegram, con **negritas**):
// agregado de todos los campamentos con carry-forward de población, control
// del día, seguimientos abiertos (salud, trabajos, requerimientos), novedades
// y la lista de campamentos sin parte. Lo consume el botón "Copiar parte de
// la red" en /centros/reportes.

import type { CentroTransitorio } from "./centrosTransitorios";
import { contarUnidadesCon, totalUnidadesConteo } from "./complejosCentros";
import { normalizarVulnerables, VULNERABLES_VACIO, type Vulnerables } from "./tipos";
import type { SnapshotOcupacion } from "./serieOcupacionCentros";
import type { ReporteControlDia } from "./controlReporte";
import type { EventoReporte } from "./eventosReportes";
import { META_ESTATUS_TRABAJO, type TrabajoCentro } from "./reparaciones";
import {
  CATEGORIAS_REQUERIMIENTO,
  type RequerimientoSeguimiento,
} from "./requerimientosSeguimiento";
import { META_ESTATUS_CASO_SALUD, type CasoSaludCentro } from "./casosSalud";
import { antiguedadTexto, fechaLegible, n2 } from "./reporteTelegramCentro";

const MAX_LISTADO = 6;

export interface DatosParteRed {
  centros: CentroTransitorio[];
  /** Día del parte (YYYY-MM-DD). */
  dia: string;
  /** Snapshots de la ventana (para carry-forward hasta `dia`). */
  snapshots: SnapshotOcupacion[];
  /** Controles operativos del día. */
  controlesDia: ReporteControlDia[];
  casosSaludAbiertos: CasoSaludCentro[];
  trabajosActivos: TrabajoCentro[];
  requerimientosActivos: RequerimientoSeguimiento[];
  /** Novedades registradas el día del parte. */
  eventosDia: EventoReporte[];
  incidenciasAbiertas?: number;
  ahora?: Date;
}

function sumar(a: Vulnerables, b: Vulnerables): Vulnerables {
  const out = { ...a };
  for (const k of Object.keys(VULNERABLES_VACIO) as (keyof Vulnerables)[]) {
    out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  }
  return out;
}

function lineaControlRed(etiqueta: string, si: number, no: number): string {
  if (si + no === 0) return `- ${etiqueta}: SIN REPORTE`;
  return `- ${etiqueta}: ${n2(si)} SÍ · ${n2(no)} NO`;
}

export function textoParteGeneralRed({
  centros,
  dia,
  snapshots,
  controlesDia,
  casosSaludAbiertos,
  trabajosActivos,
  requerimientosActivos,
  eventosDia,
  incidenciasAbiertas,
  ahora = new Date(),
}: DatosParteRed): string {
  const partes: string[] = [];
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const hoyClave = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
    ahora.getDate(),
  ).padStart(2, "0")}`;

  const nombreDe = new Map(centros.map((c) => [c.id, c.nombre]));

  // Carry-forward: último snapshot conocido de cada campamento hasta `dia`.
  const ultimoPorCentro = new Map<string, SnapshotOcupacion>();
  for (const s of snapshots) {
    if (s.dia > dia || !nombreDe.has(s.centro_id)) continue;
    const previo = ultimoPorCentro.get(s.centro_id);
    if (!previo || s.dia > previo.dia) ultimoPorCentro.set(s.centro_id, s);
  }

  let refugiados = 0;
  let familias = 0;
  let personal = 0;
  let vuln: Vulnerables = { ...VULNERABLES_VACIO };
  const conParteDelDia = new Set<string>();
  for (const [centroId, snap] of ultimoPorCentro) {
    refugiados += snap.total_afectados;
    familias += snap.familias;
    personal += snap.personal_total;
    vuln = sumar(vuln, normalizarVulnerables(snap.ocupacion));
    if (snap.dia === dia) conParteDelDia.add(centroId);
  }
  const ninos = vuln.recien_nacidos_h + vuln.ninos + vuln.adolescentes_h;
  const ninas = vuln.recien_nacidos_m + vuln.ninas + vuln.adolescentes_m;

  const totalCampamentos = totalUnidadesConteo(centros);
  const conParteUnidades = contarUnidadesCon(centros, (c) => conParteDelDia.has(c.id));

  partes.push(
    [
      "**PARTE GENERAL — RED DE CAMPAMENTOS TRANSITORIOS**",
      "**ÁREA METROPOLITANA DE CARACAS**",
      "",
      `**FECHA:** ${fechaLegible(dia)}`,
      `**HORA:** ${hora}`,
      `**CORTE:** ${n2(totalCampamentos)} CAMPAMENTOS · CON PARTE DEL DÍA: ${n2(conParteUnidades)}/${n2(totalCampamentos)}`,
    ].join("\n"),
  );

  partes.push(
    [
      "**RELACIÓN GENERAL DE LA RED:**",
      "",
      `- CANTIDAD DE DAMNIFICADOS: ${refugiados.toLocaleString("es")}`,
      `- NRO. DE FAMILIAS: ${familias.toLocaleString("es")}`,
      `- HOMBRES: ${vuln.adultos_h.toLocaleString("es")}`,
      `- MUJERES: ${vuln.adultos_m.toLocaleString("es")}`,
      `- NIÑOS: ${ninos.toLocaleString("es")}`,
      `- NIÑAS: ${ninas.toLocaleString("es")}`,
      `- ADULTOS MAYORES HOMBRES: ${n2(vuln.adultos_mayores_h)}`,
      `- ADULTOS MAYORES MUJERES: ${n2(vuln.adultos_mayores_m)}`,
      `- MUJERES EMBARAZADAS: ${n2(vuln.embarazadas)}`,
      `- PERSONAS CON DISCAPACIDAD: ${n2(vuln.discapacidad_h + vuln.discapacidad_m)}`,
      `- CASOS DE SALUD ABIERTOS: ${n2(casosSaludAbiertos.length)}`,
      `- MASCOTAS: ${n2(vuln.mascotas)}`,
      `- PERSONAL OPERATIVO: ${n2(personal)}`,
    ].join("\n"),
  );

  // ---- Control operativo del día (agregado) ----
  const revisados = controlesDia.filter((c) => c.revisado);
  const cuenta = (campo: "captahuella" | "juez_paz" | "servicio_medico" | "ambulancia") => ({
    si: controlesDia.filter((c) => c[campo] === true).length,
    no: controlesDia.filter((c) => c[campo] === false).length,
  });
  const capta = cuenta("captahuella");
  const juez = cuenta("juez_paz");
  const medico = cuenta("servicio_medico");
  const ambulancia = cuenta("ambulancia");
  partes.push(
    [
      "**CONTROL OPERATIVO (DÍA):**",
      `- CAMPAMENTOS CON CONTROL REVISADO: ${n2(revisados.length)}/${n2(totalCampamentos)}`,
      lineaControlRed("CAPTAHUELLA", capta.si, capta.no),
      lineaControlRed("JUEZ DE PAZ", juez.si, juez.no),
      lineaControlRed("SERVICIO MÉDICO", medico.si, medico.no),
      lineaControlRed("AMBULANCIA", ambulancia.si, ambulancia.no),
    ].join("\n"),
  );

  // ---- Casos de salud en seguimiento ----
  if (casosSaludAbiertos.length > 0) {
    const visibles = casosSaludAbiertos.slice(0, MAX_LISTADO);
    partes.push(
      [
        `**CASOS DE SALUD EN SEGUIMIENTO (${n2(casosSaludAbiertos.length)}):**`,
        ...visibles.map(
          (c) =>
            `- ${(nombreDe.get(c.centro_id) ?? c.centro_id).toUpperCase()}: ${c.titulo.toUpperCase()} (${META_ESTATUS_CASO_SALUD[c.estatus].label.toUpperCase()} · ${antiguedadTexto(c.reportado_dia, hoyClave)})`,
        ),
        ...(casosSaludAbiertos.length > MAX_LISTADO
          ? [`- (+${casosSaludAbiertos.length - MAX_LISTADO} CASOS MÁS)`]
          : []),
      ].join("\n"),
    );
  }

  // ---- Trabajos en la red ----
  const trabajos = trabajosActivos.filter(
    (t) => t.estatus === "pendiente" || t.estatus === "en_progreso",
  );
  if (trabajos.length > 0) {
    const pendientes = trabajos.filter((t) => t.estatus === "pendiente").length;
    const enProgreso = trabajos.filter((t) => t.estatus === "en_progreso").length;
    const campamentos = new Set(trabajos.map((t) => t.centro_id)).size;
    const masViejos = [...trabajos]
      .sort((a, b) => a.reportada_dia.localeCompare(b.reportada_dia))
      .slice(0, 3);
    partes.push(
      [
        `**TRABAJOS EN LA RED (${n2(trabajos.length)} EN ${n2(campamentos)} CAMPAMENTOS):**`,
        `- ${n2(pendientes)} PENDIENTES · ${n2(enProgreso)} EN PROGRESO`,
        ...masViejos.map(
          (t) =>
            `- ${(nombreDe.get(t.centro_id) ?? t.centro_id).toUpperCase()} — ${t.titulo.toUpperCase()} (${META_ESTATUS_TRABAJO[t.estatus].label.toUpperCase()} · ${antiguedadTexto(t.reportada_dia, hoyClave)})`,
        ),
        ...(trabajos.length > 3 ? [`- (+${trabajos.length - 3} TRABAJOS MÁS)`] : []),
      ].join("\n"),
    );
  }

  // ---- Requerimientos abiertos (agrupados por categoría) ----
  if (requerimientosActivos.length > 0) {
    const etiquetas = new Map<string, string>(
      CATEGORIAS_REQUERIMIENTO.map((c) => [c.valor, c.label]),
    );
    const porCategoria = new Map<string, { items: number; cantidad: number }>();
    for (const r of requerimientosActivos) {
      const key = r.categoria;
      const acc = porCategoria.get(key) ?? { items: 0, cantidad: 0 };
      acc.items += 1;
      acc.cantidad += r.cantidad;
      porCategoria.set(key, acc);
    }
    partes.push(
      [
        `**REQUERIMIENTOS ABIERTOS (${n2(requerimientosActivos.length)} ÍTEMS):**`,
        ...[...porCategoria.entries()]
          .sort((a, b) => b[1].items - a[1].items)
          .map(
            ([cat, acc]) =>
              `- ${(etiquetas.get(cat) ?? cat).toUpperCase()}: ${n2(acc.items)} ÍTEM${acc.items === 1 ? "" : "S"} · ${acc.cantidad.toLocaleString("es")} UNIDADES`,
          ),
      ].join("\n"),
    );
  }

  // ---- Novedades del día ----
  const lineasNovedades: string[] = [];
  if (eventosDia.length > 0) {
    const visibles = eventosDia.slice(0, MAX_LISTADO);
    lineasNovedades.push(
      ...visibles.map(
        (e) => `- ${(nombreDe.get(e.centro_id) ?? e.centro_id).toUpperCase()}: ${e.titulo}`,
      ),
    );
    if (eventosDia.length > MAX_LISTADO) {
      lineasNovedades.push(`- (+${eventosDia.length - MAX_LISTADO} NOVEDADES MÁS)`);
    }
  } else {
    lineasNovedades.push("- SIN NOVEDADES REGISTRADAS EN LA RED.");
  }
  if (incidenciasAbiertas !== undefined) {
    lineasNovedades.push(`- INCIDENCIAS ABIERTAS: ${n2(incidenciasAbiertas)}`);
  }
  partes.push(["**NOVEDADES DEL DÍA:**", ...lineasNovedades].join("\n"));

  // ---- Campamentos sin parte del día ----
  const sinParte = centros.filter((c) => !conParteDelDia.has(c.id));
  const sinParteUnidades = totalCampamentos - conParteUnidades;
  if (sinParte.length === 0) {
    partes.push("**CAMPAMENTOS SIN PARTE DEL DÍA:**\n- NINGUNO. TODA LA RED REPORTÓ.");
  } else {
    const visibles = sinParte.slice(0, MAX_LISTADO);
    partes.push(
      [
        `**CAMPAMENTOS SIN PARTE DEL DÍA (${n2(sinParteUnidades)}/${n2(totalCampamentos)}):**`,
        visibles.map((c) => c.nombre.toUpperCase()).join(", ") +
          (sinParte.length > MAX_LISTADO ? ` (+${sinParte.length - MAX_LISTADO} MÁS)` : ""),
      ].join("\n"),
    );
  }

  partes.push(`\`REF: RED-CARACAS | ${dia}\``);

  return partes.join("\n\n");
}
