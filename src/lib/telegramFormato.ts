/**
 * Deep links `tg://msg?text=` insertan texto plano: Telegram NO aplica Markdown
 * (`**negrita**`, `` `mono` ``). El portapapeles sí puede pegarse con formato.
 * Para el envío vía deep link convertimos a glifos Unicode que se ven en negrita
 * sin `parse_mode` (Bot API).
 */

/** A–Z / a–z / 0–9 → Mathematical Sans-Serif Bold. Resto (tildes, ñ) igual. */
function charNegritaUnicode(c: string): string {
  const code = c.codePointAt(0);
  if (code === undefined) return c;
  if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(0x1d5d4 + (code - 0x41));
  if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(0x1d5ee + (code - 0x61));
  if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1d7ec + (code - 0x30));
  return c;
}

function aNegritaUnicode(texto: string): string {
  return Array.from(texto, charNegritaUnicode).join("");
}

/**
 * Markdown del parte → texto visual para deep link / share URL.
 * - `**x**` → negrita Unicode
 * - `` `x` `` → x (sin backticks)
 */
export function textoTelegramParaDeepLink(markdown: string): string {
  return markdown
    .replace(/\*\*([^*]+)\*\*/g, (_m, inner: string) => aNegritaUnicode(inner))
    .replace(/`([^`]+)`/g, "$1");
}
