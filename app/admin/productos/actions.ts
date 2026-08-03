"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import {
  listingPriceSchema,
  productCostSchema,
  productSchema,
  productStatusSchema,
  purchaseSchema,
  saleSchema,
} from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";
import { convertForStorage } from "@/services/finance/currency";
import { slugify } from "@/lib/utils";
import type { Json } from "@/types/supabase";

/**
 * Server Actions de productos.
 * Toda acción: sesión -> perfil activo -> rol admin -> Zod -> operación -> auditoría.
 * La base de datos (RLS + triggers + RPCs) es la última barrera.
 */

function revalidateProduct(productId?: string) {
  revalidatePath("/admin/productos");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/dashboard");
  if (productId) revalidatePath(`/admin/productos/${productId}`);
  revalidatePath("/", "layout"); // catálogo público
  revalidatePath("/catalogo");
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = slugify(base) || "reloj";
  let candidate = baseSlug;
  for (let i = 0; i < 20; i++) {
    let query = supabase.from("products").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return candidate;
    candidate = `${baseSlug}-${i + 2}`;
  }
  return `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
}

// ------------------------------------------------------------
// Crear / editar producto
// ------------------------------------------------------------
export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para crear productos.");

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del producto.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const slug = await uniqueSlug(supabase, `${parsed.data.brand} ${parsed.data.model || parsed.data.name}`);

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...parsed.data,
      slug,
      status: "no_publicado",
      is_published: false,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(data.id);
  return ok({ id: data.id });
}

export async function updateProductAction(
  productId: unknown,
  input: unknown
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para editar productos.");

  const id = uuidSchema.safeParse(productId);
  const parsed = productSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return fail(
      "Verifique los datos del producto.",
      parsed.success ? undefined : parsed.error.flatten().fieldErrors
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ ...parsed.data, updated_by: ctx.userId })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(id.data);
  return ok(null);
}

// ------------------------------------------------------------
// Publicación y estado
// ------------------------------------------------------------
export async function setPublishedAction(
  productId: unknown,
  publish: boolean
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const id = uuidSchema.safeParse(productId);
  if (!id.success) return fail("Producto inválido.");

  const supabase = await createClient();

  if (publish) {
    // Validaciones de publicación: precio y estado publicable.
    const { data: product } = await supabase
      .from("products")
      .select("status, listing_price_usd")
      .eq("id", id.data)
      .single();

    if (!product) return fail("El producto no existe.");
    if (product.listing_price_usd === null) {
      return fail("Defina un precio de lista antes de publicar.");
    }
    if (!["disponible", "reservado"].includes(product.status)) {
      return fail("Solo se publican productos disponibles o reservados.");
    }
  }

  const { error } = await supabase
    .from("products")
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_by: ctx.userId,
    })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));

  await supabase.rpc("log_audit", {
    p_action: publish ? "publicar" : "despublicar",
    p_entity_type: "producto",
    p_entity_id: id.data,
  });

  revalidateProduct(id.data);
  return ok(null);
}

export async function setFeaturedAction(
  productId: unknown,
  featured: boolean
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(productId);
  if (!id.success) return fail("Producto inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_featured: featured, updated_by: ctx.userId })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(id.data);
  return ok(null);
}

export async function changeStatusAction(
  productId: unknown,
  newStatus: unknown,
  note?: string
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const id = uuidSchema.safeParse(productId);
  const status = productStatusSchema.safeParse(newStatus);
  if (!id.success || !status.success) return fail("Datos inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_product_status", {
    p_product_id: id.data,
    p_new_status: status.data,
    p_note: note ?? null,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(id.data);
  return ok(null);
}

export async function archiveProductAction(productId: unknown): Promise<ActionResult> {
  return changeStatusAction(productId, "archivado", "Archivado desde el panel");
}

/** Baja lógica (nunca borrado físico; los vendidos no pueden eliminarse). */
export async function softDeleteProductAction(productId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(productId);
  if (!id.success) return fail("Producto inválido.");

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("status")
    .eq("id", id.data)
    .single();
  if (!product) return fail("El producto no existe.");
  if (product.status === "vendido") {
    return fail("Un producto vendido no puede eliminarse. Use archivado.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      deleted_at: new Date().toISOString(),
      is_published: false,
      updated_by: ctx.userId,
    })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));

  await supabase.rpc("log_audit", {
    p_action: "eliminar_logico",
    p_entity_type: "producto",
    p_entity_id: id.data,
  });

  revalidateProduct(id.data);
  return ok(null);
}

export async function duplicateProductAction(
  productId: unknown
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(productId);
  if (!id.success) return fail("Producto inválido.");

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("products")
    .select(
      "name, brand, model, reference_number, year_approx, movement, case_material, strap_material, diameter_mm, water_resistance, gender, condition, includes_box, includes_documentation, includes_accessories, public_description"
    )
    .eq("id", id.data)
    .single();

  if (!source) return fail("El producto no existe.");

  const slug = await uniqueSlug(supabase, `${source.brand} ${source.model || source.name} copia`);
  const { data, error } = await supabase
    .from("products")
    .insert({
      ...source,
      name: `${source.name} (copia)`,
      slug,
      status: "no_publicado",
      is_published: false,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(data.id);
  return ok({ id: data.id });
}

// ------------------------------------------------------------
// Precio de lista (vía RPC atómica con histórico)
// ------------------------------------------------------------
export async function setListingPriceAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = listingPriceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique el precio y la cotización.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_listing_price", {
    p_product_id: parsed.data.product_id,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_exchange_rate: parsed.data.exchange_rate,
    p_rate_date: parsed.data.rate_date,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(parsed.data.product_id);
  return ok(null);
}

// ------------------------------------------------------------
// Compra (una por producto: upsert)
// ------------------------------------------------------------
export async function savePurchaseAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos de la compra.", parsed.error.flatten().fieldErrors);
  }

  const money = convertForStorage(
    parsed.data.amount,
    parsed.data.currency,
    parsed.data.exchange_rate
  );

  const supabase = await createClient();
  const { error } = await supabase.from("purchases").upsert(
    {
      product_id: parsed.data.product_id,
      purchase_date: parsed.data.purchase_date,
      amount: money.amount,
      currency: money.currency,
      exchange_rate: money.exchangeRate,
      amount_usd: money.amountUsd,
      amount_uyu: money.amountUyu,
      supplier_id: parsed.data.supplier_id ?? null,
      payment_method: parsed.data.payment_method ?? null,
      notes: parsed.data.notes ?? null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    },
    { onConflict: "product_id" }
  );

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(parsed.data.product_id);
  return ok(null);
}

// ------------------------------------------------------------
// Costos directos
// ------------------------------------------------------------
export async function addProductCostAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = productCostSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del costo.", parsed.error.flatten().fieldErrors);
  }

  const money = convertForStorage(
    parsed.data.amount,
    parsed.data.currency,
    parsed.data.exchange_rate
  );

  const supabase = await createClient();
  const { error } = await supabase.from("product_costs").insert({
    product_id: parsed.data.product_id,
    category_id: parsed.data.category_id,
    description: parsed.data.description,
    cost_date: parsed.data.cost_date,
    amount: money.amount,
    currency: money.currency,
    exchange_rate: money.exchangeRate,
    amount_usd: money.amountUsd,
    amount_uyu: money.amountUyu,
    supplier_id: parsed.data.supplier_id ?? null,
    payment_method: parsed.data.payment_method ?? null,
    due_date: parsed.data.due_date ?? null,
    notes: parsed.data.notes ?? null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(parsed.data.product_id);
  return ok(null);
}

export async function deleteProductCostAction(costId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(costId);
  if (!id.success) return fail("Costo inválido.");

  const supabase = await createClient();
  const { data: cost } = await supabase
    .from("product_costs")
    .select("product_id, payment_status")
    .eq("id", id.data)
    .single();
  if (!cost) return fail("El costo no existe.");
  if (cost.payment_status === "pagado" || cost.payment_status === "parcial") {
    return fail("El costo tiene pagos registrados: elimine primero los pagos.");
  }

  const { error } = await supabase
    .from("product_costs")
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(cost.product_id);
  return ok(null);
}

// ------------------------------------------------------------
// Imágenes
// ------------------------------------------------------------
export async function registerProductImageAction(input: {
  product_id: string;
  storage_path: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  alt_text?: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const id = uuidSchema.safeParse(input.product_id);
  if (!id.success) return fail("Producto inválido.");
  // La ruta debe pertenecer al producto (consistencia path <-> registro).
  if (!input.storage_path.startsWith(`products/${input.product_id}/`)) {
    return fail("Ruta de imagen inválida.");
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", input.product_id);

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: input.product_id,
      storage_path: input.storage_path,
      is_cover: (count ?? 0) === 0, // la primera imagen es portada
      sort_order: count ?? 0,
      width: input.width ?? null,
      height: input.height ?? null,
      size_bytes: input.size_bytes ?? null,
      alt_text: input.alt_text ?? null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return fail(safeErrorMessage(error));
  revalidateProduct(input.product_id);
  return ok({ id: data.id });
}

export async function setCoverImageAction(imageId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(imageId);
  if (!id.success) return fail("Imagen inválida.");

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("product_images")
    .select("product_id")
    .eq("id", id.data)
    .single();
  if (!image) return fail("La imagen no existe.");

  // Operación en dos pasos (unique index garantiza una sola portada).
  const { error: clearError } = await supabase
    .from("product_images")
    .update({ is_cover: false })
    .eq("product_id", image.product_id)
    .eq("is_cover", true);
  if (clearError) return fail(safeErrorMessage(clearError));

  const { error } = await supabase
    .from("product_images")
    .update({ is_cover: true })
    .eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));

  revalidateProduct(image.product_id);
  return ok(null);
}

export async function reorderImagesAction(
  productId: unknown,
  orderedIds: string[]
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(productId);
  if (!id.success || !Array.isArray(orderedIds)) return fail("Datos inválidos.");

  const supabase = await createClient();
  for (const [index, imageId] of orderedIds.entries()) {
    const imgId = uuidSchema.safeParse(imageId);
    if (!imgId.success) return fail("Imagen inválida.");
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: index })
      .eq("id", imgId.data)
      .eq("product_id", id.data);
    if (error) return fail(safeErrorMessage(error));
  }

  revalidateProduct(id.data);
  return ok(null);
}

export async function deleteProductImageAction(imageId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(imageId);
  if (!id.success) return fail("Imagen inválida.");

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("product_images")
    .select("product_id, storage_path, is_cover")
    .eq("id", id.data)
    .single();
  if (!image) return fail("La imagen no existe.");

  const { error } = await supabase.from("product_images").delete().eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));

  // Borrar el archivo del bucket (política de admin en storage).
  await supabase.storage.from("product-images").remove([image.storage_path]);

  // Si era portada, promover la siguiente.
  if (image.is_cover) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("sort_order", { ascending: true })
      .limit(1);
    if (next && next[0]) {
      await supabase.from("product_images").update({ is_cover: true }).eq("id", next[0].id);
    }
  }

  revalidateProduct(image.product_id);
  return ok(null);
}

// ------------------------------------------------------------
// Venta atómica y cancelación
// ------------------------------------------------------------
export async function markSoldAction(input: unknown): Promise<ActionResult<{ saleId: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para registrar ventas.");

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos de la venta.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_product_sold", {
    p_product_id: parsed.data.product_id,
    p_sale_date: parsed.data.sale_date,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_exchange_rate: parsed.data.exchange_rate,
    p_customer_id: parsed.data.customer_id ?? null,
    p_payment_method: parsed.data.payment_method ?? null,
    p_amount_received: parsed.data.amount_received,
    p_cash_account_id: parsed.data.cash_account_id ?? null,
    p_due_date: parsed.data.due_date ?? null,
    p_notes: parsed.data.notes ?? null,
    p_expenses: parsed.data.expenses as unknown as Json,
    p_allow_date_before_purchase: parsed.data.allow_date_before_purchase,
  });

  if (error) return fail(safeErrorMessage(error));

  revalidateProduct(parsed.data.product_id);
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/liquidez");
  return ok({ saleId: data as string });
}

export async function cancelSaleAction(saleId: unknown, reason: string): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(saleId);
  if (!id.success) return fail("Venta inválida.");
  if (!reason || reason.trim().length < 3) {
    return fail("Indique el motivo de la cancelación.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", {
    p_sale_id: id.data,
    p_reason: reason.trim(),
  });

  if (error) return fail(safeErrorMessage(error));
  revalidatePath("/admin/ventas");
  revalidateProduct();
  return ok(null);
}
