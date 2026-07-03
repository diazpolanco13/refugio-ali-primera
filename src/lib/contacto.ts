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

export function whatsappHref(raw: string): string | null {
  const intl = telefonoInternacional(raw);
  return intl ? `https://wa.me/${intl}` : null;
}

/** Abre chat de Telegram por número (muy usado en Venezuela). */
export function telegramHref(raw: string): string | null {
  const intl = telefonoInternacional(raw);
  return intl ? `https://t.me/+${intl}` : null;
}

export function tieneTelefonoContacto(raw: string): boolean {
  return digitosTelefono(raw).length >= 7;
}
