// Huella ligera del dispositivo para correlacionar denuncias abusivas.
// No incluye MAC: los navegadores no exponen la dirección MAC por seguridad.
// Combina señales estables del entorno (UA, pantalla, zona horaria, etc.).

export interface SenalesDispositivo {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  timezone: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  vendor: string;
}

/** Señales del navegador disponibles en el momento del envío. */
export function senalesDispositivo(): SenalesDispositivo {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const scr = typeof screen !== "undefined" ? screen : null;
  const deviceMemory =
    nav && "deviceMemory" in nav && typeof (nav as Navigator & { deviceMemory?: number }).deviceMemory === "number"
      ? (nav as Navigator & { deviceMemory: number }).deviceMemory
      : null;

  return {
    userAgent: nav?.userAgent ?? "",
    language: nav?.language ?? "",
    languages: nav?.languages ? [...nav.languages] : [],
    platform: nav?.platform ?? "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: {
      width: scr?.width ?? 0,
      height: scr?.height ?? 0,
      colorDepth: scr?.colorDepth ?? 0,
      pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    },
    hardwareConcurrency: nav?.hardwareConcurrency ?? null,
    deviceMemory,
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    cookieEnabled: nav?.cookieEnabled ?? false,
    vendor: nav?.vendor ?? "",
  };
}

/** Hash corto y estable (FNV-1a 32-bit → hex) sobre las señales. */
export function huellaDispositivo(senales: SenalesDispositivo = senalesDispositivo()): string {
  const base = [
    senales.userAgent,
    senales.language,
    senales.languages.join(","),
    senales.platform,
    senales.timezone,
    `${senales.screen.width}x${senales.screen.height}@${senales.screen.pixelRatio}`,
    String(senales.screen.colorDepth),
    String(senales.hardwareConcurrency ?? ""),
    String(senales.deviceMemory ?? ""),
    String(senales.maxTouchPoints),
    senales.vendor,
  ].join("|");

  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
