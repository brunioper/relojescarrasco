import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  addUsage,
  budgetExceeded,
  readBudget,
  readUsage,
  usageMonth,
  type AiUsage,
} from "@/lib/ai/product-suggestion";

/**
 * Tope de gasto mensual de IA (compartido por la carga manual y la
 * revisión automática de Instagram). Se lee y se escribe con el cliente
 * service role, siempre después de verificar quién hace el pedido.
 */
export async function readAiBudget(
  admin: SupabaseClient<Database>
): Promise<{ usage: AiUsage; budget: number; exceeded: boolean }> {
  const { data } = await admin
    .from("application_settings")
    .select("key, value")
    .in("key", ["ai_usage", "ai_monthly_budget_usd"]);
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  const usage = readUsage(byKey.get("ai_usage"), usageMonth());
  const budget = readBudget(byKey.get("ai_monthly_budget_usd"));
  return { usage, budget, exceeded: budgetExceeded(usage, budget) };
}

export async function recordAiUsage(
  admin: SupabaseClient<Database>,
  usage: AiUsage,
  costUsd: number,
  actorId: string | null
): Promise<AiUsage> {
  const next = addUsage(usage, costUsd);
  await admin.from("application_settings").upsert({
    key: "ai_usage",
    value: next,
    description: "Uso de IA del mes en curso (lo actualiza el sistema)",
    updated_by: actorId,
  });
  return next;
}
