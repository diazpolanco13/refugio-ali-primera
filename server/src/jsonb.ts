/** Normaliza un valor jsonb leído de Postgres (puede venir como objeto o como string JSON). */
export function normalizarJsonb(valor: unknown): unknown {
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  }
  return valor;
}
