"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import {
  accessorySaleSchema,
  compatibilitySaveSchema,
  variantsSaveSchema,
} from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";
import { findDuplicateVariant, variantLabel } from "@/lib/variants";

/**
 * Server Actions de variantes y compatibilidad de accesorios.
 * Misma cadena que el resto del panel: sesión → rol admin → Zod → base
 * (RLS + triggers). El stock total del producto lo recalcula la base.
 */

function revalidate(productId: string) {
  revalidatePath(`/admin/productos/${productId}`);
  revalidatePath("/admin/productos");
  revalidatePath("/admin/inventario");
  revalidatePath("/catalogo");
  revalidatePath("/", "layout");
}

/** Guarda la tabla completa de variantes: crea, actualiza y quita las que ya no están. */
export async function saveVariantsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para editar variantes.");

  const parsed = variantsSaveSchema.safeParse(input);
  if (!parsed.success) return fail("Revise los datos de las variantes (anchos, stock y precios).");

  const { product_id: productId, rows } = parsed.data;
  const normalized = rows.map((row) => ({
    id: row.id ?? null,
    width_mm: row.width_mm ?? null,
    material: row.material ?? null,
    color: row.color ?? null,
    sku: row.sku ?? null,
    stock_quantity: row.stock_quantity,
    price_usd: row.price_usd ?? null,
    is_active: row.is_active,
  }));

  const duplicate = findDuplicateVariant(normalized);
  if (duplicate) return fail(`Hay una variante repetida: ${variantLabel(duplicate)}.`);

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, category")
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!product) return fail("El producto no existe.");
  if (product.category !== "accesorio") return fail("Las variantes son solo para accesorios.");

  const { data: existing, error: readError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);
  if (readError) return fail(safeErrorMessage(readError));

  const existingIds = new Set((existing ?? []).map((v) => v.id));
  const keptIds = new Set(normalized.map((r) => r.id).filter((id): id is string => id !== null));
  if ([...keptIds].some((id) => !existingIds.has(id))) {
    return fail("La lista de variantes cambió. Recargue la página e intente de nuevo.");
  }

  // 1) Quitar las que ya no están (libera combinaciones antes de actualizar).
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", toDelete);
    if (error) return fail(safeErrorMessage(error));
  }

  // 2) Actualizar las existentes.
  for (const [index, row] of normalized.entries()) {
    if (row.id === null) continue;
    const { error } = await supabase
      .from("product_variants")
      .update({
        width_mm: row.width_mm,
        material: row.material,
        color: row.color,
        sku: row.sku,
        stock_quantity: row.stock_quantity,
        price_usd: row.price_usd,
        is_active: row.is_active,
        sort_order: index,
        updated_by: ctx.userId,
      })
      .eq("id", row.id)
      .eq("product_id", productId);
    if (error) return fail(safeErrorMessage(error));
  }

  // 3) Crear las nuevas.
  const toInsert = normalized
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.id === null)
    .map(({ row, index }) => ({
      product_id: productId,
      width_mm: row.width_mm,
      material: row.material,
      color: row.color,
      sku: row.sku,
      stock_quantity: row.stock_quantity,
      price_usd: row.price_usd,
      is_active: row.is_active,
      sort_order: index,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
  if (toInsert.length > 0) {
    const { error } = await supabase.from("product_variants").insert(toInsert);
    if (error) return fail(safeErrorMessage(error));
  }

  revalidate(productId);
  return ok({ count: normalized.length });
}

/** Reemplaza la lista de relojes compatibles (marca / modelo) de un accesorio. */
export async function saveCompatibilityAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = compatibilitySaveSchema.safeParse(input);
  if (!parsed.success) return fail("Revise las marcas y modelos compatibles.");

  const { product_id: productId, items } = parsed.data;
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.brand.toLowerCase()}|${(item.model ?? "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("product_compatibility")
    .delete()
    .eq("product_id", productId);
  if (deleteError) return fail(safeErrorMessage(deleteError));

  if (unique.length > 0) {
    const { error } = await supabase.from("product_compatibility").insert(
      unique.map((item) => ({
        product_id: productId,
        brand: item.brand,
        model: item.model ?? null,
        created_by: ctx.userId,
      }))
    );
    if (error) return fail(safeErrorMessage(error));
  }

  revalidate(productId);
  return ok(null);
}

/** Venta de unidades de una variante (descuenta el stock de esa variante). */
export async function sellVariantStockAction(
  variantId: unknown,
  input: unknown
): Promise<ActionResult<{ saleId: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para registrar ventas.");

  const id = uuidSchema.safeParse(variantId);
  const parsed = accessorySaleSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return fail(
      "Verifique los datos de la venta.",
      parsed.success ? undefined : parsed.error.flatten().fieldErrors
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_variant_stock", {
    p_variant_id: id.data,
    p_quantity: parsed.data.quantity,
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
  });

  if (error) return fail(safeErrorMessage(error));

  revalidate(parsed.data.product_id);
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/liquidez");
  revalidatePath("/admin/dashboard");
  return ok({ saleId: data as string });
}
