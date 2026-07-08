/**
 * Copia texto al portapapeles. Usa la Clipboard API cuando hay contexto
 * seguro (https / localhost) y cae a un textarea oculto + execCommand en
 * despliegues http (p. ej. el dev server accedido por IP), donde
 * `navigator.clipboard` no existe.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      /* sigue al fallback */
    }
  }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
