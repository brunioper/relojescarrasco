"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import {
  cashAccountSchema,
  cashMovementSchema,
  cashTransferSchema,
} from "@/lib/validation/schemas";
import { convertForStorage } from "@/services/finance/currency";

function revalidateCash() {
  revalidatePath("/admin/liquidez");
  revalidatePath("/admin/dashboard");
}

export async function createCashAccountAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = cashAccountSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos de la cuenta.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cash_accounts").insert({
    name: parsed.data.name,
    currency: parsed.data.currency,
    account_type: parsed.data.account_type,
    initial_balance: parsed.data.initial_balance,
    created_by: ctx.userId,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateCash();
  return ok(null);
}

/** Movimiento manual: aporte/retiro del dueño, otros ingresos/egresos, ajustes. */
export async function createCashMovementAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del movimiento.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("cash_accounts")
    .select("currency, is_active")
    .eq("id", parsed.data.account_id)
    .single();
  if (!account || !account.is_active) return fail("La cuenta no existe o está inactiva.");

  const money = convertForStorage(
    parsed.data.amount,
    account.currency,
    parsed.data.exchange_rate
  );

  const { error } = await supabase.from("cash_transactions").insert({
    account_id: parsed.data.account_id,
    transaction_date: parsed.data.transaction_date,
    type: parsed.data.type,
    amount: money.amount,
    exchange_rate: money.exchangeRate,
    amount_usd: money.amountUsd,
    amount_uyu: money.amountUyu,
    description: parsed.data.description,
    created_by: ctx.userId,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateCash();
  return ok(null);
}

/** Transferencia entre cuentas (incluye cambio USD <-> UYU) vía RPC atómica. */
export async function createTransferAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const parsed = cashTransferSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos de la transferencia.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_cash_transfer", {
    p_from_account: parsed.data.from_account,
    p_to_account: parsed.data.to_account,
    p_date: parsed.data.transaction_date,
    p_amount_from: parsed.data.amount_from,
    p_amount_to: parsed.data.amount_to,
    p_exchange_rate: parsed.data.exchange_rate,
    p_description: parsed.data.description,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateCash();
  return ok(null);
}
