"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { paymentSchema } from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";

function revalidateFinance() {
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/liquidez");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/dashboard");
}

/**
 * Registra un pago/cobro (parcial o total) vía RPC atómica:
 * valida sobrepago, recalcula el estado del comprobante y crea el
 * movimiento de caja si se indica cuenta.
 */
export async function registerPaymentAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para registrar pagos.");

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del pago.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_payment", {
    p_transaction_type: parsed.data.transaction_type,
    p_transaction_id: parsed.data.transaction_id,
    p_payment_date: parsed.data.payment_date,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_exchange_rate: parsed.data.exchange_rate,
    p_payment_method: parsed.data.payment_method ?? null,
    p_cash_account_id: parsed.data.cash_account_id ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateFinance();
  return ok(null);
}

/** Elimina un pago erróneo (y su movimiento de caja asociado). */
export async function deletePaymentAction(paymentId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(paymentId);
  if (!id.success) return fail("Pago inválido.");

  const supabase = await createClient();

  // Eliminar primero los movimientos de caja vinculados.
  const { error: cashError } = await supabase
    .from("cash_transactions")
    .delete()
    .eq("payment_id", id.data);
  if (cashError) return fail(safeErrorMessage(cashError));

  const { error } = await supabase.from("payments").delete().eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));

  revalidateFinance();
  return ok(null);
}
