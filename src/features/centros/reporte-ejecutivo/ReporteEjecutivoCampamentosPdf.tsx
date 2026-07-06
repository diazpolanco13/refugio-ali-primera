import type { ReactNode } from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ETIQUETA_NIVEL, type NivelPrioridad } from "@/domain/prioridadCentros";
import type { ReporteEjecutivoCampamentos } from "@/domain/reporteEjecutivoCampamentos";

const azul = "#0f2f3f";
const teal = "#0f766e";
const verde = "#047857";
const ambar = "#b45309";
const rojo = "#b91c1c";
const gris = "#64748b";
const borde = "#d8e2ea";
const fondoSuave = "#f4f8fb";

const COLOR_NIVEL_PDF: Record<NivelPrioridad, string> = {
  critico: rojo,
  alto: "#c2410c",
  medio: ambar,
  estable: verde,
  sin_datos: gris,
};

const styles = StyleSheet.create({
  page: {
    padding: 22,
    backgroundColor: "#ffffff",
    color: "#10212b",
    fontFamily: "Helvetica",
    fontSize: 8.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: teal,
  },
  eyebrow: {
    color: teal,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 2,
    color: azul,
    fontSize: 21,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 3,
    color: gris,
    fontSize: 9,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e6f5f2",
    color: teal,
    fontSize: 8,
    fontWeight: 700,
  },
  smallMuted: {
    marginTop: 4,
    color: gris,
    fontSize: 7.5,
  },
  kpiRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  kpiRowTight: {
    flexDirection: "row",
    marginTop: 7,
  },
  kpiCard: {
    flex: 1,
    marginRight: 7,
    padding: 9,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 10,
    backgroundColor: "#fbfdff",
  },
  kpiCardCompact: {
    padding: 7,
    borderRadius: 9,
  },
  kpiCardLast: {
    marginRight: 0,
  },
  kpiLabel: {
    color: gris,
    fontSize: 7.5,
    fontWeight: 700,
  },
  kpiValue: {
    marginTop: 5,
    color: azul,
    fontSize: 18,
    fontWeight: 700,
  },
  kpiValueCompact: {
    marginTop: 3,
    fontSize: 15,
  },
  kpiSub: {
    marginTop: 2,
    color: gris,
    fontSize: 7.5,
  },
  kpiSubCompact: {
    fontSize: 6.7,
  },
  body: {
    flexDirection: "row",
    marginTop: 10,
  },
  column: {
    flex: 1,
    marginRight: 9,
  },
  columnWide: {
    flex: 1.14,
    marginRight: 9,
  },
  columnLast: {
    marginRight: 0,
  },
  section: {
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 11,
    backgroundColor: "#ffffff",
  },
  sectionTint: {
    backgroundColor: fondoSuave,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  sectionTitle: {
    color: azul,
    fontSize: 10.5,
    fontWeight: 700,
  },
  sectionHint: {
    color: gris,
    fontSize: 7.5,
  },
  metric: {
    marginBottom: 6,
  },
  metricLabel: {
    color: gris,
    fontSize: 7.4,
  },
  metricValue: {
    marginTop: 1,
    color: azul,
    fontSize: 12,
    fontWeight: 700,
  },
  barTrack: {
    height: 6,
    marginTop: 3,
    borderRadius: 999,
    backgroundColor: "#e5edf2",
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 999,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  rowLabel: {
    color: "#334155",
    fontSize: 8,
  },
  rowValue: {
    color: azul,
    fontSize: 8,
    fontWeight: 700,
  },
  miniGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  statCard: {
    width: "48%",
    marginRight: 5,
    marginBottom: 6,
    padding: 7,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 8,
    backgroundColor: "#fbfdff",
  },
  statCardWide: {
    width: "100%",
    marginRight: 0,
  },
  statLabel: {
    color: gris,
    fontSize: 7,
    fontWeight: 700,
  },
  statValue: {
    marginTop: 3,
    color: azul,
    fontSize: 14,
    fontWeight: 700,
  },
  statSub: {
    marginTop: 2,
    color: gris,
    fontSize: 7,
  },
  miniBox: {
    width: "50%",
    paddingRight: 5,
    marginBottom: 5,
  },
  miniLabel: {
    color: gris,
    fontSize: 7,
  },
  miniValue: {
    color: azul,
    fontSize: 10,
    fontWeight: 700,
  },
  topItem: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e6eef3",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    marginRight: 5,
    borderRadius: 999,
  },
  topTitle: {
    flex: 1,
    color: azul,
    fontSize: 8.2,
    fontWeight: 700,
  },
  topMeta: {
    marginTop: 2,
    color: gris,
    fontSize: 7,
  },
  factor: {
    marginTop: 2,
    color: "#475569",
    fontSize: 7,
  },
  cuerpoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cuerpoItem: {
    width: "48%",
    marginRight: 5,
    marginBottom: 6,
  },
  cuerpoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  cuerpoLabel: {
    maxWidth: "65%",
    color: "#334155",
    fontSize: 7.2,
  },
  cuerpoValue: {
    color: azul,
    fontSize: 7.2,
    fontWeight: 700,
  },
  cuerpoBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#e5edf2",
    overflow: "hidden",
  },
  cuerpoFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: teal,
  },
  footer: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: borde,
    paddingTop: 6,
    color: gris,
    fontSize: 7,
  },
});

function n(valor: number): string {
  return valor.toLocaleString("es-VE");
}

function pct(valor: number): string {
  return `${Math.max(0, Math.min(100, valor))}%`;
}

function fechaCorte(dia: string): string {
  const [year, month, day] = dia.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function horaGeneracion(ts: number): string {
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function Kpi({
  label,
  value,
  sub,
  last,
  compact,
}: {
  label: string;
  value: number;
  sub?: string;
  last?: boolean;
  compact?: boolean;
}) {
  const cardStyles =
    compact && last
      ? [styles.kpiCard, styles.kpiCardCompact, styles.kpiCardLast]
      : compact
        ? [styles.kpiCard, styles.kpiCardCompact]
        : last
          ? [styles.kpiCard, styles.kpiCardLast]
          : styles.kpiCard;
  return (
    <View style={cardStyles}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={compact ? [styles.kpiValue, styles.kpiValueCompact] : styles.kpiValue}>
        {n(value)}
      </Text>
      {sub ? (
        <Text style={compact ? [styles.kpiSub, styles.kpiSubCompact] : styles.kpiSub}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function StatCard({
  label,
  value,
  sub,
  wide,
}: {
  label: string;
  value: number;
  sub?: string;
  wide?: boolean;
}) {
  return (
    <View style={wide ? [styles.statCard, styles.statCardWide] : styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{n(value)}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function Section({
  title,
  hint,
  tint,
  children,
}: {
  title: string;
  hint?: string;
  tint?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={tint ? [styles.section, styles.sectionTint] : styles.section} wrap={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Barra({
  label,
  value,
  total,
  color = teal,
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const porcentaje = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.metric}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>
          {n(value)} / {n(total)} ({porcentaje}%)
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: pct(porcentaje), backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MiniDato({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniBox}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{n(value)}</Text>
    </View>
  );
}

function CuerpoItem({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const porcentaje = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.cuerpoItem}>
      <View style={styles.cuerpoTop}>
        <Text style={styles.cuerpoLabel}>{label}</Text>
        <Text style={styles.cuerpoValue}>
          {value}/{total}
        </Text>
      </View>
      <View style={styles.cuerpoBar}>
        <View style={[styles.cuerpoFill, { width: pct(porcentaje) }]} />
      </View>
    </View>
  );
}

export function ReporteEjecutivoCampamentosPdf({
  reporte,
}: {
  reporte: ReporteEjecutivoCampamentos;
}) {
  const dem = reporte.demografia;
  const totalGenero = Math.max(1, dem.hombres + dem.mujeres);
  const resumen = reporte.resumenDia;

  return (
    <Document
      title={`Parte Global de Campamentos - ${reporte.dia}`}
      author={reporte.generadoPor}
      subject="Parte ejecutivo de campamentos transitorios"
      creator="Campamentos Transitorios"
      producer="@react-pdf/renderer"
      language="es-VE"
    >
      <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SALA SITUACIONAL - CORTE EJECUTIVO</Text>
            <Text style={styles.title}>Parte Global de Campamentos Transitorios</Text>
            <Text style={styles.subtitle}>
              Área Metropolitana de Caracas - corte del {fechaCorte(reporte.dia)}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.pill}>Reporte del día</Text>
            <Text style={styles.smallMuted}>Generado: {horaGeneracion(reporte.generadoTs)}</Text>
            <Text style={styles.smallMuted}>Responsable: {reporte.generadoPor}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <Kpi label="Campamentos" value={reporte.kpis.centrosTotal} sub={`${reporte.kpis.centrosConDatos} con datos`} />
          <Kpi label="Familias" value={reporte.kpis.familiasTotal} />
          <Kpi label="Refugiados" value={reporte.kpis.refugiadosTotal} />
          <Kpi label="Personal operativo" value={reporte.kpis.personalTotal} />
          <Kpi label="Mascotas" value={reporte.kpis.mascotasTotal} last />
        </View>

        <View style={styles.kpiRowTight}>
          <Kpi
            label="Agua potable"
            value={reporte.logistica.aguaPotableL}
            sub="L/día · bebida y cocina"
            compact
          />
          <Kpi
            label="Agua uso cotidiano"
            value={reporte.logistica.aguaUsoCotidianoL}
            sub="L/día · aseo, pocetas, lavado"
            compact
          />
          <Kpi
            label="Comidas requeridas"
            value={reporte.logistica.objetivoRaciones}
            sub="3 raciones/persona/día"
            compact
          />
          <Kpi
            label="Comida repartida"
            value={reporte.logistica.racionesGestionadas}
            sub={`${resumen.campamentosConComida} campamentos con comida`}
            compact
          />
          <Kpi
            label="Trabajos realizados"
            value={resumen.trabajosRealizados}
            sub={`${resumen.campamentosConTrabajo} campamentos atendidos`}
            last
            compact
          />
        </View>

        <View style={styles.body}>
          <View style={styles.column}>
            <Section title="Parte demográfico" hint={`${n(dem.total)} personas`}>
              <Barra label="Hombres" value={dem.hombres} total={totalGenero} color="#2563eb" />
              <Barra label="Mujeres" value={dem.mujeres} total={totalGenero} color="#be185d" />
              <View style={styles.miniGrid}>
                <MiniDato label="0-2 años" value={dem.recienNacidos} />
                <MiniDato label="Niñez" value={dem.ninos} />
                <MiniDato label="Adolescentes" value={dem.adolescentes} />
                <MiniDato label="Adultos mayores" value={dem.adultosMayores} />
                <MiniDato label="Embarazadas" value={dem.embarazadas} />
                <MiniDato label="Discapacidad/patologías" value={dem.discapacidad} />
              </View>
            </Section>

            <Section title="Personal desplegado" hint={`${n(reporte.personal.total)} personas`}>
              <View style={styles.miniGrid}>
                <MiniDato label="Funcionarios" value={reporte.personal.funcionarios} />
                <MiniDato label="Trabajadores" value={reporte.personal.trabajadores} />
                <MiniDato label="Médicos" value={reporte.personal.medicos} />
                <MiniDato label="Psicólogos" value={reporte.personal.psicologos} />
                <MiniDato label="Justicia" value={reporte.personal.justicia} />
                <MiniDato label="Total operativo" value={reporte.personal.total} />
              </View>
            </Section>
          </View>

          <View style={styles.columnWide}>
            <Section title="Resumen operativo del día" hint="eventos, salud, comida y trabajos" tint>
              <View style={styles.miniGrid}>
                <StatCard label="Incidentes positivos" value={resumen.eventosPositivos} />
                <StatCard label="Incidentes negativos" value={resumen.eventosNegativos} />
                <StatCard label="Incidencias de salud" value={resumen.incidenciasSalud} />
                <StatCard label="Atenciones de salud" value={resumen.atencionesSalud} />
                <StatCard
                  label="Comida repartida"
                  value={reporte.logistica.racionesGestionadas}
                  sub={`${reporte.logistica.coberturaRaciones}% del requerimiento`}
                />
                <StatCard label="Trabajos realizados" value={resumen.trabajosRealizados} />
              </View>
            </Section>

            <Section title="Atención inmediata" hint="top 5">
              {reporte.prioridades.length === 0 ? (
                <Text style={styles.rowLabel}>Sin campamentos registrados.</Text>
              ) : (
                reporte.prioridades.map((item) => (
                  <View key={`${item.nro ?? "s/n"}-${item.nombre}`} style={styles.topItem}>
                    <View style={styles.topHeader}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: COLOR_NIVEL_PDF[item.nivel] },
                        ]}
                      />
                      <Text style={styles.topTitle}>
                        {item.nro != null ? `N.${item.nro} ` : ""}
                        {item.nombre}
                      </Text>
                    </View>
                    <Text style={styles.topMeta}>
                      {ETIQUETA_NIVEL[item.nivel]} - {n(item.refugiados)} refug. -{" "}
                      {n(item.familias)} familias
                    </Text>
                    {item.factores.length > 0 ? (
                      <Text style={styles.factor}>{item.factores.join(" · ")}</Text>
                    ) : (
                      <Text style={styles.factor}>Sin factores críticos registrados.</Text>
                    )}
                  </View>
                ))
              )}
            </Section>
          </View>

          <View style={[styles.column, styles.columnLast]}>
            <Section title="Distribución territorial" hint="por grupo">
              {reporte.grupos.map((grupo) => (
                <View key={grupo.grupo} style={styles.row}>
                  <Text style={styles.rowLabel}>{grupo.grupo}</Text>
                  <Text style={styles.rowValue}>
                    {n(grupo.refugiados)} refug. - {grupo.campamentos} camp.
                  </Text>
                </View>
              ))}
            </Section>

            <Section title="Campamentos por cuerpo policial" hint={`${n(reporte.kpis.centrosTotal)} campamentos`}>
              <View style={styles.cuerpoGrid}>
                {reporte.cuerpos.map((cuerpo) => (
                  <CuerpoItem
                    key={cuerpo.cuerpo}
                    label={cuerpo.cuerpo}
                    value={cuerpo.campamentos}
                    total={reporte.kpis.centrosTotal}
                  />
                ))}
              </View>
            </Section>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Fuente: Supabase - datos operativos de campamentos en tiempo real.</Text>
          <Text>Uso institucional - no contiene datos nominales de población.</Text>
        </View>
      </Page>
    </Document>
  );
}
