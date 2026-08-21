import "server-only";

import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/**
 * Aviso por email de un pedido nuevo. Best-effort: si falta la
 * configuración (RESEND_API_KEY / ORDER_NOTIFICATION_EMAIL) o falla
 * el envío, se registra en el servidor pero no se propaga el error —
 * el pedido ya quedó guardado y visible en /admin/pedidos de todas
 * formas, el email es solo una notificación.
 */
export async function sendOrderNotificationEmail(details: {
  productName: string;
  firstName: string;
  lastName: string;
  phone: string;
  instagramUsername: string | null;
  deliveryMethod: "envio" | "retiro";
  shippingAddress: string | null;
}): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.ORDER_NOTIFICATION_EMAIL) {
    console.error("[email] RESEND_API_KEY u ORDER_NOTIFICATION_EMAIL no configurados; no se envió el aviso.");
    return;
  }

  const deliveryLine =
    details.deliveryMethod === "envio"
      ? `Envío a: ${details.shippingAddress}`
      : "Retira en el local";

  const lines = [
    `Producto: ${details.productName}`,
    `Nombre: ${details.firstName} ${details.lastName}`,
    `Teléfono: ${details.phone}`,
    details.instagramUsername ? `Instagram: @${details.instagramUsername}` : null,
    deliveryLine,
    "Método de pago: transferencia o efectivo",
  ].filter(Boolean);

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Relojes Carrasco <onboarding@resend.dev>",
      to: env.ORDER_NOTIFICATION_EMAIL,
      subject: `Nuevo pedido: ${details.productName}`,
      text: lines.join("\n"),
    });
    if (error) {
      console.error("[email] error enviando aviso de pedido", { message: error.message });
    }
  } catch (error) {
    console.error("[email] excepción enviando aviso de pedido", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
