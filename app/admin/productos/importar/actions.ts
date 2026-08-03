"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { uniqueProductSlug } from "@/services/products/slug";
import {
  cellToBoolean,
  cellToMovement,
  cellToNumber,
  cellToPublicationStatus,
  cellToText,
  parseImportWorkbook,
} from "@/services/products/bulk-import";
import type { CurrencyCode, MovementType, ProductStatus } from "@/types/supabase";

export type BulkImportRowResult = {
  row: number;
  ok: boolean;
  message: string;
  productId?: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Importa productos en lote desde la planilla de plantilla (.xlsx).
 * Cada fila se procesa de forma independiente: una fila con error no
 * afecta a las demás. Los productos se crean SIEMPRE como no publicados
 * por defecto (o el estado indicado en la fila); publicar sigue siendo
 * una acción explícita posterior.
 */
export async function bulkImportProductsAction(
  formData: FormData
): Promise<ActionResult<{ results: BulkImportRowResult[] }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para importar productos.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Seleccione el archivo de la planilla (.xlsx).");
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("El archivo supera el máximo de 5 MB.");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return fail("Solo se aceptan archivos .xlsx (el de la plantilla descargable).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseImportWorkbook(buffer);
  if (!parsed.ok) return fail(parsed.error);

  if (parsed.sheet.rows.length === 0) {
    return fail("La planilla no contiene filas con datos.");
  }
  if (parsed.sheet.rows.length > 300) {
    return fail("Máximo 300 filas por importación. Divida la planilla en lotes más pequeños.");
  }

  const supabase = await createClient();

  // Cotización activa como respaldo si una fila no especifica la suya.
  let fallbackRate: number | null = null;
  const { data: rateRows } = await supabase.rpc("get_active_usd_uyu_rate");
  if (rateRows && rateRows[0]) {
    const rate = Number(rateRows[0].rate);
    if (Number.isFinite(rate) && rate > 0) fallbackRate = rate;
  }

  const results: BulkImportRowResult[] = [];
  let created = 0;

  for (const row of parsed.sheet.rows) {
    const name = cellToText(row.get("nombre"));
    const brand = cellToText(row.get("marca"));

    if (!name || !brand) {
      results.push({
        row: row.rowNumber,
        ok: false,
        message: "Faltan 'nombre' y/o 'marca' (obligatorios).",
      });
      continue;
    }

    try {
      const model = cellToText(row.get("modelo")) ?? "";
      const slug = await uniqueProductSlug(supabase, `${brand} ${model || name}`);
      const status = cellToPublicationStatus(row.get("estado_publicacion")) as ProductStatus;

      const { data: inserted, error: insertError } = await supabase
        .from("products")
        .insert({
          name,
          brand,
          model,
          reference_number: cellToText(row.get("referencia")),
          year_approx: cellToNumber(row.get("anio")),
          movement: cellToMovement(row.get("movimiento")) as MovementType,
          case_material: cellToText(row.get("material_caja")),
          strap_material: cellToText(row.get("material_correa")),
          diameter_mm: cellToNumber(row.get("diametro_mm")),
          water_resistance: cellToText(row.get("resistencia_agua")),
          gender: cellToText(row.get("genero")),
          condition: cellToText(row.get("estado_conservacion")) ?? "",
          includes_box: cellToBoolean(row.get("incluye_caja")),
          includes_documentation: cellToBoolean(row.get("incluye_documentacion")),
          includes_accessories: cellToText(row.get("accesorios")),
          public_description: cellToText(row.get("descripcion")) ?? "",
          is_featured: cellToBoolean(row.get("destacado")),
          slug,
          status,
          is_published: false,
          created_by: ctx.userId,
          updated_by: ctx.userId,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        results.push({
          row: row.rowNumber,
          ok: false,
          message: safeErrorMessage(insertError ?? new Error("No se pudo crear el producto.")),
        });
        continue;
      }

      created++;
      let message = "Reloj creado.";

      const price = cellToNumber(row.get("precio"));
      if (price !== null && price >= 0) {
        const currencyText = cellToText(row.get("moneda_precio"))?.toUpperCase();
        const currency: CurrencyCode = currencyText === "UYU" ? "UYU" : "USD";
        const rowRate = cellToNumber(row.get("cotizacion_precio"));
        const rate = rowRate && rowRate > 0 ? rowRate : fallbackRate;

        if (rate && rate > 0) {
          const { error: priceError } = await supabase.rpc("set_listing_price", {
            p_product_id: inserted.id,
            p_amount: price,
            p_currency: currency,
            p_exchange_rate: rate,
          });
          message = priceError
            ? "Reloj creado; el precio no se pudo guardar (revisar manualmente)."
            : "Reloj creado con precio de lista.";
        } else {
          message = "Reloj creado sin precio (falta una cotización activa o en la fila).";
        }
      }

      results.push({ row: row.rowNumber, ok: true, message, productId: inserted.id });
    } catch (error) {
      results.push({ row: row.rowNumber, ok: false, message: safeErrorMessage(error) });
    }
  }

  if (created > 0) {
    revalidatePath("/admin/productos");
    revalidatePath("/admin/inventario");
    revalidatePath("/admin/dashboard");
  }

  return ok({ results });
}
