import { createClient } from "@/lib/supabase/client";
import { registerProductImageAction } from "@/app/admin/productos/actions";
import { ACCEPTED_IMAGE_TYPES, compressImage } from "@/lib/images-client";

export const MAX_IMAGE_FILE_MB = 10;
const MAX_DIMENSION = 2000;

/**
 * Sube una foto de producto desde el navegador: la comprime (máx. 2000 px,
 * WebP), la guarda con nombre aleatorio y la registra en el producto.
 */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return { ok: false, error: `${file.name}: formato no soportado (use JPG, PNG o WebP).` };
    }
    if (file.size > MAX_IMAGE_FILE_MB * 1024 * 1024) {
      return { ok: false, error: `${file.name}: supera el máximo de ${MAX_IMAGE_FILE_MB} MB.` };
    }

    const { blob, width, height } = await compressImage(file, {
      maxDimension: MAX_DIMENSION,
      quality: 0.85,
    });
    // Nombre de archivo ALEATORIO: nunca se usa el nombre original.
    const path = `products/${productId}/${crypto.randomUUID()}.webp`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, blob, { contentType: "image/webp", upsert: false });
    if (uploadError) return { ok: false, error: `${file.name}: no se pudo subir.` };

    const result = await registerProductImageAction({
      product_id: productId,
      storage_path: path,
      width,
      height,
      size_bytes: blob.size,
    });
    if (!result.ok) {
      await supabase.storage.from("product-images").remove([path]);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: `${file.name}: error procesando la imagen.` };
  }
}
