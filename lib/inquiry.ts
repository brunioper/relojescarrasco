/**
 * Mensajes de consulta por un producto (Instagram / WhatsApp).
 *
 * Instagram no permite pre-cargar texto en un DM desde un link (a
 * diferencia de wa.me). Por eso el botón copia este mensaje al
 * portapapeles y abre el chat: el cliente solo tiene que pegarlo.
 */

export type InquiryProduct = {
  brand: string;
  name: string;
  model?: string | null;
  referenceNumber?: string | null;
};

/** "Rolex Datejust 36 (ref. 16233)" sin repetir la marca ni el modelo. */
export function inquiryProductLabel(product: InquiryProduct): string {
  const name = product.name.trim();
  const lower = name.toLowerCase();
  const parts: string[] = [];

  if (product.brand && !lower.includes(product.brand.trim().toLowerCase())) {
    parts.push(product.brand.trim());
  }
  parts.push(name);
  if (product.model && !lower.includes(product.model.trim().toLowerCase())) {
    parts.push(product.model.trim());
  }

  let label = parts.join(" ");
  const ref = product.referenceNumber?.trim();
  if (ref && !label.toLowerCase().includes(ref.toLowerCase())) {
    label += ` (ref. ${ref})`;
  }
  return label;
}

export function buildInquiryMessage(product: InquiryProduct, productUrl?: string | null): string {
  const base = `Hola, me interesa el ${inquiryProductLabel(product)} que vi en la web de Relojes Carrasco. ¿Sigue disponible?`;
  return productUrl ? `${base}\n${productUrl}` : base;
}

/** Usuario de Instagram a partir de la URL de perfil configurada en el panel. */
export function instagramUsernameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return null;
    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    return segment || null;
  } catch {
    return null;
  }
}

/** Link directo al chat (DM) de Instagram con la cuenta del negocio. */
export function instagramDmUrl(username: string): string {
  return `https://ig.me/m/${username}`;
}
