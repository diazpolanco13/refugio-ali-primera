/** Configuración del widget Cap (CAPTCHA proof-of-work). */

export const capHabilitado = Boolean(
  import.meta.env.VITE_CAP_API_URL && import.meta.env.VITE_CAP_SITE_KEY,
);

/** Endpoint del widget: `https://<instancia>/<site_key>/` */
export function capApiEndpoint(): string {
  const base = (import.meta.env.VITE_CAP_API_URL ?? "").replace(/\/$/, "");
  const siteKey = import.meta.env.VITE_CAP_SITE_KEY ?? "";
  return `${base}/${siteKey}/`;
}
