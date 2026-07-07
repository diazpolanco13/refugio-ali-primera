// Utilidades compartidas para días abiertos / antigüedad de ítems de seguimiento.

/** Diferencia en días calendario entre dos claves YYYY-MM-DD (hoy - inicio). */
export function diasEntreClaves(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const a = new Date(`${inicio}T12:00:00`);
  const b = new Date(`${fin}T12:00:00`);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Días desde la apertura hasta hoy (inclusive del día de apertura = 0). */
export function diasAbierto(reportadoDia: string, hoyClave: string): number {
  return diasEntreClaves(reportadoDia, hoyClave);
}

/** Días desde creación hasta resolución (timestamps ms). */
export function diasHastaCierre(creadaTs: number, resueltaTs: number | null): number | null {
  if (!creadaTs || !resueltaTs) return null;
  const inicio = new Date(creadaTs);
  const fin = new Date(resueltaTs);
  const a = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`;
  const b = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
  return diasEntreClaves(a, b);
}

export function claveDiaAnterior(hoyClave: string): string {
  const d = new Date(`${hoyClave}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
