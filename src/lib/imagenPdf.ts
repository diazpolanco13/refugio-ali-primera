// Prepara imágenes para @react-pdf/renderer, que solo acepta PNG/JPEG.
// Los escudos del catálogo pueden ser WebP (seed y subidas al bucket
// `logos-catalogo`): se convierten a PNG vía canvas. Devuelve data URLs para
// que el PDF no dependa de red al renderizar.

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Descarga una imagen (path público o URL absoluta) y la devuelve como data
 * URL PNG/JPEG apta para el PDF. `null` si no hay imagen o falla la carga
 * (el membrete simplemente omite ese logo).
 */
export async function imagenParaPdf(url: string | null | undefined): Promise<string | null> {
  if (!url?.trim()) return null;
  const absoluta = /^https?:\/\//i.test(url)
    ? url
    : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  try {
    const res = await fetch(absoluta);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.type === "image/png" || blob.type === "image/jpeg") {
      return await blobADataUrl(blob);
    }
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("[imagenPdf] no se pudo preparar la imagen:", url, err);
    return null;
  }
}

export interface MembreteListo {
  izqLineas: string[];
  /** Data URL PNG/JPEG lista para <Image> del PDF (null = sin logo). */
  izqLogo: string | null;
  derLineas: string[];
  derLogo: string | null;
}

/** Convierte los logos de un membrete a data URLs aptas para el PDF. */
export async function prepararMembrete(m: {
  izqLineas: string[];
  izqLogo: string | null;
  derLineas: string[];
  derLogo: string | null;
}): Promise<MembreteListo> {
  const [izqLogo, derLogo] = await Promise.all([
    imagenParaPdf(m.izqLogo),
    imagenParaPdf(m.derLogo),
  ]);
  return { izqLineas: m.izqLineas, izqLogo, derLineas: m.derLineas, derLogo };
}
