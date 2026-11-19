"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { uuidSchema } from "@/lib/validation/money";
import { listingSchema, productInputFromListing, type ListingProductInput } from "@/lib/ai/listing";
import { MAX_PRICE_USD, MIN_PRICE_USD } from "@/lib/instagram/decide";
import { InstagramApiError } from "@/services/instagram-sync/graph";
import { InstagramNotSetUpError, saveConnection } from "@/services/instagram-sync/connection";
import {
  copyImportImagesToProduct,
  createProductFromImport,
  publishWithPrice,
} from "@/services/instagram-sync/products";

/**
 * Bandeja de Instagram. Toda acción exige un administrador; las escrituras
 * usan el cliente del servidor (las fotos de Instagram viven en una carpeta
 * que solo él maneja) y registran a la persona como autora.
 */

function revalidate(productId?: string | null) {
  revalidatePath("/admin/instagram");
  revalidatePath("/admin/productos");
  if (productId) revalidatePath(`/admin/productos/${productId}`);
  revalidatePath("/catalogo");
  revalidatePath("/", "layout");
}

async function loadImport(importId: unknown) {
  const id = uuidSchema.safeParse(importId);
  if (!id.success) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("instagram_imports").select("*").eq("id", id.data).maybeSingle();
  return data;
}

const RESOLVABLE = ["pendiente", "borrador", "descartado", "error", "sin_ia"];

// ------------------------------------------------------------
// Conexión
// ------------------------------------------------------------
export async function connectInstagramAction(token: unknown): Promise<ActionResult<{ username: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = z.string().trim().min(20, "Pegá el token completo.").max(1000).safeParse(token);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Token inválido.");

  try {
    const { username } = await saveConnection(createAdminClient(), parsed.data, ctx.userId);
    revalidatePath("/admin/instagram");
    return ok({ username });
  } catch (error) {
    if (error instanceof InstagramNotSetUpError) return fail(error.message);
    if (error instanceof InstagramApiError) {
      return fail("Instagram no aceptó el token. Generá uno nuevo y pegalo completo.");
    }
    return fail("No se pudo conectar Instagram. Probá de nuevo.");
  }
}

export async function disconnectInstagramAction(): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  await createAdminClient().from("instagram_connection").delete().eq("id", 1);
  revalidatePath("/admin/instagram");
  return ok(null);
}

export async function setAutoPublishAction(enabled: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const { error } = await createAdminClient()
    .from("instagram_connection")
    .update({ auto_publish: enabled === true })
    .eq("id", 1);
  if (error) return fail("No se pudo guardar.");
  revalidatePath("/admin/instagram");
  return ok(null);
}

// ------------------------------------------------------------
// Resolver una pieza de la bandeja
// ------------------------------------------------------------
export async function discardImportAction(importId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const row = await loadImport(importId);
  if (!row) return fail("No se encontró.");

  await createAdminClient()
    .from("instagram_imports")
    .update({
      status: "descartado",
      reason: "Descartado a mano.",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  revalidate();
  return ok(null);
}

/** "Es el mismo": agrega las fotos al producto existente. */
export async function addPhotosToProductAction(importId: unknown, productId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const row = await loadImport(importId);
  const product = uuidSchema.safeParse(productId);
  if (!row || !product.success) return fail("No se encontró.");
  if (!RESOLVABLE.includes(row.status)) return fail("Esta pieza ya se resolvió.");
  if (row.image_paths.length === 0) return fail("Esta pieza no tiene fotos guardadas.");

  const admin = createAdminClient();
  const copied = await copyImportImagesToProduct(admin, row.image_paths, product.data, ctx.userId);
  if (copied === 0) return fail("No se pudieron copiar las fotos.");

  await admin
    .from("instagram_imports")
    .update({
      status: "aprobado",
      reason: `Fotos agregadas a un producto existente (${copied}).`,
      product_id: product.data,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  revalidate(product.data);
  return ok(null);
}

const createSchema = z.object({
  category: z.enum(["reloj", "accesorio"]),
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(200),
  brand: z.string().trim().min(1, "La marca es obligatoria.").max(100),
  model: z.string().trim().max(100).default(""),
  reference_number: z.string().trim().max(60).default(""),
  price_usd: z
    .union([z.literal(""), z.coerce.number().min(MIN_PRICE_USD).max(MAX_PRICE_USD)])
    .optional(),
});

/** "Es otro" (o no se pudo leer la marca): crea el producto con lo revisado. */
export async function createFromImportAction(
  importId: unknown,
  values: unknown
): Promise<ActionResult<{ productId: string; published: boolean }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const row = await loadImport(importId);
  if (!row) return fail("No se encontró.");
  if (!RESOLVABLE.includes(row.status) || row.product_id) return fail("Esta pieza ya se resolvió.");

  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisá los datos.");
  const form = parsed.data;

  const listing = listingSchema.safeParse(row.ai_result);
  const fromAi = listing.success ? productInputFromListing(listing.data, form.category) : null;
  const data: ListingProductInput = {
    category: form.category,
    name: form.name,
    brand: form.brand,
    model: form.model,
    reference_number: form.reference_number || null,
    movement: fromAi?.movement ?? "otro",
    case_material: fromAi?.case_material ?? null,
    strap_material: fromAi?.strap_material ?? null,
    diameter_mm: fromAi?.diameter_mm ?? null,
    public_description: fromAi?.public_description ?? "",
    condition: "",
    stock_quantity: form.category === "accesorio" ? 1 : null,
    sale_mode: "consultar",
    is_new: false,
  };

  const admin = createAdminClient();
  let productId: string;
  try {
    productId = await createProductFromImport(admin, {
      data,
      status: "disponible",
      imagePaths: row.image_paths,
      permalink: row.permalink,
      actorId: ctx.userId,
    });
  } catch {
    return fail("No se pudo crear el producto.");
  }

  let published = false;
  let reason = "Creado a mano desde la bandeja (sin publicar).";
  if (typeof form.price_usd === "number") {
    const result = await publishWithPrice(admin, productId, form.price_usd, ctx.userId);
    published = result.ok;
    reason = result.ok ? "Creado y publicado desde la bandeja." : result.reason;
  }

  await admin
    .from("instagram_imports")
    .update({
      status: published ? "publicado" : "aprobado",
      reason,
      product_id: productId,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  revalidate(productId);
  return ok({ productId, published });
}

/** Producto creado sin precio: se carga el precio y se publica. */
export async function publishImportProductAction(
  importId: unknown,
  priceUsd: unknown
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const row = await loadImport(importId);
  if (!row?.product_id) return fail("No se encontró el producto.");

  const price = z.coerce
    .number({ invalid_type_error: "Ingresá el precio en dólares." })
    .min(MIN_PRICE_USD, "El precio parece demasiado bajo.")
    .max(MAX_PRICE_USD, "El precio parece demasiado alto.")
    .safeParse(priceUsd);
  if (!price.success) return fail(price.error.issues[0]?.message ?? "Precio inválido.");

  const admin = createAdminClient();
  const result = await publishWithPrice(admin, row.product_id, price.data, ctx.userId);
  if (!result.ok) return fail(result.reason.replace("Creado sin publicar: ", ""));

  await admin
    .from("instagram_imports")
    .update({
      status: "publicado",
      reason: "Publicado desde la bandeja.",
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  revalidate(row.product_id);
  return ok(null);
}
