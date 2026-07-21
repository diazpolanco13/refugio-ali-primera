// Política de contraseña de la credencial propia del operador (Fase 2 del
// plan de migración, docs/plan-migracion-operadores-password.md §8.2):
// mínimo 8 caracteres, al menos una letra y un número, y nunca la cédula.
// La edge `activar-operador` aplica la misma regla en el servidor; esto
// alimenta el checklist visual del gate de activación.

export interface ChequeoPassword {
  clave: string;
  etiqueta: string;
  ok: boolean;
}

/** Requisitos obligatorios, en el orden en que se muestran. */
export function chequeosPassword(
  password: string,
  cedulaDigits: string,
): ChequeoPassword[] {
  return [
    {
      clave: "largo",
      etiqueta: "Al menos 8 caracteres",
      ok: password.length >= 8,
    },
    {
      clave: "letra",
      etiqueta: "Al menos una letra",
      ok: /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(password),
    },
    {
      clave: "numero",
      etiqueta: "Al menos un número",
      ok: /\d/.test(password),
    },
    {
      clave: "no_cedula",
      etiqueta: "Que no sea su cédula",
      ok:
        password.length > 0 &&
        (cedulaDigits === "" || password.replace(/\D/g, "") !== cedulaDigits),
    },
  ];
}

export function passwordCumple(password: string, cedulaDigits: string): boolean {
  return chequeosPassword(password, cedulaDigits).every((c) => c.ok);
}

/**
 * Fuerza estimada 0–3 (débil / aceptable / buena / fuerte) para la barra
 * visual. Solo orienta: lo obligatorio son los chequeos de arriba.
 */
export function fuerzaPassword(password: string, cedulaDigits: string): number {
  if (!passwordCumple(password, cedulaDigits)) return 0;
  let extra = 0;
  if (password.length >= 12) extra++;
  if (/[a-zñáéíóú]/.test(password) && /[A-ZÑÁÉÍÓÚ]/.test(password)) extra++;
  if (/[^a-zA-Z0-9]/.test(password)) extra++;
  return Math.min(3, 1 + extra);
}

export const ETIQUETAS_FUERZA = ["Débil", "Aceptable", "Buena", "Fuerte"] as const;
