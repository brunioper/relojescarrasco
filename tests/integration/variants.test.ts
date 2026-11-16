import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { ADMIN_EMAIL, ADMIN_PASSWORD, ANON_KEY, SUPABASE_URL, supabaseAvailable } from "./setup";

/**
 * Etapa 2 contra la base real: variantes con stock propio, venta y
 * cancelación por variante, compatibilidad, modo de venta y vistas
 * públicas (catálogo y vendidos) sin datos privados.
 */

let available = false;
let admin: SupabaseClient<Database>;
let anon: SupabaseClient<Database>;

beforeEach(() => {
  if (!available) {
    throw new Error("Supabase local no disponible o sin datos de prueba. Ejecutar: supabase start");
  }
});

beforeAll(async () => {
  available = await supabaseAvailable();
  if (!available) return;
  admin = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  anon = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data } = await admin.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!data.user) available = false;
});

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

async function createStrap(options: { publish?: boolean } = {}): Promise<{ id: string; slug: string }> {
  const slug = `correa-integracion-${unique()}`;
  const { data, error } = await admin
    .from("products")
    .insert({
      name: `Correa integración ${unique()}`,
      brand: "TestStrap",
      model: "Cuero",
      slug,
      category: "accesorio",
      stock_quantity: 0,
      status: "disponible",
    })
    .select("id")
    .single();
  if (error) throw error;

  const price = await admin.rpc("set_listing_price", {
    p_product_id: data.id,
    p_amount: 60,
    p_currency: "USD",
    p_exchange_rate: 40,
  });
  if (price.error) throw price.error;

  if (options.publish) {
    const { error: publishError } = await admin
      .from("products")
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq("id", data.id);
    if (publishError) throw publishError;
  }
  return { id: data.id, slug };
}

async function addVariants(
  productId: string,
  rows: { width_mm: number; color: string; stock_quantity: number; is_active?: boolean }[]
) {
  const { data, error } = await admin
    .from("product_variants")
    .insert(rows.map((r) => ({ product_id: productId, material: "Cuero", ...r })))
    .select("id, width_mm, color");
  if (error) throw error;
  return data;
}

async function stockOf(productId: string): Promise<number | null> {
  const { data } = await admin.from("products").select("stock_quantity").eq("id", productId).single();
  return data?.stock_quantity ?? null;
}

describe("variantes y stock", () => {
  it("el stock del producto es la suma de sus variantes activas", async () => {
    const strap = await createStrap();
    await addVariants(strap.id, [
      { width_mm: 18, color: "Negro", stock_quantity: 2 },
      { width_mm: 20, color: "Negro", stock_quantity: 3 },
      { width_mm: 22, color: "Negro", stock_quantity: 4, is_active: false },
    ]);
    expect(await stockOf(strap.id)).toBe(5);
  });

  it("nadie puede dejar el total distinto de la suma (ni editando el producto)", async () => {
    const strap = await createStrap();
    await addVariants(strap.id, [{ width_mm: 20, color: "Marrón", stock_quantity: 3 }]);

    const { error } = await admin.from("products").update({ stock_quantity: 99 }).eq("id", strap.id);
    expect(error).toBeNull();
    expect(await stockOf(strap.id)).toBe(3);
  });

  it("al quitar una variante el total se recalcula", async () => {
    const strap = await createStrap();
    const variants = await addVariants(strap.id, [
      { width_mm: 18, color: "Negro", stock_quantity: 2 },
      { width_mm: 20, color: "Negro", stock_quantity: 3 },
    ]);
    await admin.from("product_variants").delete().eq("id", variants[0]!.id);
    expect(await stockOf(strap.id)).toBe(3);
  });

  it("no acepta la misma combinación dos veces ni stock negativo", async () => {
    const strap = await createStrap();
    await addVariants(strap.id, [{ width_mm: 20, color: "Negro", stock_quantity: 1 }]);

    const repeated = await admin
      .from("product_variants")
      .insert({ product_id: strap.id, material: "cuero", color: "NEGRO", width_mm: 20, stock_quantity: 1 });
    expect(repeated.error).not.toBeNull();

    const negative = await admin
      .from("product_variants")
      .insert({ product_id: strap.id, material: "Cuero", color: "Azul", width_mm: 20, stock_quantity: -1 });
    expect(negative.error).not.toBeNull();
  });

  it("un reloj no puede tener variantes", async () => {
    const { data: watch, error } = await admin
      .from("products")
      .insert({
        name: `Reloj sin variantes ${unique()}`,
        brand: "TestBrand",
        slug: `reloj-sin-variantes-${unique()}`,
        status: "disponible",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    const result = await admin
      .from("product_variants")
      .insert({ product_id: watch!.id, width_mm: 20, stock_quantity: 1 });
    expect(result.error?.message).toMatch(/solo se pueden cargar en accesorios/);
  });
});

describe("venta por variante (sell_variant_stock)", () => {
  it("descuenta la variante y el total, y cancelar devuelve el stock", async () => {
    const strap = await createStrap();
    const [v18, v20] = await addVariants(strap.id, [
      { width_mm: 18, color: "Negro", stock_quantity: 2 },
      { width_mm: 20, color: "Negro", stock_quantity: 3 },
    ]);

    const { data: saleId, error } = await admin.rpc("sell_variant_stock", {
      p_variant_id: v20!.id,
      p_quantity: 2,
      p_sale_date: "2026-08-01",
      p_amount: 120,
      p_currency: "USD",
      p_exchange_rate: 40,
    });
    expect(error).toBeNull();
    expect(saleId).toBeTruthy();

    const { data: sale } = await admin
      .from("sales")
      .select("variant_id, quantity, product_id")
      .eq("id", saleId as string)
      .single();
    expect(sale).toMatchObject({ variant_id: v20!.id, quantity: 2, product_id: strap.id });

    const { data: after } = await admin
      .from("product_variants")
      .select("id, stock_quantity")
      .eq("product_id", strap.id);
    const byId = new Map((after ?? []).map((v) => [v.id, v.stock_quantity]));
    expect(byId.get(v20!.id)).toBe(1);
    expect(byId.get(v18!.id)).toBe(2);
    expect(await stockOf(strap.id)).toBe(3);

    const cancel = await admin.rpc("cancel_sale", { p_sale_id: saleId as string, p_reason: "test" });
    expect(cancel.error).toBeNull();

    const { data: restored } = await admin
      .from("product_variants")
      .select("stock_quantity")
      .eq("id", v20!.id)
      .single();
    expect(restored?.stock_quantity).toBe(3);
    expect(await stockOf(strap.id)).toBe(5);
  });

  it("rechaza vender más unidades de las que tiene la variante (y no cambia nada)", async () => {
    const strap = await createStrap();
    const [v18] = await addVariants(strap.id, [
      { width_mm: 18, color: "Negro", stock_quantity: 1 },
      { width_mm: 20, color: "Negro", stock_quantity: 5 },
    ]);

    const { error } = await admin.rpc("sell_variant_stock", {
      p_variant_id: v18!.id,
      p_quantity: 2,
      p_sale_date: "2026-08-01",
      p_amount: 120,
      p_currency: "USD",
      p_exchange_rate: 40,
    });
    expect(error?.message).toMatch(/stock insuficiente/);
    expect(await stockOf(strap.id)).toBe(6);
  });

  it("un visitante anónimo no puede ejecutar la venta", async () => {
    const strap = await createStrap();
    const [v] = await addVariants(strap.id, [{ width_mm: 20, color: "Negro", stock_quantity: 2 }]);
    const { error } = await anon.rpc("sell_variant_stock", {
      p_variant_id: v!.id,
      p_quantity: 1,
      p_sale_date: "2026-08-01",
      p_amount: 60,
      p_currency: "USD",
      p_exchange_rate: 40,
    });
    expect(error).not.toBeNull();
    expect(await stockOf(strap.id)).toBe(2);
  });
});

describe("superficie pública de la Etapa 2", () => {
  it("el público NO lee las tablas de variantes ni de compatibilidad", async () => {
    for (const table of ["product_variants", "product_compatibility"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(5);
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
    const write = await anon
      .from("product_variants")
      .insert({ product_id: "00000000-0000-4000-8000-000000000000", stock_quantity: 1 });
    expect(write.error).not.toBeNull();
  });

  it("el catálogo público expone variantes activas, compatibilidad y modo de venta", async () => {
    const strap = await createStrap({ publish: true });
    await addVariants(strap.id, [
      { width_mm: 20, color: "Negro", stock_quantity: 2 },
      { width_mm: 22, color: "Negro", stock_quantity: 4, is_active: false },
    ]);
    await admin
      .from("product_compatibility")
      .insert([{ product_id: strap.id, brand: "Rolex", model: "Submariner" }]);

    const { data, error } = await anon
      .from("public_catalogue_products")
      .select("slug, sale_mode, is_new, stock_quantity, variants, compatibility")
      .eq("slug", strap.slug)
      .single();
    expect(error).toBeNull();
    expect(data?.sale_mode).toBe("consultar");
    expect(data?.is_new).toBe(false);
    expect(data?.stock_quantity).toBe(2);

    const variants = data?.variants as { width_mm: number; stock: number; price_usd: number }[];
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({ width_mm: 20, stock: 2, price_usd: 60 });
    expect(data?.compatibility).toEqual([{ brand: "Rolex", model: "Submariner" }]);

    // Filtros del sitio: por ancho y por reloj compatible.
    const byWidth = await anon
      .from("public_catalogue_products")
      .select("slug")
      .contains("variants", JSON.stringify([{ width_mm: 20 }]))
      .eq("slug", strap.slug);
    expect(byWidth.data).toHaveLength(1);
    const byBrand = await anon
      .from("public_catalogue_products")
      .select("slug")
      .contains("compatibility", JSON.stringify([{ brand: "Omega" }]))
      .eq("slug", strap.slug);
    expect(byBrand.data).toHaveLength(0);
  });

  it("una correa sin stock en ninguna variante sale del catálogo", async () => {
    const strap = await createStrap({ publish: true });
    await addVariants(strap.id, [{ width_mm: 20, color: "Negro", stock_quantity: 0 }]);
    const { data } = await anon
      .from("public_catalogue_products")
      .select("slug")
      .eq("slug", strap.slug);
    expect(data).toHaveLength(0);
  });

  it("los vendidos se muestran sin precio ni datos privados", async () => {
    const { data, error } = await anon.from("public_sold_products").select("*").limit(20);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(
        ["brand", "cover_image_path", "id", "model", "name", "reference_number", "sold_month"].sort()
      );
      // Solo el mes de la venta, nunca el día exacto.
      expect(String(row.sold_month)).toMatch(/^\d{4}-\d{2}-01$/);
    }
  });
});
