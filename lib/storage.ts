import { publicEnv } from "@/lib/env";

/** URL pública de una imagen de producto (bucket público product-images). */
export function productImageUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`;
}
