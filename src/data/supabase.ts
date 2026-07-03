// Cliente de Supabase Storage para las fotos de los centros. Solo se usa para
// subir imágenes; el resto de los datos vive en el backend/sync propio. La foto
// se comprime en el navegador antes de subir (para no cargar el bucket ni la
// sincronización con blobs gigantes) y se guarda solo la URL pública dentro del
// dato del centro. Si no hay llaves configuradas, la subida se desactiva y la
// app sigue funcionando con normalidad (offline-first).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Nombre del bucket público donde se guardan las fotos de los centros. */
export const BUCKET_CENTROS = "centros-fotos";

let cliente: SupabaseClient | null = null;

/** ¿Está configurado Supabase (hay URL + anon key)? */
export function supabaseDisponible(): boolean {
  return Boolean(URL && ANON);
}

function getCliente(): SupabaseClient {
  if (!URL || !ANON) {
    throw new Error(
      "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
    );
  }
  if (!cliente) cliente = createClient(URL, ANON);
  return cliente;
}

/**
 * Redimensiona/comprime una imagen a un máximo de `maxLado` px (lado mayor) y
 * la devuelve como Blob JPEG. Reduce mucho el peso de las fotos de campo.
 */
async function comprimirImagen(file: File, maxLado = 1280, calidad = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/jpeg",
      calidad,
    );
  });
}

/**
 * Sube (comprimida) la foto de un centro al bucket de Supabase y devuelve su
 * URL pública. El path usa el id del centro + timestamp para evitar colisiones
 * de caché al reemplazar la foto.
 */
export async function subirFotoCentro(centroId: string, file: File): Promise<string> {
  const supabase = getCliente();
  const blob = await comprimirImagen(file);
  const path = `${centroId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_CENTROS).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET_CENTROS).getPublicUrl(path);
  return data.publicUrl;
}
