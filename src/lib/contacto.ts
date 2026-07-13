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
 * Share web de Telegram (elige chat/grupo). Fallback si la app no responde.
 * El param `url` es obligatorio para el diálogo de compartir; el texto va en `text`.
 */
export function telegramCompartirHref(texto: string): string {
  const q = new URLSearchParams({ url: "https://t.me", text: texto });
  return `https://t.me/share/url?${q.toString()}`;
}

/**
 * Deep link de la app Telegram (Desktop/móvil): abre el selector de contacto/chat
 * con el texto listo para enviar. Preferir sobre la URL https.
 */
export function telegramCompartirAppHref(texto: string): string {
  const q = new URLSearchParams({ url: "https://t.me", text: texto });
  return `tg://msg_url?${q.toString()}`;
}

/**
 * Copia no incluida: solo abre la app (o web si el protocolo no responde).
 * Devuelve `"app"` si el foco salió (Telegram tomó la ventana), `"web"` si
 * caímos al share https, `"fallo"` si no se pudo abrir nada.
 */
export async function abrirTelegramCompartir(
  texto: string,
): Promise<"app" | "web" | "fallo"> {
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

  // App no registrada / no instalada: share web (a veces redirige a la app).
  const ventana = window.open(webHref, "_blank", "noopener,noreferrer");
  return ventana ? "web" : "fallo";
}

export function tieneTelefonoContacto(raw: string): boolean {
  return digitosTelefono(raw).length >= 7;
}
