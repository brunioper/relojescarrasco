import "server-only";

import { createAnonClient } from "@/lib/supabase/server";
import type { CatalogueProduct, SoldProduct } from "@/types/supabase";
import { readCompatibility, readPublicVariants } from "@/lib/variants";
import {
  PRICE_RANGES,
  SIZE_RANGES,
  type CatalogueFilters,
  type CatalogueSort,
} from "@/lib/catalogue-params";

export type { CatalogueFilters, CatalogueSort };
export { PRICE_RANGES, SIZE_RANGES };

/**
 * Consultas del catálogo PÚBLICO.
 *
 * Siempre contra la vista public_catalogue_products (columnas seguras,
 * filas autorizadas) con el cliente ANÓNIMO: aunque este código corre
 * en el servidor, nunca tiene más privilegios que un visitante.
 * Nunca select("*") sobre tablas base en código público.
 */

export const CATALOGUE_PAGE_SIZE = 12;

const SELECT_CARD_COLUMNS =
  "id, slug, name, brand, model, reference_number, year_approx, movement, case_material, diameter_mm, condition, includes_box, includes_documentation, status, category, stock_quantity, is_featured, price_usd, published_at, cover_image_path, cover_image_alt" as const;

export type CatalogueCard = Pick<
  CatalogueProduct,
  | "id"
  | "slug"
  | "name"
  | "brand"
  | "model"
  | "reference_number"
  | "year_approx"
  | "movement"
  | "case_material"
  | "diameter_mm"
  | "condition"
  | "includes_box"
  | "includes_documentation"
  | "status"
  | "category"
  | "stock_quantity"
  | "is_featured"
  | "price_usd"
  | "published_at"
  | "cover_image_path"
  | "cover_image_alt"
>;

export async function fetchCataloguePage(
  filters: Partial<CatalogueFilters>
): Promise<{
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
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.movement) query = query.eq("movement", filters.movement);
  if (filters.material) query = query.eq("case_material", filters.material);
  if (filters.size) {
    const range = SIZE_RANGES.find((r) => r.value === filters.size);
    if (range?.min !== undefined) query = query.gte("diameter_mm", range.min);
    if (range?.max !== undefined) query = query.lte("diameter_mm", range.max);
  }
  if (filters.condition) query = query.eq("is_new", filters.condition === "nuevo");
  if (filters.strapWidth !== undefined) {
    query = query.contains("variants", JSON.stringify([{ width_mm: filters.strapWidth }]));
  }
  if (filters.compatibleWith) {
    query = query.contains("compatibility", JSON.stringify([{ brand: filters.compatibleWith }]));
  }
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

/**
 * Productos relacionados de la misma categoría: primero los de la misma
 * marca y, si no alcanzan, se completa con los más recientes.
 */
export async function fetchRelatedProducts(
  brand: string,
  excludeId: string,
  category: CatalogueProduct["category"],
  limit = 4
): Promise<CatalogueCard[]> {
  const supabase = createAnonClient();
  const { data: sameBrand } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .eq("category", category)
    .eq("brand", brand)
    .neq("id", excludeId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  const related = (sameBrand ?? []) as CatalogueCard[];
  if (related.length >= limit) return related;

  const { data: latest } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .eq("category", category)
    .neq("id", excludeId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit * 2);

  const seen = new Set(related.map((p) => p.id));
  for (const product of (latest ?? []) as CatalogueCard[]) {
    if (related.length >= limit) break;
    if (!seen.has(product.id)) related.push(product);
  }
  return related;
}

export type CatalogueFacets = {
  brands: string[];
  materials: string[];
  hasAccessories: boolean;
  /** Anchos de correa con stock (mm). */
  strapWidths: number[];
  /** Marcas de reloj para las que hay correas compatibles. */
  compatibleBrands: string[];
  /** true si hay relojes marcados como nuevos (para ofrecer el filtro). */
  hasNewWatches: boolean;
};

/** Valores disponibles para los filtros (marcas y materiales con stock publicado). */
export async function fetchCatalogueFacets(): Promise<CatalogueFacets> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select("brand, case_material, category");

  const rows = data ?? [];
  const unique = (values: (string | null)[]) =>
    [...new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))].sort((x, y) =>
      x.localeCompare(y, "es")
    );

  // Facetas de la Etapa 2 (variantes, compatibilidad, nuevo/usado). Se leen
  // aparte y con tolerancia a errores: si la base aún no tiene esas columnas,
  // el catálogo sigue funcionando sin esos filtros.
  const strapWidths = new Set<number>();
  const compatibleBrands = new Set<string>();
  let hasNewWatches = false;
  const { data: extra, error: extraError } = await supabase
    .from("public_catalogue_products")
    .select("category, is_new, variants, compatibility");
  if (!extraError) {
    for (const row of extra ?? []) {
      if (row.category === "reloj" && row.is_new) hasNewWatches = true;
      for (const v of readPublicVariants(row.variants)) {
        if (v.width_mm !== null && v.stock > 0) strapWidths.add(v.width_mm);
      }
      for (const c of readCompatibility(row.compatibility)) compatibleBrands.add(c.brand);
    }
  }

  return {
    brands: unique(rows.map((r) => r.brand)),
    materials: unique(rows.filter((r) => r.category === "reloj").map((r) => r.case_material)),
    hasAccessories: rows.some((r) => r.category === "accesorio"),
    strapWidths: [...strapWidths].sort((a, b) => a - b),
    compatibleBrands: [...compatibleBrands].sort((a, b) => a.localeCompare(b, "es")),
    hasNewWatches,
  };
}

export type SoldCard = Pick<SoldProduct, "id" | "name" | "brand" | "cover_image_path" | "sold_month">;

/** Relojes vendidos recientemente (prueba social). Nunca incluye precio. */
export async function fetchSoldProducts(limit = 8): Promise<SoldCard[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("public_sold_products")
    .select("id, name, brand, cover_image_path, sold_month")
    .order("sold_month", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as SoldCard[];
}

/** Correas compatibles con la marca de un reloj (venta cruzada en la ficha). */
export async function fetchCompatibleAccessories(brand: string, limit = 4): Promise<CatalogueCard[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .eq("category", "accesorio")
    .contains("compatibility", JSON.stringify([{ brand }]))
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CatalogueCard[];
}

/** Correas y accesorios en stock (venta cruzada en la ficha de un reloj). */
export async function fetchAccessories(limit = 4): Promise<CatalogueCard[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select(SELECT_CARD_COLUMNS)
    .eq("category", "accesorio")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as CatalogueCard[];
}

export async function fetchAllSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("public_catalogue_products")
    .select("slug, updated_at");
  return data ?? [];
}
