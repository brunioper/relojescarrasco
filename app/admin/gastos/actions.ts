"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { generalExpenseSchema } from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";
import { convertForStorage } from "@/services/finance/currency";

export async function saveGeneralExpenseAction(
  expenseId: string | null,
  input: unknown
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para gestionar gastos.");

  const parsed = generalExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del gasto.", parsed.error.flatten().fieldErrors);
  }

  const money = convertForStorage(
    parsed.data.amount,
    parsed.data.currency,
    parsed.data.exchange_rate
  );

  const payload = {
    expense_date: parsed.data.expense_date,
    category_id: parsed.data.category_id,
    description: parsed.data.description,
    amount: money.amount,
    currency: money.currency,
    exchange_rate: money.exchangeRate,
    amount_usd: money.amountUsd,
    amount_uyu: money.amountUyu,
    supplier_id: parsed.data.supplier_id ?? null,
    payment_method: parsed.data.payment_method ?? null,
    due_date: parsed.data.due_date ?? null,
    is_recurring: parsed.data.is_recurring,
    notes: parsed.data.notes ?? null,
    updated_by: ctx.userId,
  };

  const supabase = await createClient();

  if (expenseId) {
    const id = uuidSchema.safeParse(expenseId);
    if (!id.success) return fail("Gasto inválido.");
    const { error } = await supabase.from("general_expenses").update(payload).eq("id", id.data);
    if (error) return fail(safeErrorMessage(error));
  } else {
    const { error } = await supabase
      .from("general_expenses")
      .insert({ ...payload, created_by: ctx.userId });
    if (error) return fail(safeErrorMessage(error));
  }

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/pagos");
  return ok(null);
}

export async function deleteGeneralExpenseAction(expenseId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(expenseId);
  if (!id.success) return fail("Gasto inválido.");

  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("general_expenses")
    .select("payment_status")
    .eq("id", id.data)
    .single();
  if (!expense) return fail("El gasto no existe.");
  if (expense.payment_status === "pagado" || expense.payment_status === "parcial") {
    return fail("El gasto tiene pagos registrados: elimine primero los pagos.");
  }

  const { error } = await supabase
    .from("general_expenses")
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidatePath("/admin/gastos");
  return ok(null);
}
