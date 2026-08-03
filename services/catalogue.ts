import "server-only";

import { createAnonClient } from "@/lib/supabase/server";
import type { CatalogueProduct } from "@/types/supabase";

/**
 * Consultas del catálogo PÚBLICO.
 *
 * Siempre contra la vista public_catalogue_products (columnas seguras,
 * filas autorizadas) con el cliente ANÓNIMO: aunque este código corre
 * en el servidor, nunca tiene más privilegios que un visitante.
 * Nunca select("*") sobre tablas base en código público.
 */

export const CATALOGUE_PAGE_SIZE = 12;

export type CatalogueSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "updated";

export type CatalogueFilters = {
  q?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  movement?: string;
  condition?: string;
  box?: boolean;
  docs?: boolean;
  status?: "disponible" | "reservado";
  sort?: CatalogueSort;
  page?: number;
};

const SELECT_CARD_COLUMNS =
  "id, slug, name, brand, model, reference_number, movement, condition, includes_box, includes_documentation, status, is_featured, price_usd, published_at, cover_image_path, cover_image_alt" as const;

export type CatalogueCard = Pick<
  CatalogueProduct,
  | "id"
  | "slug"
  | "name"
  | "brand"
  | "model"
  | "reference_number"
  | "movement"
  | "condition"
  | "includes_box"
  | "includes_documentation"
  | "status"
  | "is_featured"
  | "price_usd"
  | "published_at"
  | "cover_image_path"
  | "cover_image_alt"
>;

export async function fetchCataloguePage(filters: CatalogueFilters): Promise<{
  products: CatalogueCard[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const supabase = createAnonClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * CATALOGUE_PAGE_SIZE;
  const to = from + CATALOGUE_PAGE_SIZE - 1;

  let query = supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS, { count: "exact" });

  if (filters.q) {
    const term = filters.q.replace(/[%_,]/g, " ").trim();
    if (term) {
      query = query.or(
        `name.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,reference_number.ilike.%${term}%`
      );
    }
  }
  if (filters.brand) query = query.eq("brand", filters.brand);
  if (filters.movement) query = query.eq("movement", filters.movement as CatalogueProduct["movement"]);
  if (filters.condition) query = query.ilike("condition", `%${filters.condition}%`);
  if (filters.box !== undefined) query = query.eq("includes_box", filters.box);
  if (filters.docs !== undefined) query = query.eq("includes_documentation", filters.docs);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.minPrice !== undefined) query = query.gte("price_usd", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price_usd", filters.maxPrice);

  switch (filters.sort ?? "newest") {
    case "oldest":
      query = query.order("published_at", { ascending: true, nullsFirst: false });
      break;
    case "price_asc":
      query = query.order("price_usd", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_usd", { ascending: false });
      break;
    case "updated":
      query = query.order("updated_at", { ascending: false });
      break;
    default:
      query = query.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    console.error("[catalogue] error consultando catálogo", { code: error.code });
    return { products: [], total: 0, page: 1, pageCount: 0 };
  }

  const total = count ?? 0;
  return {
    products: (data ?? []) as CatalogueCard[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE)),
  };
}

export async function fetchFeaturedProducts(limit = 4): Promise<CatalogueCard[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .eq("is_featured", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as CatalogueCard[];
}

export async function fetchLatestProducts(limit = 8): Promise<CatalogueCard[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as CatalogueCard[];
}

export async function fetchProductBySlug(slug: string): Promise<CatalogueProduct | null> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  // select("*") es seguro AQUÍ: la vista solo contiene columnas públicas.
  return (data as CatalogueProduct | null) ?? null;
}

export async function fetchRelatedProducts(
  brand: string,
  excludeId: string,
  limit = 4
): Promise<CatalogueCard[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .eq("brand", brand)
    .neq("id", excludeId)
    .limit(limit);
  if (data && data.length > 0) return data as CatalogueCard[];

  const { data: fallback } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .neq("id", excludeId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (fallback ?? []) as CatalogueCard[];
}

export async function fetchCatalogueBrands(): Promise<string[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select("brand")
    .order("brand", { ascending: true });
  return [...new Set((data ?? []).map((r) => r.brand))];
}

export async function fetchAllSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select("slug, updated_at");
  return data ?? [];
}
