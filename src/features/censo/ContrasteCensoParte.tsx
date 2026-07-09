import { AlertTriangle, CheckCircle2, ClipboardList, TrendingUp } from "lucide-react";
import {
  progresoCensoVsParte,
  type ResumenCensoCentro,
} from "@/domain/censoResumen";
import { cn } from "@/lib/utils";

function formatearDia(dia: string | null): string {
  if (!dia) return "—";
  const [y, m, d] = dia.split("-").map(Number);
  if (!y || !m || !d) return dia;
  return new Date(y, m - 1, d).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BarraComparativa({
  meta,
  actual,
  compacto,
}: {
  meta: number;
  actual: number;
  compacto?: boolean;
}) {
  const escala = Math.max(meta, actual, 1);
  const pctParte = (meta / escala) * 100;
  const pctCenso = (actual / escala) * 100;
  const excede = actual > meta;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-muted/80",
        compacto ? "mt-2 h-1.5" : "mt-3 h-3",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-all",
          excede
            ? "bg-red-500"
            : actual === meta
              ? "bg-emerald-500"
              : "bg-sky-500",
        )}
        style={{ width: `${pctCenso}%` }}
      />
      {meta > 0 && (
        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-foreground/70"
          style={{ left: `${pctParte}%` }}
          title={`Parte: ${meta.toLocaleString("es")}`}
        />
      )}
      {excede && meta > 0 && (
        <div
          className="absolute inset-y-0 rounded-r-full bg-red-600/40"
          style={{ left: `${pctParte}%`, width: `${pctCenso - pctParte}%` }}
        />
      )}
    </div>
  );
}

function MensajeContraste({
  faltan,
  contraste,
  parteDia,
}: {
  faltan: number;
  contraste: ReturnType<typeof progresoCensoVsParte>["contraste"];
  parteDia: string | null;
}) {
  if (contraste === "cuadra") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" />
        Censo cuadra con el último parte
      </p>
    );
  }
  if (contraste === "en_progreso") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
        <TrendingUp className="size-3.5 shrink-0" />
        Censo en progreso — faltan {faltan.toLocaleString("es")} por registrar
      </p>
    );
  }
  if (contraste === "excede_parte") {
    const diaParte = parteDia ? formatearDia(parteDia) : "—";
    return (
      <p className="flex items-start gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Discrepancia: el censo supera el parte numérico registrado el día{" "}
          <strong>{diaParte}</strong>.
        </span>
      </p>
    );
  }
  return null;
}

export function ContrasteCensoParte({
  resumen,
  compacto = false,
}: {
  resumen: ResumenCensoCentro;
  compacto?: boolean;
}) {
  const avance = progresoCensoVsParte(resumen);
  const cifraClase = compacto
    ? "mt-0.5 text-xl font-bold tabular-nums leading-none"
    : "mt-0.5 text-3xl font-bold tabular-nums leading-none";

  if (!avance.tieneParte) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20",
          compacto ? "px-2.5 py-2" : "px-3 py-2.5",
        )}
      >
        <p className="text-[11px] font-medium text-muted-foreground">Sin parte numérico</p>
        <p className={cn(cifraClase, "text-foreground")}>
          {avance.actual.toLocaleString("es")}
        </p>
        <p className="text-[10px] text-muted-foreground">
          personas en censo · sin referencia de revista
        </p>
      </div>
    );
  }

  const panelClase =
    avance.contraste === "excede_parte"
      ? "border-red-500/50 bg-red-500/[0.07] ring-1 ring-red-500/20"
      : avance.contraste === "cuadra"
        ? "border-emerald-500/40 bg-emerald-500/[0.06]"
        : "border-sky-500/35 bg-sky-500/[0.06]";

  return (
    <div
      className={cn(
        "rounded-lg border",
        compacto ? "px-2.5 py-2" : "px-3 py-2.5",
        panelClase,
      )}
    >
      <div className={cn("grid grid-cols-2", compacto ? "gap-2" : "gap-3")}>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3" />
            Parte (revista)
          </p>
          <p className={cn(cifraClase, "text-foreground/90")}>
            {avance.meta.toLocaleString("es")}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {resumen.parteDia ? `Del ${formatearDia(resumen.parteDia)}` : "Último reporte"}
            {resumen.parteFamilias != null && resumen.parteFamilias > 0 && (
              <span> · {resumen.parteFamilias.toLocaleString("es")} fam.</span>
            )}
          </p>
        </div>
        <div className="min-w-0 border-l border-border/60 pl-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Censo en curso
          </p>
          <p
            className={cn(
              cifraClase,
              avance.contraste === "excede_parte" && "text-red-500",
              avance.contraste === "cuadra" && "text-emerald-600 dark:text-emerald-400",
              avance.contraste === "en_progreso" && "text-sky-600 dark:text-sky-400",
            )}
          >
            {avance.actual.toLocaleString("es")}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {avance.contraste === "excede_parte" && (
              <span className="font-semibold text-red-600 dark:text-red-400">
                +{avance.excedente.toLocaleString("es")} sobre el parte
              </span>
            )}
            {avance.contraste === "en_progreso" && (
              <span className="font-medium text-sky-700 dark:text-sky-300">
                Faltan {avance.faltan.toLocaleString("es")}
              </span>
            )}
            {avance.contraste === "cuadra" && (
              <span className="text-emerald-700 dark:text-emerald-300">Coincide</span>
            )}
          </p>
        </div>
      </div>

      <BarraComparativa meta={avance.meta} actual={avance.actual} compacto={compacto} />

      <div
        className={cn(
          "flex items-center justify-between gap-2 text-[9px] text-muted-foreground",
          compacto ? "mt-1.5" : "mt-2",
        )}
      >
        <span>Línea = parte de referencia</span>
        <span className="tabular-nums">
          {avance.actual.toLocaleString("es")} / {avance.meta.toLocaleString("es")}
        </span>
      </div>

      <div className={compacto ? "mt-1.5" : "mt-2"}>
        <MensajeContraste
          faltan={avance.faltan}
          contraste={avance.contraste}
          parteDia={resumen.parteDia}
        />
      </div>
    </div>
  );
}
