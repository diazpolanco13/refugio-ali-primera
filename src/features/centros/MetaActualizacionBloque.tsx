/** Línea compacta: fecha · hora · usuario de la última actualización de un bloque. */

function formatearFechaHoraCorta(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hora = d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dia}/${mes} ${hora}`;
}

export function MetaActualizacionBloque({
  ts,
  by,
  className,
}: {
  ts?: number | null;
  by?: string | null;
  className?: string;
}) {
  const marca = ts && ts > 0 ? formatearFechaHoraCorta(ts) : "";
  const quien = (by ?? "").trim();
  if (!marca && !quien) return null;

  const partes = [marca, quien].filter(Boolean);
  return (
    <p
      className={
        className ??
        "mt-1.5 text-[9px] leading-tight tabular-nums tracking-wide text-muted-foreground/85"
      }
    >
      {partes.join(" · ")}
    </p>
  );
}

/** Elige la meta más reciente entre varias fuentes (p. ej. casos de salud). */
export function metaMasReciente(
  ...fuentes: Array<{ ts?: number | null; by?: string | null } | null | undefined>
): { ts?: number; by?: string } {
  let mejor: { ts?: number; by?: string } = {};
  for (const f of fuentes) {
    if (!f) continue;
    const ts = f.ts && f.ts > 0 ? f.ts : 0;
    if (ts > (mejor.ts ?? 0)) {
      mejor = { ts, by: f.by?.trim() || undefined };
    } else if (ts === (mejor.ts ?? 0) && !mejor.by && f.by?.trim()) {
      mejor = { ts: mejor.ts, by: f.by.trim() };
    }
  }
  return mejor;
}
