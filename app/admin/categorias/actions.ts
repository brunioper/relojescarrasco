"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";

const kindSchema = z.enum(["costo_producto", "gasto_general", "gasto_venta"]);

/**
 * Crea una categoría de costo/gasto al vuelo (o reutiliza una existente
 * con el mismo nombre, sin distinguir mayúsculas). Permite que el admin
 * agregue categorías nuevas directamente desde los formularios de costos
 * y gastos, sin depender de una carga manual en la base.
 */
export async function createExpenseCategoryAction(
  name: unknown,
  kind: unknown
): Promise<ActionResult<{ id: string; name: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para crear categorías.");

  const nameParsed = z
    .string()
    .trim()
    .min(2, "El nombre de la categoría debe tener al menos 2 caracteres.")
    .max(100)
    .safeParse(name);
  const kindParsed = kindSchema.safeParse(kind);

  if (!nameParsed.success) {
    return fail(nameParsed.error.issues[0]?.message ?? "Nombre inválido.");
  }
  if (!kindParsed.success) return fail("Tipo de categoría inválido.");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("kind", kindParsed.data)
    .ilike("name", nameParsed.data)
    .maybeSingle();
  if (existing) return ok(existing);

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ name: nameParsed.data, kind: kindParsed.data })
    .select("id, name")
    .single();

  if (error) return fail(safeErrorMessage(error));

  revalidatePath("/admin/productos");
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/ventas");
  return ok(data);
}
