import type { CatalogMatch } from "@/lib/instagram/duplicates";

/**
 * Qué hacer con una historia o publicación, según lo que vio la IA y lo
 * que ya hay en el catálogo. Lógica pura.
 */

export type ListingSignals = {
  product_type: "reloj" | "correa" | "accesorio" | "desconocido";
  is_single_product_offer: boolean;
  sale_status: "vendido" | "reservado" | null;
  brand: string | null;
  visible_price: { amount: number; currency: "USD" | "UYU" | "desconocida" } | null;
};

export type ImportDecision =
  | { action: "descartar"; reason: string }
  | { action: "pendiente"; reason: string; matches: string[] }
  | {
      action: "crear";
      status: "disponible" | "reservado";
      publishPriceUsd: number | null;
      reason: string;
    };

export const MIN_PRICE_USD = 10;
export const MAX_PRICE_USD = 1_000_000;

/** Precio en dólares leído de la imagen, si es usable para publicar. */
export function usablePriceUsd(price: ListingSignals["visible_price"]): number | null {
  if (!price || price.currency !== "USD") return null;
  if (!Number.isFinite(price.amount)) return null;
  if (price.amount < MIN_PRICE_USD || price.amount > MAX_PRICE_USD) return null;
  return Math.round(price.amount * 100) / 100;
}

const formatUsd = (amount: number) => `US$ ${amount.toLocaleString("es-UY")}`;

export function decideImport(input: {
  signals: ListingSignals;
  matches: CatalogMatch[];
  autoPublish: boolean;
}): ImportDecision {
  const { signals, matches, autoPublish } = input;

  if (signals.product_type === "desconocido" || !signals.is_single_product_offer) {
    return {
      action: "descartar",
      reason: "No parece un producto a la venta (puede ser el local, un cliente o varios relojes juntos).",
    };
  }
  if (signals.sale_status === "vendido") {
    return { action: "descartar", reason: "La imagen dice que está vendido." };
  }
  if (!signals.brand) {
    return {
      action: "pendiente",
      reason: "No se pudo leer la marca: revisalo y crealo desde acá.",
      matches: [],
    };
  }
  if (matches.length > 0) {
    return {
      action: "pendiente",
      reason:
        matches.length === 1
          ? "Se parece a un producto que ya está en el catálogo: ¿es el mismo?"
          : `Se parece a ${matches.length} productos del catálogo: ¿es alguno de ellos?`,
      matches: matches.map((m) => m.productId),
    };
  }

  const status = signals.sale_status === "reservado" ? "reservado" : "disponible";
  const price = usablePriceUsd(signals.visible_price);

  if (!autoPublish) {
    return {
      action: "crear",
      status,
      publishPriceUsd: null,
      reason: "Creado sin publicar: la publicación automática está desactivada.",
    };
  }
  if (price !== null) {
    return {
      action: "crear",
      status,
      publishPriceUsd: price,
      reason: `Publicado con el precio de la imagen: ${formatUsd(price)}.`,
    };
  }
  return {
    action: "crear",
    status,
    publishPriceUsd: null,
    reason:
      signals.visible_price?.currency === "UYU"
        ? "Creado sin publicar: el precio está en pesos. Confirmalo en dólares para publicarlo."
        : "Creado sin publicar: la imagen no muestra el precio. Cargalo para publicarlo.",
  };
}
