import type { ReactNode } from "react";
import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReporteEjecutivoCampamentos } from "@/domain/reporteEjecutivoCampamentos";

const azul = "#0f2f3f";
const azulInstitucional = "#0b1c2e";
const oroInstitucional = "#d4af37";
const verdeOcupacion = "#22c55e";
const grisOcupacion = "#64748b";
const teal = "#0f766e";
const verde = "#047857";
const ambar = "#b45309";
const rojo = "#b91c1c";
const gris = "#64748b";
const borde = "#d8e2ea";
const fondoSuave = "#f4f8fb";

const LOGO_SEBIN = "/logos/logo-sebin.png";
const LOGO_SAE = "/logos/logo-sae.png";

function urlPublica(ruta: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${ruta}`;
  }
  return ruta;
}

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

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 26,
    backgroundColor: "#ffffff",
    color: "#10212b",
    fontFamily: "Helvetica",
    fontSize: 7.5,
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
    marginBottom: 2,
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: teal,
  },
  eyebrow: {
    color: teal,
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 1,
    color: azul,
    fontSize: 14,
    fontWeight: 700,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#e6f5f2",
    color: teal,
    fontSize: 6.5,
    fontWeight: 700,
  },
  smallMuted: {
    marginTop: 2,
    color: gris,
    fontSize: 6.5,
  },
  kpiRow: {
    flexDirection: "row",
    marginTop: 5,
  },
  kpiRowTight: {
    flexDirection: "row",
    marginTop: 4,
  },
  ocupacionRow: {
    marginTop: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 6,
    backgroundColor: fondoSuave,
  },
  ocupacionRowInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  ocupacionChart: {
    marginRight: 8,
  },
  ocupacionBarras: {
    flex: 1,
    minWidth: 0,
  },
  ocupacionTitulo: {
    color: azul,
    fontSize: 6.5,
    fontWeight: 700,
    marginBottom: 2,
  },
  kpiCard: {
    flex: 1,
    marginRight: 5,
    padding: 5,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 6,
    backgroundColor: "#fbfdff",
  },
  kpiCardCompact: {
    padding: 4,
    borderRadius: 6,
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
    marginTop: 2,
    color: azul,
    fontSize: 15,
    fontWeight: 700,
  },
  kpiValueCompact: {
    marginTop: 1,
    fontSize: 13,
  },
  kpiSub: {
    marginTop: 1,
    color: gris,
    fontSize: 6.5,
  },
  kpiSubCompact: {
    fontSize: 6.2,
  },
  body: {
    flexDirection: "row",
    marginTop: 5,
    alignItems: "flex-start",
  },
  column: {
    flex: 1,
    marginRight: 6,
    minWidth: 0,
  },
  columnWide: {
    flex: 1.1,
    marginRight: 6,
    minWidth: 0,
  },
  columnLast: {
    marginRight: 0,
  },
  section: {
    marginBottom: 4,
    padding: 5,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  sectionTint: {
    backgroundColor: fondoSuave,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  sectionTitle: {
    color: azul,
    fontSize: 8,
    fontWeight: 700,
  },
  sectionHint: {
    color: gris,
    fontSize: 6.5,
  },
  metric: {
    marginBottom: 3,
  },
  metricLabel: {
    color: gris,
    fontSize: 6.5,
  },
  metricValue: {
    marginTop: 1,
    color: azul,
    fontSize: 12,
    fontWeight: 700,
  },
  barTrack: {
    height: 4,
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: "#e5edf2",
    overflow: "hidden",
  },
  barFill: {
    height: 4,
    borderRadius: 999,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  rowLabel: {
    color: "#334155",
    fontSize: 6.5,
  },
  rowValue: {
    color: azul,
    fontSize: 6.5,
    fontWeight: 700,
  },
  miniGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  statCard: {
    width: "48%",
    marginRight: 4,
    marginBottom: 3,
    padding: 4,
    borderWidth: 1,
    borderColor: borde,
    borderRadius: 5,
    backgroundColor: "#fbfdff",
  },
  statCardWide: {
    width: "100%",
    marginRight: 0,
  },
  statLabel: {
    color: gris,
    fontSize: 6,
    fontWeight: 700,
  },
  statValue: {
    marginTop: 1,
    color: azul,
    fontSize: 11,
    fontWeight: 700,
  },
  statSub: {
    marginTop: 1,
    color: gris,
    fontSize: 6,
  },
  miniBox: {
    width: "50%",
    paddingRight: 4,
    marginBottom: 2,
  },
  miniLabel: {
    color: gris,
    fontSize: 6,
  },
  miniValue: {
    color: azul,
    fontSize: 8.5,
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
  tablaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 10,
    borderRadius: 7,
    backgroundColor: azul,
  },
  tablaHeaderCelda: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
  },
  tablaFila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e6eef3",
  },
  tablaFilaAlterna: {
    backgroundColor: fondoSuave,
  },
  celdaNombre: {
    color: azul,
    fontSize: 7.4,
    fontWeight: 700,
  },
  celdaSub: {
    color: gris,
    fontSize: 6.3,
  },
  celdaTexto: {
    color: "#334155",
    fontSize: 7.2,
  },
  celdaNumero: {
    color: azul,
    fontSize: 7.4,
    fontWeight: 700,
    textAlign: "right",
  },
  celdaCentro: {
    fontSize: 7.2,
    fontWeight: 700,
    textAlign: "center",
  },
  donutBloque: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  donutBloqueCompacto: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  donutTextos: {
    marginLeft: 6,
    flex: 1,
    minWidth: 0,
  },
  donutTitulo: {
    color: azul,
    fontSize: 7,
    fontWeight: 700,
  },
  donutLinea: {
    marginTop: 1,
    color: "#334155",
    fontSize: 6.2,
  },
  serieChart: {
    marginTop: 2,
    height: 78,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  serieEjeY: {
    width: 28,
    height: 78,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 3,
    paddingBottom: 14,
  },
  serieEjeYTexto: {
    color: gris,
    fontSize: 5.5,
  },
  serieBarras: {
    flex: 1,
    height: 78,
    flexDirection: "row",
    alignItems: "flex-end",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: borde,
    paddingLeft: 2,
  },
  serieCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    paddingHorizontal: 1,
  },
  serieValor: {
    color: azul,
    fontSize: 5.2,
    fontWeight: 700,
    marginBottom: 1,
  },
  serieBarra: {
    width: "72%",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  serieDia: {
    marginTop: 2,
    color: gris,
    fontSize: 5.2,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: borde,
    paddingTop: 4,
    color: gris,
    fontSize: 6,
  },
});

function n(valor: number): string {
  return valor.toLocaleString("es-VE");
}

function pct(valor: number): string {
  return `${Math.max(0, Math.min(100, valor))}%`;
}

/** Fecha-hora militar: DDHHMMMONYY (ej. 091430JUL26). */
function fechaHoraMilitar(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const mon = MESES_MILITAR[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${hh}${mm}${mon}${yy}`;
}

function fechaEtiquetaCorta(dia: string): string {
  const [, m, d] = dia.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const mes = meses[Number(m) - 1] ?? m;
  return `${Number(d)}-${mes}`;
}

function GraficoSerieSemanal({
  puntos,
  diaActivo,
}: {
  puntos: { dia: string; total: number }[];
  diaActivo: string;
}) {
  const max = Math.max(1, ...puntos.map((p) => p.total));
  const tope = Math.ceil(max / 1000) * 1000 || 1000;
  const ticks = [tope, Math.round(tope / 2), 0];
  const alturaMax = 52;

  return (
    <View style={styles.serieChart} wrap={false}>
      <View style={styles.serieEjeY}>
        {ticks.map((t) => (
          <Text key={t} style={styles.serieEjeYTexto}>
            {t >= 1000 ? `${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}k` : String(t)}
          </Text>
        ))}
      </View>
      <View style={styles.serieBarras}>
        {puntos.map((p) => {
          const h = Math.max(2, Math.round((p.total / tope) * alturaMax));
          const esHoy = p.dia === diaActivo;
          return (
            <View key={p.dia} style={styles.serieCol}>
              <Text style={styles.serieValor}>{n(p.total)}</Text>
              <View
                style={[
                  styles.serieBarra,
                  {
                    height: h,
                    backgroundColor: esHoy ? ambar : "#2563eb",
                  },
                ]}
              />
              <Text style={styles.serieDia}>{fechaEtiquetaCorta(p.dia)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EncabezadoInstitucional({ generadoTs }: { generadoTs: number }) {
  return (
    <View style={styles.franja} fixed>
      <View style={styles.franjaLado}>
        <Image src={urlPublica(LOGO_SEBIN)} style={styles.logoSebin} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.franjaTextoIzq}>Servicio Bolivariano de</Text>
          <Text style={styles.franjaTextoIzq}>Inteligencia Nacional</Text>
          <View style={styles.franjaSubrayado} />
        </View>
      </View>

      <View style={styles.franjaCentro}>
        <View style={styles.dtgCaja}>
          <Text style={styles.dtgTexto}>{fechaHoraMilitar(generadoTs)}</Text>
        </View>
      </View>

      <View style={styles.franjaLadoDerecho}>
        <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
          <Text style={styles.franjaTextoDer}>Sala de Análisis</Text>
          <Text style={styles.franjaTextoDer}>Estratégico</Text>
          <View style={styles.franjaSubrayado} />
        </View>
        <Image src={urlPublica(LOGO_SAE)} style={styles.logoSae} />
      </View>
    </View>
  );
}

/** Primera letra en mayúscula y el resto en minúsculas (español). */
function textoOracion(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase("es") + t.slice(1).toLocaleLowerCase("es");
}

function Kpi({
  label,
  value,
  sub,
  last,
  compact,
}: {
  label: string;
  value: number | string;
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
        {typeof value === "number" ? n(value) : value}
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
  fixed = false,
}: {
  title: string;
  hint?: string;
  tint?: boolean;
  children: ReactNode;
  /** Si es true, evita que la sección se parta entre páginas. */
  fixed?: boolean;
}) {
  return (
    <View
      style={tint ? [styles.section, styles.sectionTint] : styles.section}
      wrap={!fixed}
    >
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


const ANCHOS_TABLA = {
  nro: 0.4,
  campamento: 1.95,
  cuerpo: 1.1,
  damnif: 0.6,
  fam: 0.52,
  control: 1.0,
  trabajos: 1.75,
  salud: 1.55,
  noved: 1.55,
};

function TextoSiNo({ valor }: { valor: boolean | null }) {
  const texto = valor === null ? "—" : valor ? "SÍ" : "NO";
  const color = valor === null ? gris : valor ? verde : rojo;
  return <Text style={{ color, fontWeight: 700 }}>{texto}</Text>;
}

function arcoDonut(cx: number, cy: number, r: number, fraccion: number): string {
  const f = Math.max(0.0001, Math.min(fraccion, 0.9999));
  const a0 = -Math.PI / 2;
  const a1 = a0 + Math.PI * 2 * f;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const grande = f > 0.5 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function DonutOcupacion({
  activo,
  sinRefugiados,
  compact = false,
  mini = false,
}: {
  activo: number;
  sinRefugiados: number;
  total?: number;
  compact?: boolean;
  mini?: boolean;
}) {
  const suma = Math.max(1, activo + sinRefugiados);
  const fActivo = activo / suma;
  const r = mini ? 18 : 24;
  const grosor = mini ? 7 : 9;
  const svgSize = mini ? 46 : 62;
  const cx = svgSize / 2;
  return (
    <View style={mini ? [styles.donutBloque, { marginBottom: 0 }] : styles.donutBloque} wrap={false}>
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <Path
          d={arcoDonut(cx, cx, r, 0.9999)}
          stroke="#e5edf2"
          strokeWidth={grosor}
          fill="none"
        />
        {sinRefugiados > 0 ? (
          <Path
            d={arcoDonut(cx, cx, r, fActivo + sinRefugiados / suma)}
            stroke={grisOcupacion}
            strokeWidth={grosor}
            fill="none"
          />
        ) : null}
        {activo > 0 ? (
          <Path
            d={arcoDonut(cx, cx, r, fActivo)}
            stroke={verdeOcupacion}
            strokeWidth={grosor}
            fill="none"
          />
        ) : null}
      </Svg>
      {!compact ? (
        <View style={styles.donutTextos}>
          <Text style={styles.donutTitulo}>Ocupación de la red</Text>
          <Text style={[styles.donutLinea, { color: verdeOcupacion }]}>
            Activo: {n(activo)} ({Math.round(fActivo * 100)}%)
          </Text>
          <Text style={[styles.donutLinea, { color: grisOcupacion }]}>
            Sin damnificados: {n(sinRefugiados)} ({Math.round((sinRefugiados / suma) * 100)}%)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Donut({
  titulo,
  si,
  no,
  sinReporte,
  compact = false,
}: {
  titulo: string;
  si: number;
  no: number;
  sinReporte: number;
  compact?: boolean;
}) {
  const total = Math.max(1, si + no + sinReporte);
  const fSi = si / total;
  const fNo = no / total;
  const r = compact ? 16 : 24;
  const grosor = compact ? 6 : 9;
  const svgSize = compact ? 44 : 62;
  const cx = svgSize / 2;
  return (
    <View style={compact ? styles.donutBloqueCompacto : styles.donutBloque} wrap={false}>
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <Path
          d={arcoDonut(cx, cx, r, 0.9999)}
          stroke="#e5edf2"
          strokeWidth={grosor}
          fill="none"
        />
        {fNo > 0 ? (
          <Path
            d={arcoDonut(cx, cx, r, fSi + fNo)}
            stroke={rojo}
            strokeWidth={grosor}
            fill="none"
          />
        ) : null}
        {fSi > 0 ? (
          <Path d={arcoDonut(cx, cx, r, fSi)} stroke={verde} strokeWidth={grosor} fill="none" />
        ) : null}
      </Svg>
      <View style={styles.donutTextos}>
        <Text style={styles.donutTitulo}>{titulo}</Text>
        <Text style={[styles.donutLinea, { color: verde }]}>SÍ: {n(si)} ({Math.round(fSi * 100)}%)</Text>
        <Text style={[styles.donutLinea, { color: rojo }]}>NO: {n(no)} ({Math.round(fNo * 100)}%)</Text>
        {!compact ? (
          <Text style={styles.donutLinea}>Sin reporte: {n(sinReporte)}</Text>
        ) : (
          <Text style={styles.donutLinea}>S/r: {n(sinReporte)}</Text>
        )}
      </View>
    </View>
  );
}

const META_ESTATUS_CASO_PDF: Record<string, { label: string; color: string }> = {
  activo: { label: "Activo", color: rojo },
  en_proceso: { label: "En proceso", color: ambar },
};

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
      <Page size="LETTER" orientation="landscape" style={styles.page} wrap={false}>
        <EncabezadoInstitucional generadoTs={reporte.generadoTs} />

        <View style={styles.contenido}>
          <View style={styles.tituloBloque}>
            <Text style={styles.tituloBloqueTexto}>
              SALA SITUACIONAL — PARTE GLOBAL DE CAMPAMENTOS TRANSITORIOS
            </Text>
          </View>

        <View style={styles.kpiRow}>
          <Kpi label="Campamentos" value={reporte.kpis.centrosTotal} sub={`${reporte.kpis.centrosConDatos} con datos`} />
          <Kpi label="Familias" value={reporte.kpis.familiasTotal} />
          <Kpi label="Damnificados" value={reporte.kpis.refugiadosTotal} />
          <Kpi label="Mascotas" value={reporte.kpis.mascotasTotal} last />
        </View>

        <View style={styles.kpiRowTight}>
          <Kpi
            label="Reportes del día"
            value={`${n(reporte.partesDelDia)}/${n(reporte.kpis.centrosTotal)}`}
            sub={`${reporte.kpis.centrosTotal > 0 ? Math.round((reporte.partesDelDia / reporte.kpis.centrosTotal) * 100) : 0}% entregó parte`}
            compact
          />
          <Kpi
            label="Trabajos activos"
            value={reporte.trabajosRed.activos}
            sub={`en ${n(reporte.trabajosRed.campamentos)} camp.`}
            compact
          />
          <Kpi
            label="Casos de salud"
            value={reporte.casosSaludDetalle.length}
            sub="en seguimiento"
            compact
          />
          <Kpi
            label="Novedades del día"
            value={reporte.novedadesDetalle.length}
            sub={`${resumen.eventosPositivos} + · ${resumen.eventosNegativos} −`}
            last
            compact
          />
        </View>

        <View style={styles.body}>
          <View style={styles.column}>
            <Section title="Parte demográfico" hint={`${n(dem.total)} personas`} fixed>
              <Barra label="Hombres" value={dem.hombres} total={totalGenero} color="#2563eb" />
              <Barra label="Mujeres" value={dem.mujeres} total={totalGenero} color="#be185d" />
              <View style={{ marginTop: 1 }}>
                <View style={[styles.row, { marginBottom: 1 }]}>
                  <Text style={[styles.metricLabel, { flex: 1.4 }]}>Grupo etario</Text>
                  <Text style={[styles.metricLabel, { flex: 0.6, textAlign: "right" }]}>H</Text>
                  <Text style={[styles.metricLabel, { flex: 0.6, textAlign: "right" }]}>M</Text>
                  <Text style={[styles.metricLabel, { flex: 0.7, textAlign: "right" }]}>Tot.</Text>
                </View>
                {dem.porGrupo.map((g) => (
                  <View key={g.etiqueta} style={[styles.row, { marginBottom: 1 }]}>
                    <Text style={[styles.rowLabel, { flex: 1.4 }]}>{g.etiqueta}</Text>
                    <Text style={[styles.rowValue, { flex: 0.6, textAlign: "right", color: "#2563eb" }]}>
                      {n(g.h)}
                    </Text>
                    <Text style={[styles.rowValue, { flex: 0.6, textAlign: "right", color: "#be185d" }]}>
                      {n(g.m)}
                    </Text>
                    <Text style={[styles.rowValue, { flex: 0.7, textAlign: "right" }]}>
                      {n(g.h + g.m)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.row, { marginBottom: 1, borderTopWidth: 1, borderTopColor: borde, paddingTop: 2 }]}>
                  <Text style={[styles.rowLabel, { flex: 1.4, fontWeight: 700 }]}>Total</Text>
                  <Text style={[styles.rowValue, { flex: 0.6, textAlign: "right", color: "#2563eb" }]}>
                    {n(dem.hombres)}
                  </Text>
                  <Text style={[styles.rowValue, { flex: 0.6, textAlign: "right", color: "#be185d" }]}>
                    {n(dem.mujeres)}
                  </Text>
                  <Text style={[styles.rowValue, { flex: 0.7, textAlign: "right" }]}>{n(dem.total)}</Text>
                </View>
              </View>
              <View style={styles.miniGrid}>
                <MiniDato label="Embarazadas" value={dem.embarazadas} />
                <MiniDato label="Discapacidad/patologías" value={dem.discapacidad} />
              </View>
            </Section>

            <Section title="Total de personas (7 días)" hint="evolución diaria" tint fixed>
              <GraficoSerieSemanal puntos={reporte.serieSemanal} diaActivo={reporte.dia} />
            </Section>
          </View>

          <View style={styles.columnWide}>
            {reporte.censo ? (
              <Section
                title="Censo SEBIN"
                hint={`${n(reporte.censo.completados + reporte.censo.enCurso + reporte.censo.sinIniciar)} campamentos`}
                tint
                fixed
              >
                <View style={styles.miniGrid}>
                  <StatCard label="Completados" value={reporte.censo.completados} />
                  <StatCard label="En curso" value={reporte.censo.enCurso} />
                  <StatCard label="Sin iniciar" value={reporte.censo.sinIniciar} wide />
                </View>
                <Barra
                  label="Avance del levantamiento"
                  value={reporte.censo.completados}
                  total={reporte.censo.completados + reporte.censo.enCurso + reporte.censo.sinIniciar}
                  color={verde}
                />
              </Section>
            ) : null}

            <Section title="Control operativo" hint={`${n(reporte.control.campamentosRevisados)}/${n(reporte.kpis.centrosTotal)} rev.`} fixed>
              <Donut
                titulo="Captahuellas"
                si={reporte.control.captahuella.si}
                no={reporte.control.captahuella.no}
                sinReporte={reporte.control.captahuella.sinReporte}
                compact
              />
              <Donut
                titulo="Jueces de paz"
                si={reporte.control.juezPaz.si}
                no={reporte.control.juezPaz.no}
                sinReporte={reporte.control.juezPaz.sinReporte}
                compact
              />
              <Barra
                label="Serv. médico"
                value={reporte.control.servicioMedico.si}
                total={reporte.kpis.centrosTotal}
                color={verde}
              />
              <Barra
                label="Ambulancia"
                value={reporte.control.ambulancia.si}
                total={reporte.kpis.centrosTotal}
                color={ambar}
              />
            </Section>
          </View>

          <View style={[styles.column, styles.columnLast]}>
            <Section title="Trabajos en la red" hint={`${n(reporte.trabajosRed.activos)} activos`} tint fixed>
              <View style={styles.miniGrid}>
                <MiniDato label="Pend." value={reporte.trabajosRed.pendientes} />
                <MiniDato label="Progreso" value={reporte.trabajosRed.enProgreso} />
                <MiniDato label="Camp." value={reporte.trabajosRed.campamentos} />
                <MiniDato label="Antig. d" value={reporte.trabajosRed.masViejoDias ?? 0} />
              </View>
            </Section>

            <Section title="Campamentos por unidad SEBIN" hint={`${n(reporte.kpis.centrosTotal)} camp.`} fixed>
              {reporte.unidadesSebin.map((u) => (
                <View key={u.unidad} style={[styles.row, { marginBottom: 1.5 }]}>
                  <Text style={styles.rowLabel}>{u.unidad}</Text>
                  <Text style={styles.rowValue}>
                    {String(u.campamentos).padStart(2, "0")} camp. · {n(u.refugiados)} damnif.
                  </Text>
                </View>
              ))}
            </Section>

            <View style={styles.ocupacionRow} wrap={false}>
              <Text style={styles.ocupacionTitulo}>Ocupación de la red</Text>
              <View style={styles.ocupacionRowInner}>
                <View style={styles.ocupacionChart}>
                  <DonutOcupacion
                    activo={reporte.ocupacionRed.activo}
                    sinRefugiados={reporte.ocupacionRed.sinRefugiados}
                    compact
                    mini
                  />
                </View>
                <View style={styles.ocupacionBarras}>
                  <Barra
                    label="Activos"
                    value={reporte.ocupacionRed.activo}
                    total={reporte.kpis.centrosTotal}
                    color={verdeOcupacion}
                  />
                  <Barra
                    label="Sin damnificados"
                    value={reporte.ocupacionRed.sinRefugiados}
                    total={reporte.kpis.centrosTotal}
                    color={grisOcupacion}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
        </View>
      </Page>

      {/* ===== Tabla de la red, un campamento por fila ===== */}
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <EncabezadoInstitucional generadoTs={reporte.generadoTs} />

        <View style={styles.contenido}>
          <View style={[styles.header, { marginBottom: 2 }]} fixed>
            <View>
              <Text style={styles.eyebrow}>SALA SITUACIONAL - DETALLE POR CAMPAMENTO</Text>
              <Text style={[styles.title, { fontSize: 13 }]}>Situación de la red</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.pill}>{n(reporte.kpis.centrosTotal)} campamentos</Text>
              <Text
                style={styles.smallMuted}
                render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
              />
            </View>
          </View>

        <View style={styles.tablaHeader} fixed>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.nro }]}>N°</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.campamento }]}>Campamento</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.cuerpo }]}>Cuerpo · unidad</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.damnif, textAlign: "right" }]}>Damnif.</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.fam, textAlign: "right" }]}>Fam.</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.control, paddingLeft: 6 }]}>Control</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.trabajos }]}>Trabajos</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.salud }]}>Casos de salud</Text>
          <Text style={[styles.tablaHeaderCelda, { flex: ANCHOS_TABLA.noved }]}>Novedades</Text>
        </View>

        {reporte.filasRed.map((fila, i) => (
          <View
            key={`${fila.nro ?? "s/n"}-${fila.nombre}`}
            style={i % 2 === 1 ? [styles.tablaFila, styles.tablaFilaAlterna] : styles.tablaFila}
            wrap={false}
          >
            <Text style={[styles.celdaTexto, { flex: ANCHOS_TABLA.nro }]}>
              {fila.nro != null ? fila.nro : "—"}
            </Text>
            <View style={{ flex: ANCHOS_TABLA.campamento, paddingRight: 4 }}>
              <Text style={styles.celdaNombre}>{fila.nombre}</Text>
              {fila.parroquia ? <Text style={styles.celdaSub}>{fila.parroquia}</Text> : null}
            </View>
            <View style={{ flex: ANCHOS_TABLA.cuerpo, paddingRight: 4 }}>
              <Text style={styles.celdaTexto}>{fila.cuerpo}</Text>
              {fila.unidadSebin ? <Text style={styles.celdaSub}>{fila.unidadSebin}</Text> : null}
              {fila.responsableSebin ? (
                <Text style={styles.celdaSub}>{fila.responsableSebin}</Text>
              ) : null}
            </View>
            <Text style={[styles.celdaNumero, { flex: ANCHOS_TABLA.damnif }]}>{n(fila.refugiados)}</Text>
            <Text style={[styles.celdaNumero, { flex: ANCHOS_TABLA.fam }]}>{n(fila.familias)}</Text>
            <View style={{ flex: ANCHOS_TABLA.control, paddingLeft: 6 }}>
              <Text style={styles.celdaTexto}>
                Captah. <TextoSiNo valor={fila.captahuella} />
              </Text>
              <Text style={[styles.celdaTexto, { marginTop: 1 }]}>
                Juez paz <TextoSiNo valor={fila.juezPaz} />
              </Text>
            </View>
            <View style={{ flex: ANCHOS_TABLA.trabajos, paddingRight: 4 }}>
              {fila.trabajosDetalle.length === 0 ? (
                <Text style={[styles.celdaTexto, { color: gris }]}>—</Text>
              ) : (
                fila.trabajosDetalle.map((t, j) => (
                  <Text key={j} style={[styles.celdaTexto, { marginBottom: 1 }]}>
                    • {textoOracion(t.titulo)}{" "}
                    <Text style={{ color: t.dias >= 3 ? rojo : gris }}>
                      ({t.dias <= 1 ? "hoy" : `${t.dias} d`})
                    </Text>
                  </Text>
                ))
              )}
            </View>
            <View style={{ flex: ANCHOS_TABLA.salud, paddingRight: 4 }}>
              {fila.casosDetalle.length === 0 ? (
                <Text style={[styles.celdaTexto, { color: gris }]}>—</Text>
              ) : (
                fila.casosDetalle.map((c, j) => (
                  <Text key={j} style={[styles.celdaTexto, { marginBottom: 1 }]}>
                    • {textoOracion(c.titulo)}{" "}
                    <Text style={{ color: gris }}>
                      (<Text style={{ color: META_ESTATUS_CASO_PDF[c.estatus]?.color ?? gris, fontWeight: 700 }}>
                        {META_ESTATUS_CASO_PDF[c.estatus]?.label ?? c.estatus}
                      </Text>{" "}
                      · {c.dias <= 1 ? "hoy" : `${c.dias} d`})
                    </Text>
                  </Text>
                ))
              )}
            </View>
            <View style={{ flex: ANCHOS_TABLA.noved }}>
              {fila.novedadesDetalle.length === 0 ? (
                <Text style={[styles.celdaTexto, { color: gris }]}>—</Text>
              ) : (
                fila.novedadesDetalle.map((nov, j) => (
                  <Text
                    key={j}
                    style={[
                      styles.celdaTexto,
                      { marginBottom: 1, color: nov.tipo === "positivo" ? verde : rojo },
                    ]}
                  >
                    • {textoOracion(nov.titulo)}
                  </Text>
                ))
              )}
            </View>
          </View>
        ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Ordenado por N° de campamento · Control según revisión del día · Trabajos con días abiertos.</Text>
          <Text>Casos de salud = abiertos en seguimiento · Novedades = del día del corte.</Text>
        </View>
      </Page>

    </Document>
  );
}
