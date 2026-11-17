import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { productSchema } from "@/lib/validation/schemas";
import type { ListingProductInput } from "@/lib/ai/listing";
import { uniqueProductSlug } from "@/services/products/slug";

const BUCKET = "product-images";

/** Copia las fotos guardadas de Instagram a la carpeta del producto y las registra. */
export async function copyImportImagesToProduct(
  admin: SupabaseClient<Database>,
  imagePaths: string[],
  productId: string,
  actorId: string | null
): Promise<number> {
  const { count } = await admin
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  let order = count ?? 0;
  let copied = 0;
  for (const source of imagePaths) {
    const extension = source.split(".").pop() ?? "jpg";
    const target = `products/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error: copyError } = await admin.storage.from(BUCKET).copy(source, target);
    if (copyError) continue;

    const { error } = await admin.from("product_images").insert({
      product_id: productId,
      storage_path: target,
      is_cover: order === 0,
      sort_order: order,
      created_by: actorId,
    });
    if (error) {
      await admin.storage.from(BUCKET).remove([target]);
      continue;
    }
    order++;
    copied++;
  }
  return copied;
}

export async function createProductFromImport(
  admin: SupabaseClient<Database>,
  input: {
    data: ListingProductInput;
    status: "disponible" | "reservado";
    imagePaths: string[];
    permalink: string | null;
    actorId: string | null;
  }
): Promise<string> {
  const parsed = productSchema.parse(input.data);
  const slug = await uniqueProductSlug(admin, `${parsed.brand} ${parsed.model || parsed.name}`);

  const { data, error } = await admin
    .from("products")
    .insert({
      ...parsed,
      slug,
      status: input.status,
      is_published: false,
      internal_notes: `Creado desde Instagram${input.permalink ? `: ${input.permalink}` : "."}`,
      created_by: input.actorId,
      updated_by: input.actorId,
    })
    .select("id")
    .single();
  if (error) throw new Error("No se pudo crear el producto.");

  await copyImportImagesToProduct(admin, input.imagePaths, data.id, input.actorId);
  await admin.from("audit_logs").insert({
    user_id: input.actorId,
    action: "instagram_crear",
    entity_type: "producto",
    entity_id: data.id,
    new_values: { permalink: input.permalink },
  });
  return data.id;
}

/** Fija el precio en dólares y publica (función de la base, solo para el servidor). */
export async function publishWithPrice(
  admin: SupabaseClient<Database>,
  productId: string,
  priceUsd: number,
  actorId: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { error } = await admin.rpc("instagram_publish_with_price", {
    p_product_id: productId,
    p_amount_usd: priceUsd,
    p_actor: actorId,
  });
  if (!error) return { ok: true };
  return {
    ok: false,
    reason: error.message.includes("cotización")
      ? "Creado sin publicar: falta cargar la cotización del dólar (Cotizaciones)."
      : "Creado sin publicar: no se pudo publicar automáticamente.",
  };
}
