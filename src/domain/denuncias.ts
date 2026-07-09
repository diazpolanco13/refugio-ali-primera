// Denuncias y sugerencias de los damnificados (canal público por QR, tabla
// `denuncias_centros`). Las escriben los refugiados de forma anónima vía la
// RPC `denuncia_registrar` (token 'publico' del campamento); las gestionan
// quienes vigilan el centro (admin/analista toda la red, autoridad lectura,
// supervisor sus campamentos). El operador de terreno no las ve.
//
// Telemetría de origen (ip, user_agent, huella): solo para detectar abuso /
// ataques externos. La MAC no es accesible desde el navegador.

export type CategoriaDenuncia =
  | "comida"
  | "dotaciones"
  | "trato"
  | "seguridad"
  | "salud"
  | "infraestructura"
  | "otro";

export type EstadoDenuncia = "abierta" | "resuelta";

export interface DispositivoMeta {
  language?: string;
  languages?: string[];
  platform?: string;
  timezone?: string;
  screen?: {
    width?: number;
    height?: number;
    colorDepth?: number;
    pixelRatio?: number;
  };
  hardwareConcurrency?: number | null;
  deviceMemory?: number | null;
  maxTouchPoints?: number;
  cookieEnabled?: boolean;
  vendor?: string;
}

export interface Denuncia {
  id: string;
  centro_id: string;
  /** YYYY-MM-DD (hora de Caracas). */
  dia: string;
  ts: number;
  categoria: CategoriaDenuncia;
  /** Resumen corto del reporte (requerido en altas nuevas). */
  titulo: string | null;
  texto: string;
  /** Contacto voluntario del denunciante (teléfono/nombre); null = anónima. */
  contacto: string | null;
  estado: EstadoDenuncia;
  resuelta_ts: number | null;
  resuelta_por: string | null;
  nota_resolucion: string | null;
  /** IP del cliente (x-forwarded-for); null si no se pudo capturar. */
  ip: string | null;
  user_agent: string | null;
  /** Hash corto de señales del dispositivo (no es MAC). */
  dispositivo_huella: string | null;
  dispositivo_meta: DispositivoMeta | null;
}

export const CATEGORIAS_DENUNCIA: { valor: CategoriaDenuncia; label: string; emoji: string }[] = [
  { valor: "comida", label: "Comida", emoji: "🍽️" },
  { valor: "dotaciones", label: "Dotaciones", emoji: "📦" },
  { valor: "trato", label: "Trato del personal", emoji: "🤝" },
  { valor: "seguridad", label: "Seguridad", emoji: "🛡️" },
  { valor: "salud", label: "Salud", emoji: "🩺" },
  { valor: "infraestructura", label: "Instalaciones", emoji: "🚿" },
  { valor: "otro", label: "Otro / sugerencia", emoji: "💬" },
];

export function labelCategoriaDenuncia(categoria: string): string {
  return CATEGORIAS_DENUNCIA.find((c) => c.valor === categoria)?.label ?? categoria;
}

/** Tolera filas con campos ausentes (p. ej. payloads Realtime parciales). */
export function normalizarDenuncia(fila: Partial<Denuncia> & { id: string }): Denuncia {
  return {
    id: fila.id,
    centro_id: fila.centro_id ?? "",
    dia: fila.dia ?? "",
    ts: fila.ts ?? 0,
    categoria: (fila.categoria as CategoriaDenuncia) ?? "otro",
    titulo: fila.titulo ?? null,
    texto: fila.texto ?? "",
    contacto: fila.contacto ?? null,
    estado: (fila.estado as EstadoDenuncia) ?? "abierta",
    resuelta_ts: fila.resuelta_ts ?? null,
    resuelta_por: fila.resuelta_por ?? null,
    nota_resolucion: fila.nota_resolucion ?? null,
    ip: fila.ip ?? null,
    user_agent: fila.user_agent ?? null,
    dispositivo_huella: fila.dispositivo_huella ?? null,
    dispositivo_meta: (fila.dispositivo_meta as DispositivoMeta | null) ?? null,
  };
}
