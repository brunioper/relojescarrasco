"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { customerSchema, supplierSchema } from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";

export async function saveCustomerAction(
  customerId: string | null,
  input: unknown
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del cliente.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  if (customerId) {
    const id = uuidSchema.safeParse(customerId);
    if (!id.success) return fail("Cliente inválido.");
    const { error } = await supabase
      .from("customers")
      .update({ ...parsed.data, updated_by: ctx.userId })
      .eq("id", id.data);
    if (error) return fail(safeErrorMessage(error));
  } else {
    const { error } = await supabase
      .from("customers")
      .insert({ ...parsed.data, created_by: ctx.userId, updated_by: ctx.userId });
    if (error) return fail(safeErrorMessage(error));
  }

  revalidatePath("/admin/contactos");
  return ok(null);
}

export async function deleteCustomerAction(customerId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(customerId);
  if (!id.success) return fail("Cliente inválido.");

  const supabase = await createClient();
  // Baja lógica: preserva la referencia histórica en ventas.
  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidatePath("/admin/contactos");
  return ok(null);
}

export async function saveSupplierAction(
  supplierId: string | null,
  input: unknown
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del proveedor.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  if (supplierId) {
    const id = uuidSchema.safeParse(supplierId);
    if (!id.success) return fail("Proveedor inválido.");
    const { error } = await supabase
      .from("suppliers")
      .update({ ...parsed.data, updated_by: ctx.userId })
      .eq("id", id.data);
    if (error) return fail(safeErrorMessage(error));
  } else {
    const { error } = await supabase
      .from("suppliers")
      .insert({ ...parsed.data, created_by: ctx.userId, updated_by: ctx.userId });
    if (error) return fail(safeErrorMessage(error));
  }

  revalidatePath("/admin/contactos");
  return ok(null);
}

export async function deleteSupplierAction(supplierId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(supplierId);
  if (!id.success) return fail("Proveedor inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidatePath("/admin/contactos");
  return ok(null);
}
