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

/** Bucket público para fotos de reparaciones (antes/después). */
export const BUCKET_REPARACIONES = "reparaciones-fotos";

/** Bucket público para fotos iniciales de áreas de infraestructura. */
export const BUCKET_INFRAESTRUCTURA = "infraestructura-fotos";

/** Bucket privado para fotos de refugiados (URLs firmadas). */
export const BUCKET_REFUGIADOS = "refugiados-fotos";


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
  if (!cliente) {
    cliente = createClient(URL, ANON);
  }
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

/**
 * Sube (comprimida) una foto de reparación al bucket y devuelve su URL pública.
 * Path: `{centroId}/{reparacionId}/{tipo}-{timestamp}.jpg`
 */
export async function subirFotoReparacion(
  centroId: string,
  reparacionId: string,
  file: File,
): Promise<string> {
  const supabase = getCliente();
  const blob = await comprimirImagen(file);
  const path = `${centroId}/${reparacionId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_REPARACIONES).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET_REPARACIONES).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Sube (comprimida) una foto inicial de infraestructura al bucket y devuelve su URL pública.
 * Path: `{centroId}/{areaId}/{timestamp}.jpg`
 */
export async function subirFotoInfraestructura(
  centroId: string,
  areaId: string,
  file: File,
): Promise<string> {
  const supabase = getCliente();
  const blob = await comprimirImagen(file);
  const path = `${centroId}/${areaId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_INFRAESTRUCTURA).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET_INFRAESTRUCTURA).getPublicUrl(path);
  return data.publicUrl;
}

/** Bucket privado para fotos de residencias afectadas (URLs firmadas). */
export const BUCKET_RESIDENCIAS = "residencias-fotos";

/**
 * Sube (comprimida) foto de refugiado al bucket privado.
 * Path: `{refugiadoId}/{timestamp}.jpg`
 */
export async function subirFotoRefugiado(refugiadoId: string, file: File): Promise<string> {
  const supabase = getCliente();
  const blob = await comprimirImagen(file);
  const path = `${refugiadoId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_REFUGIADOS).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return path;
}

/** URL firmada para foto de refugiado. */
export async function urlFotoRefugiado(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const supabase = getCliente();
  const { data, error } = await supabase.storage
    .from(BUCKET_REFUGIADOS)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Sube foto grupal de familia.
 * Path: `{centroId}/{familiaId}/{timestamp}.jpg`
 */
export async function subirFotoFamiliar(
  centroId: string,
  familiaId: string,
  file: File,
): Promise<string> {
  const supabase = getCliente();
  const blob = await comprimirImagen(file);
  const path = `${centroId}/${familiaId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_REFUGIADOS).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Sube (comprimida) una foto de residencia afectada al bucket privado.
 * Devuelve el path relativo (no URL pública).
 * Path: `{centroId}/{familiaId}/{timestamp}.jpg`
 */
export async function subirFotoResidencia(
  centroId: string,
  familiaId: string,
  file: File,
): Promise<string> {
  const supabase = getCliente();
  const blob = await comprimirImagen(file);
  const path = `${centroId}/${familiaId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_RESIDENCIAS).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return path;
}

/** URL firmada temporal para mostrar una foto del bucket privado. */
export async function urlFotoResidencia(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  const supabase = getCliente();
  const { data, error } = await supabase.storage
    .from(BUCKET_RESIDENCIAS)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
