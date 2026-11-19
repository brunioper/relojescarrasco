import { z } from "zod/v4";
import { aiSuggestionSchema, toFormSuggestion } from "@/lib/ai/product-suggestion";

/**
 * Lo que la IA devuelve al mirar una historia o publicación de Instagram:
 * la misma ficha que en la carga manual, más tres datos para decidir si
 * se publica sola.
 */
export const listingSchema = aiSuggestionSchema.extend({
  is_single_product_offer: z.boolean(),
  sale_status: z.enum(["vendido", "reservado"]).nullable(),
  visible_price: z
    .object({
      amount: z.number(),
      currency: z.enum(["USD", "UYU", "desconocida"]),
    })
    .nullable(),
});

export type ListingDetection = z.infer<typeof listingSchema>;

export function listingCategory(listing: Pick<ListingDetection, "product_type">): "reloj" | "accesorio" | null {
  if (listing.product_type === "reloj") return "reloj";
  if (listing.product_type === "correa" || listing.product_type === "accesorio") return "accesorio";
  return null;
}

export type ListingProductInput = {
  category: "reloj" | "accesorio";
  name: string;
  brand: string;
  model: string;
  reference_number: string | null;
  movement: "automatico" | "manual" | "cuarzo" | "solar" | "otro";
  case_material: string | null;
  strap_material: string | null;
  diameter_mm: number | null;
  public_description: string;
  condition: string;
  stock_quantity: number | null;
  sale_mode: "consultar";
  is_new: boolean;
};

/**
 * Datos del producto a crear. Nada que la IA no vea: estado, año, caja y
 * papeles quedan vacíos para que los complete una persona.
 */
export function productInputFromListing(
  listing: ListingDetection,
  category: "reloj" | "accesorio"
): ListingProductInput | null {
  const form = toFormSuggestion(listing, category);
  if (!form.brand) return null;
  const fallbackName = [form.brand, form.model].filter(Boolean).join(" ");
  return {
    category,
    name: (form.name ?? fallbackName).slice(0, 200),
    brand: form.brand,
    model: form.model ?? "",
    reference_number: form.reference_number,
    // Si no se lee el movimiento, "otro": nunca se inventa.
    movement: form.movement ?? "otro",
    case_material: form.case_material,
    strap_material: form.strap_material,
    diameter_mm: form.diameter_mm,
    public_description: form.public_description ?? "",
    condition: "",
    stock_quantity: category === "accesorio" ? 1 : null,
    sale_mode: "consultar",
    is_new: false,
  };
}
