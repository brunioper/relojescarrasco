"use server";

import { createAnonClient } from "@/lib/supabase/server";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { orderRequestSchema } from "@/lib/validation/schemas";
import { sendOrderNotificationEmail } from "@/services/email";

/**
 * Server Action pública (sin sesión): crea un pedido desde la ficha
 * de producto. Usa el cliente ANÓNIMO — este código nunca tiene más
 * privilegios que un visitante (mismo principio que services/catalogue.ts).
 * La escritura pasa por la RPC create_order_request (SECURITY DEFINER),
 * no por un insert directo: `anon` no tiene policies de tabla (ver
 * migración de order_requests).
 */
export async function createOrderRequestAction(
  input: unknown,
  productName: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos del pedido.", parsed.error.flatten().fieldErrors);
  }
  // Honeypot: si viene completo, es un bot. Se descarta en silencio.
  if (parsed.data.website) {
    return ok({ id: "" });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("create_order_request", {
    p_product_id: parsed.data.product_id,
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name,
    p_phone: parsed.data.phone,
    p_instagram_username: parsed.data.instagram_username ?? null,
    p_delivery_method: parsed.data.delivery_method,
    p_shipping_address: parsed.data.shipping_address ?? null,
  });

  if (error) return fail(safeErrorMessage(error));

  await sendOrderNotificationEmail({
    productName,
    firstName: parsed.data.first_name,
    lastName: parsed.data.last_name,
    phone: parsed.data.phone,
    instagramUsername: parsed.data.instagram_username ?? null,
    deliveryMethod: parsed.data.delivery_method,
    shippingAddress: parsed.data.shipping_address ?? null,
  });

  return ok({ id: data as string });
}
