"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { uuidSchema } from "@/lib/validation/money";
import { z } from "zod";

const orderStatusSchema = z.enum(["nuevo", "contactado", "confirmado", "cancelado"]);

export async function updateOrderStatusAction(
  orderId: unknown,
  newStatus: unknown
): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");

  const id = uuidSchema.safeParse(orderId);
  const status = orderStatusSchema.safeParse(newStatus);
  if (!id.success || !status.success) return fail("Datos inválidos.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_requests")
    .update({ status: status.data })
    .eq("id", id.data);

  if (error) return fail(safeErrorMessage(error));
  revalidatePath("/admin/pedidos");
  return ok(null);
}
