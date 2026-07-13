import { textoTelegramParaDeepLink } from "@/lib/telegramFormato";

/** Solo dígitos del teléfono. */
export function digitosTelefono(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normaliza a formato internacional para WhatsApp/Telegram.
 * Ej. 0414-2310314 → 584142310314 · +58 414… → 58414…
 */
export function telefonoInternacional(raw: string): string | null {
  let d = digitosTelefono(raw);
  if (!d) return null;
  if (d.startsWith("58") && d.length >= 12) return d;
  if (d.startsWith("0") && d.length >= 11) return "58" + d.slice(1);
  if (d.length === 10 && /^[24]/.test(d)) return "58" + d;
  if (d.length >= 10) return d;
  return null;
}

export function telHref(raw: string): string {
  const intl = telefonoInternacional(raw);
  if (intl) return `tel:+${intl}`;
  return `tel:${digitosTelefono(raw)}`;
}

export function whatsappHref(raw: string, mensaje?: string): string | null {
  const intl = telefonoInternacional(raw);
  if (!intl) return null;
  return mensaje ? `https://wa.me/${intl}?text=${encodeURIComponent(mensaje)}` : `https://wa.me/${intl}`;
}

/** Abre chat de Telegram por número (muy usado en Venezuela). */
export function telegramHref(raw: string): string | null {
  const intl = telefonoInternacional(raw);
  return intl ? `https://t.me/+${intl}` : null;
}

/**
 * Share web de Telegram. Usar solo como fallback.
 * Importante: `encodeURIComponent` (espacios `%20`). Nunca `URLSearchParams`
 * aquí — convierte espacios en `+` y Telegram los deja literales.
 * Sin param `url`: si se manda `url=https://t.me`, aparece ese link arriba
 * y el texto va como comentario plano (sin markdown).
 */
export function telegramCompartirHref(texto: string): string {
  return `https://t.me/share/url?text=${encodeURIComponent(texto)}`;
}

/**
 * Deep link de la app: borrador de mensaje. El texto debe ir ya sin Markdown
 * (`textoTelegramParaDeepLink`): `tg://` no aplica `parse_mode`.
 */
export function telegramCompartirAppHref(texto: string): string {
  return `tg://msg?text=${encodeURIComponent(texto)}`;
}

/**
 * Copia no incluida: abre la app (o web) con texto ya apto para deep link.
 * Acepta Markdown del parte y lo convierte (negrita Unicode) porque `tg://`
 * no interpreta `**…**`.
 * Devuelve `"app"` si el foco salió (Telegram tomó la ventana), `"web"` si
 * caímos al share https, `"fallo"` si no se pudo abrir nada.
 */
export async function abrirTelegramCompartir(
  textoMarkdown: string,
): Promise<"app" | "web" | "fallo"> {
  const texto = textoTelegramParaDeepLink(textoMarkdown);
  const appHref = telegramCompartirAppHref(texto);
  const webHref = telegramCompartirHref(texto);

  let appTomada = false;
  const marcarBlur = () => {
    appTomada = true;
  };
  window.addEventListener("blur", marcarBlur);
  window.addEventListener("pagehide", marcarBlur);

  // <a> + click: Chrome/Firefox suelen bloquear tg:// en iframe;
  // el gesto del botón del usuario sí dispara el manejador del protocolo.
  const ancla = document.createElement("a");
  ancla.href = appHref;
  ancla.style.display = "none";
  ancla.setAttribute("aria-hidden", "true");
  document.body.appendChild(ancla);
  ancla.click();
  ancla.remove();

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 1200);
  });

  window.removeEventListener("blur", marcarBlur);
  window.removeEventListener("pagehide", marcarBlur);

  if (appTomada || !document.hasFocus()) {
    return "app";
  }

  // App no registrada / no instalada: share web (formato peor; portapapeles es respaldo).
  const ventana = window.open(webHref, "_blank", "noopener,noreferrer");
  return ventana ? "web" : "fallo";
}

export function tieneTelefonoContacto(raw: string): boolean {
  return digitosTelefono(raw).length >= 7;
}
