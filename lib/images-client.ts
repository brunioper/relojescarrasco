/**
 * Utilidades de imágenes para el NAVEGADOR (panel de administración).
 */

/** Redimensiona y convierte a WebP en el navegador. */
export async function compressImage(
  file: Blob,
  options: { maxDimension: number; quality: number }
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, options.maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas no disponible");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", options.quality)
  );
  if (!blob) throw new Error("No se pudo convertir la imagen");
  return { blob, width, height };
}

/** Blob → base64 (sin el prefijo data:). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Prepara fotos para enviarlas a la IA: versión liviana (máx. 1280 px).
 * Si el total supera el límite del servidor, se vuelve a comprimir más chico.
 */
export async function prepareImagesForAi(
  files: File[]
): Promise<{ mediaType: "image/webp" | "image/jpeg" | "image/png"; data: string }[]> {
  const MAX_TOTAL_BASE64 = 3_600_000; // margen bajo el límite de 4,5 MB del servidor

  const attempt = async (maxDimension: number, quality: number) => {
    const out: { mediaType: "image/webp" | "image/jpeg" | "image/png"; data: string }[] = [];
    for (const file of files) {
      const { blob } = await compressImage(file, { maxDimension, quality });
      // Algunos navegadores no generan WebP y devuelven PNG.
      const mediaType = blob.type === "image/webp" ? "image/webp" : "image/png";
      out.push({ mediaType, data: await blobToBase64(blob) });
    }
    return out;
  };

  let images = await attempt(1280, 0.8);
  if (images.reduce((acc, img) => acc + img.data.length, 0) > MAX_TOTAL_BASE64) {
    images = await attempt(960, 0.7);
  }
  return images;
}
