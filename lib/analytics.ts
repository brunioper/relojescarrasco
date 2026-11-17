/**
 * Eventos de medición (Meta Pixel).
 *
 * Solo hace algo si el Pixel está cargado (ver components/public/meta-pixel.tsx,
 * que a su vez solo se activa con NEXT_PUBLIC_META_PIXEL_ID). Sin Pixel,
 * estas funciones no hacen nada: se pueden llamar siempre.
 */

type Fbq = (action: "track" | "trackCustom", event: string, params?: Record<string, unknown>) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof candidate === "function" ? candidate : null;
}

export type TrackedProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  priceUsd: number;
};

function productParams(product: TrackedProduct): Record<string, unknown> {
  return {
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category,
    content_type: "product",
    brand: product.brand,
    value: product.priceUsd,
    currency: "USD",
  };
}

/** Vista de la ficha de un producto. */
export function trackViewContent(product: TrackedProduct): void {
  fbq()?.("track", "ViewContent", productParams(product));
}

/** Clic en un botón de consulta (Instagram, WhatsApp o formulario). */
export function trackContact(
  channel: "instagram" | "whatsapp" | "formulario",
  product?: TrackedProduct
): void {
  fbq()?.("track", "Contact", { channel, ...(product ? productParams(product) : {}) });
}

/** Envío del formulario "Vendé tu reloj". */
export function trackLead(source: string): void {
  fbq()?.("track", "Lead", { source });
}
