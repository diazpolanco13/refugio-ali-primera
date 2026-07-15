// PDF de estatus del censo nominal (red): KPIs + listas por estado.
// Reutiliza logos y franja institucional del parte ejecutivo.

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  estadoCensoNominalRed,
  type EstadoCensoNominalRed,
  type ResumenCensoNominalCentro,
} from "@/domain/censoNominalRed";
import { totalUnidadesConteo } from "@/domain/complejosCentros";
import type { MembreteListo } from "@/lib/imagenPdf";

const azul = "#0f2f3f";
const azulInstitucional = "#0b1c2e";
const oroInstitucional = "#d4af37";
const teal = "#0f766e";
const verde = "#047857";
const ambar = "#b45309";
const rojo = "#b91c1c";
const gris = "#64748b";
const borde = "#d8e2ea";
const fondoSuave = "#f4f8fb";

const MESES_MILITAR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function n(valor: number): string {
  return valor.toLocaleString("es-VE");
}

function pctClamp(valor: number): number {
  return Math.max(0, Math.min(100, Math.round(valor)));
}

function fechaHoraMilitar(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const mon = MESES_MILITAR[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${hh}${mm}${mon}${yy}`;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 28,
    backgroundColor: "#ffffff",
    color: "#10212b",
    fontFamily: "Helvetica",
    fontSize: 8,
  },
  contenido: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  franja: {
    backgroundColor: azulInstitucional,
    borderTopWidth: 3,
    borderTopColor: oroInstitucional,
    borderBottomWidth: 1.5,
    borderBottomColor: oroInstitucional,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  franjaLado: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1.15,
    minWidth: 0,
  },
  franjaLadoDerecho: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1.15,
    minWidth: 0,
  },
  franjaCentro: {
    flex: 0.9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  logoSebin: {
    width: 48,
    height: 32,
    objectFit: "contain",
  },
  logoSae: {
    width: 34,
    height: 34,
    objectFit: "contain",
  },
  franjaTextoIzq: {
    marginLeft: 8,
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  franjaTextoDer: {
    marginRight: 8,
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: 700,
    textAlign: "right",
    lineHeight: 1.25,
  },
  franjaSubrayado: {
    marginTop: 3,
    height: 1,
    backgroundColor: oroInstitucional,
    width: "100%",
  },
  dtgCaja: {
    borderWidth: 1,
    borderColor: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dtgTexto: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  tituloBloque: {
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: azulInstitucional,
  },
  tituloBloqueTexto: {
    color: oroInstitucional,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  kpiCard: {
    flex: 1,
    marginRight: 5,
    padding: 6,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 6,
    backgroundColor: "#fbfdff",
  },
  kpiCardLast: {
    marginRight: 0,
  },
  kpiLabel: {
    color: gris,
    fontSize: 6.5,
    fontWeight: 700,
  },
  kpiValue: {
    marginTop: 2,
    color: azul,
    fontSize: 14,
    fontWeight: 700,
  },
  seccion: {
    marginBottom: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  seccionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: borde,
  },
  seccionTitulo: {
    color: azul,
    fontSize: 8.5,
    fontWeight: 700,
  },
  seccionConteo: {
    color: gris,
    fontSize: 7,
    fontWeight: 700,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8eef3",
  },
  filaNombre: {
    flex: 2.2,
    minWidth: 0,
    paddingRight: 6,
  },
  nombreTexto: {
    color: azul,
    fontSize: 7.5,
    fontWeight: 700,
  },
  demoTexto: {
    marginTop: 1,
    color: gris,
    fontSize: 5.8,
  },
  filaUnidad: {
    width: 72,
    paddingRight: 4,
    color: teal,
    fontSize: 6.5,
    fontWeight: 700,
  },
  filaParte: {
    width: 48,
    textAlign: "right",
    color: gris,
    fontSize: 7,
    fontWeight: 700,
  },
  filaCensados: {
    width: 54,
    textAlign: "right",
    color: azul,
    fontSize: 7,
    fontWeight: 700,
  },
  filaProgreso: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 6,
  },
  barraTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: fondoSuave,
    borderWidth: 0.5,
    borderColor: borde,
    overflow: "hidden",
  },
  barraFill: {
    height: "100%",
    borderRadius: 3,
  },
  pctTexto: {
    marginTop: 1,
    color: gris,
    fontSize: 6,
    fontWeight: 700,
    textAlign: "right",
  },
  vacio: {
    color: gris,
    fontSize: 7,
    fontStyle: "italic",
    paddingVertical: 4,
  },
  pie: {
    position: "absolute",
    bottom: 10,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pieTexto: {
    color: gris,
    fontSize: 6,
  },
});

function EncabezadoInstitucional({
  generadoTs,
  membrete,
}: {
  generadoTs: number;
  membrete: MembreteListo;
}) {
  return (
    <View style={styles.franja} fixed>
      <View style={styles.franjaLado}>
        {membrete.izqLogo ? (
          <Image src={membrete.izqLogo} style={styles.logoSebin} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          {membrete.izqLineas.map((linea) => (
            <Text key={linea} style={styles.franjaTextoIzq}>
              {linea}
            </Text>
          ))}
          {membrete.izqLineas.length > 0 && <View style={styles.franjaSubrayado} />}
        </View>
      </View>

      <View style={styles.franjaCentro}>
        <View style={styles.dtgCaja}>
          <Text style={styles.dtgTexto}>{fechaHoraMilitar(generadoTs)}</Text>
        </View>
      </View>

      <View style={styles.franjaLadoDerecho}>
        <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
          {membrete.derLineas.map((linea) => (
            <Text key={linea} style={styles.franjaTextoDer}>
              {linea}
            </Text>
          ))}
          {membrete.derLineas.length > 0 && <View style={styles.franjaSubrayado} />}
        </View>
        {membrete.derLogo ? (
          <Image src={membrete.derLogo} style={styles.logoSae} />
        ) : null}
      </View>
    </View>
  );
}

function ordenarPorNroNombre(items: ResumenCensoNominalCentro[]): ResumenCensoNominalCentro[] {
  return [...items].sort(
    (a, b) =>
      (a.nro ?? 9999) - (b.nro ?? 9999) ||
      a.centroNombre.localeCompare(b.centroNombre, "es"),
  );
}

function colorBarra(estado: EstadoCensoNominalRed): string {
  switch (estado) {
    case "meta_alcanzada":
      return verde;
    case "en_curso":
      return teal;
    case "discrepancia":
      return rojo;
    case "sin_iniciar":
    default:
      return gris;
  }
}

function tituloCentro(r: ResumenCensoNominalCentro): string {
  return r.nro != null ? `N.° ${r.nro} · ${r.centroNombre}` : r.centroNombre;
}

function textoDemografia(r: ResumenCensoNominalCentro): string {
  const partes: string[] = [];
  if (r.familias > 0) {
    partes.push(
      r.metaFamilias > 0
        ? `Fam ${n(r.familias)}/${n(r.metaFamilias)}`
        : `Fam ${n(r.familias)}`,
    );
  }
  if (r.mujeres > 0) partes.push(`Muj ${n(r.mujeres)}`);
  if (r.hombres > 0) partes.push(`Hom ${n(r.hombres)}`);
  if (r.menores > 0) partes.push(`Men ${n(r.menores)}`);
  if (r.embarazadas > 0) partes.push(`Emb ${n(r.embarazadas)}`);
  if (r.discapacidad > 0) partes.push(`Disc ${n(r.discapacidad)}`);
  if (r.adultosMayores > 0) partes.push(`60+ ${n(r.adultosMayores)}`);
  if (r.conEnfermedad > 0) partes.push(`Enf ${n(r.conEnfermedad)}`);
  return partes.length > 0 ? partes.join(" · ") : "Sin demografía nominal";
}

function FilaCentro({ resumen }: { resumen: ResumenCensoNominalCentro }) {
  const estado = estadoCensoNominalRed(resumen);
  const porcentaje =
    resumen.metaRefugiados > 0
      ? pctClamp(resumen.pctRefugiados)
      : resumen.registrados > 0
        ? 100
        : 0;

  return (
    <View style={styles.fila} wrap={false}>
      <View style={styles.filaNombre}>
        <Text style={styles.nombreTexto}>{tituloCentro(resumen)}</Text>
        <Text style={styles.demoTexto}>{textoDemografia(resumen)}</Text>
      </View>
      <Text style={styles.filaUnidad}>
        {resumen.unidadSebin.trim() || "—"}
      </Text>
      <Text style={styles.filaParte}>
        {resumen.metaRefugiados > 0 ? n(resumen.metaRefugiados) : "—"}
      </Text>
      <Text style={styles.filaCensados}>{n(resumen.registrados)}</Text>
      <View style={styles.filaProgreso}>
        <View style={styles.barraTrack}>
          <View
            style={[
              styles.barraFill,
              {
                width: `${porcentaje}%`,
                backgroundColor: colorBarra(estado),
              },
            ]}
          />
        </View>
        <Text style={styles.pctTexto}>{porcentaje}%</Text>
      </View>
    </View>
  );
}

function EncabezadoColumnas() {
  return (
    <View style={[styles.fila, { borderBottomWidth: 1, borderBottomColor: borde }]}>
      <View style={styles.filaNombre}>
        <Text style={styles.kpiLabel}>Campamento</Text>
      </View>
      <Text style={[styles.filaUnidad, styles.kpiLabel]}>Unidad SEBIN</Text>
      <Text style={[styles.filaParte, styles.kpiLabel]}>Parte</Text>
      <Text style={[styles.filaCensados, styles.kpiLabel]}>Censados</Text>
      <View style={styles.filaProgreso}>
        <Text style={[styles.kpiLabel, { textAlign: "right" }]}>Progreso</Text>
      </View>
    </View>
  );
}

function SeccionLista({
  titulo,
  items,
  tint,
}: {
  titulo: string;
  items: ResumenCensoNominalCentro[];
  tint?: boolean;
}) {
  return (
    <View style={tint ? [styles.seccion, { backgroundColor: fondoSuave }] : styles.seccion} wrap>
      <View style={styles.seccionHeader}>
        <Text style={styles.seccionTitulo}>{titulo}</Text>
        <Text style={styles.seccionConteo}>
          {items.length} campamento{items.length === 1 ? "" : "s"}
        </Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.vacio}>Sin campamentos en esta categoría.</Text>
      ) : (
        <>
          <EncabezadoColumnas />
          {ordenarPorNroNombre(items).map((r) => (
            <FilaCentro key={r.centroId} resumen={r} />
          ))}
        </>
      )}
    </View>
  );
}

function KpiCard({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: number;
  accent?: string;
  last?: boolean;
}) {
  return (
    <View style={last ? [styles.kpiCard, styles.kpiCardLast] : styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={accent ? [styles.kpiValue, { color: accent }] : styles.kpiValue}>
        {n(value)}
      </Text>
    </View>
  );
}

export interface DatosReporteEstatusCenso {
  resumenes: ResumenCensoNominalCentro[];
  generadoTs: number;
  generadoPor?: string;
}

export function ReporteEstatusCensoRedPdf({
  datos,
  membrete,
}: {
  datos: DatosReporteEstatusCenso;
  membrete: MembreteListo;
}) {
  const { resumenes, generadoTs, generadoPor } = datos;

  const completados = resumenes.filter(
    (r) => estadoCensoNominalRed(r) === "meta_alcanzada",
  );
  const enProgreso = resumenes.filter((r) => estadoCensoNominalRed(r) === "en_curso");
  const sinIniciar = resumenes.filter(
    (r) => estadoCensoNominalRed(r) === "sin_iniciar",
  );
  const discrepancias = resumenes.filter(
    (r) => estadoCensoNominalRed(r) === "discrepancia",
  );

  const totalPersonas = resumenes.reduce((acc, r) => acc + r.registrados, 0);
  const totalParte = resumenes.reduce((acc, r) => acc + r.metaRefugiados, 0);
  // Gran Colombia (y otros complejos): varios edificios = 1 campamento en totales.
  const totalCampamentos = totalUnidadesConteo(
    resumenes.map((r) => ({ id: r.centroId, complejoId: r.complejoId })),
  );
  const edificios = resumenes.length;

  return (
    <Document
      title="Estatus del censo nominal — red de campamentos"
      author={generadoPor ?? "Sala de Análisis Estratégico"}
      subject="Progreso del censo nominal vs parte declarado"
      creator="Campamentos Transitorios"
      producer="@react-pdf/renderer"
      language="es-VE"
    >
      <Page size="LETTER" style={styles.page}>
        <EncabezadoInstitucional generadoTs={generadoTs} membrete={membrete} />

        <View style={styles.contenido}>
          <View style={styles.tituloBloque}>
            <Text style={styles.tituloBloqueTexto}>
              SALA SITUACIONAL — ESTATUS DEL CENSO NOMINAL (RED)
            </Text>
          </View>

          <View style={styles.kpiRow}>
            <KpiCard label="Campamentos" value={totalCampamentos} />
            <KpiCard
              label="Cuadran con parte"
              value={completados.length}
              accent={verde}
            />
            <KpiCard label="En progreso" value={enProgreso.length} accent={teal} last />
          </View>
          <View style={styles.kpiRow}>
            <KpiCard label="Sin iniciar" value={sinIniciar.length} accent={gris} />
            <KpiCard
              label="Discrepancia"
              value={discrepancias.length}
              accent={discrepancias.length > 0 ? rojo : gris}
            />
            <KpiCard
              label={totalParte > 0 ? "Censados (red)" : "Censados"}
              value={totalPersonas}
              accent={ambar}
              last
            />
          </View>

          {edificios !== totalCampamentos ? (
            <Text style={{ color: gris, fontSize: 6.5, marginBottom: 2 }}>
              {n(edificios)} edificios operativos · {n(totalCampamentos)} unidades
              (complejos como Gran Colombia = 1)
            </Text>
          ) : null}

          {totalParte > 0 ? (
            <Text style={{ color: gris, fontSize: 6.5, marginBottom: 6 }}>
              Parte declarado (suma red): {n(totalParte)} · avance global:{" "}
              {pctClamp((totalPersonas / totalParte) * 100)}%
            </Text>
          ) : null}

          <SeccionLista
            titulo="1. Campamentos completados (coinciden con el parte)"
            items={completados}
          />
          <SeccionLista
            titulo="2. Campamentos con censo en progreso"
            items={enProgreso}
            tint
          />
          <SeccionLista
            titulo="3. Campamentos con censo sin iniciar"
            items={sinIniciar}
          />
          {discrepancias.length > 0 ? (
            <SeccionLista
              titulo="4. Campamentos con discrepancia (censo supera el parte)"
              items={discrepancias}
              tint
            />
          ) : null}
        </View>

        <View style={styles.pie} fixed>
          <Text style={styles.pieTexto}>
            Censo nominal vs parte · {fechaHoraMilitar(generadoTs)}
          </Text>
          <Text
            style={styles.pieTexto}
            render={({ pageNumber, totalPages }) =>
              `Pág. ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
