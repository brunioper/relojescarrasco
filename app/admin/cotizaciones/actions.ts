"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { exchangeRateSchema } from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";

function revalidateRates() {
  revalidatePath("/admin/cotizaciones");
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout"); // el catálogo usa la cotización activa
  revalidatePath("/catalogo");
}

/** Alta manual de cotización (el histórico es inmutable: nunca update de valores). */
export async function createExchangeRateAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para gestionar cotizaciones.");

  const parsed = exchangeRateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos de la cotización.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("exchange_rates").insert({
    base_currency: "USD",
    quote_currency: "UYU",
    rate: parsed.data.rate,
    buy_rate: parsed.data.buy_rate ?? null,
    sell_rate: parsed.data.sell_rate ?? null,
    rate_date: parsed.data.rate_date,
    source: parsed.data.source,
    is_manual: true,
    is_active: true,
    created_by: ctx.userId,
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateRates();
  return ok(null);
}

/** Activa/desactiva una cotización (única modificación permitida). */
export async function toggleRateActiveAction(
  rateId: unknown,
  isActive: boolean
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(rateId);
  if (!id.success) return fail("Cotización inválida.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("exchange_rates")
    .update({ is_active: isActive })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidateRates();
  return ok(null);
}

/** Cambia el modo de cotización del catálogo (última activa o valor fijo). */
export async function setCatalogueRateModeAction(input: {
  mode: "latest" | "fixed";
  value?: number | null;
}): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  if (input.mode === "fixed") {
    if (!input.value || !Number.isFinite(input.value) || input.value <= 0) {
      return fail("Ingrese un valor de cotización fija mayor que cero.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("application_settings").upsert({
    key: "catalogue_exchange_rate",
    value: {
      mode: input.mode,
      value: input.mode === "fixed" ? input.value : null,
      source: input.mode === "fixed" ? "manual_fijo" : "ultima_activa",
      effective_date: new Date().toISOString().slice(0, 10),
      is_manual: input.mode === "fixed",
    },
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });

  if (error) return fail(safeErrorMessage(error));
  revalidateRates();
  return ok(null);
}
