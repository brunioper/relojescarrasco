import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ANON_KEY,
  SUPABASE_URL,
  supabaseAvailable,
} from "./setup";

/**
 * Flujos de negocio contra la base real:
 * compra, precio de lista + histórico, venta atómica (y su rollback),
 * pagos parciales, inmutabilidad de cotizaciones.
 */

let available = false;
let admin: SupabaseClient<Database>;

const CATEGORY_REPAIR = "c1000000-0000-4000-8000-000000000002";

beforeAll(async () => {
  available = await supabaseAvailable();
  if (!available) return;
  admin = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data } = await admin.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!data.user) available = false;
});

async function createTestProduct(): Promise<string> {
  const { data, error } = await admin
    .from("products")
    .insert({
      name: `Reloj integración ${Date.now()}`,
      brand: "TestBrand",
      model: "T-1",
      slug: `reloj-integracion-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      status: "disponible",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("compra y costos", () => {
  it.skipIf(() => !available)("registra compra con importes históricos en ambas monedas", async () => {
    const productId = await createTestProduct();

    const { error } = await admin.from("purchases").insert({
      product_id: productId,
      purchase_date: "2026-07-01",
      amount: 12000,
      currency: "UYU",
      exchange_rate: 40.25,
      amount_usd: 298.14,
      amount_uyu: 12000,
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("purchases")
      .select("amount, currency, exchange_rate, amount_usd, amount_uyu, payment_status")
      .eq("product_id", productId)
      .single();
    expect(data?.amount).toBe(12000);
    expect(data?.amount_usd).toBe(298.14);
    expect(data?.payment_status).toBe("pendiente");
  });

  it.skipIf(() => !available)("rechaza importes negativos (constraint)", async () => {
    const productId = await createTestProduct();
    const { error } = await admin.from("purchases").insert({
      product_id: productId,
      purchase_date: "2026-07-01",
      amount: -100,
      currency: "USD",
      exchange_rate: 40,
      amount_usd: -100,
      amount_uyu: -4000,
    });
    expect(error).toBeTruthy();
  });
});

describe("precio de lista (RPC set_listing_price)", () => {
  it.skipIf(() => !available)("guarda precio + histórico; el cambio no toca compras", async () => {
    const productId = await createTestProduct();
    await admin.from("purchases").insert({
      product_id: productId,
      purchase_date: "2026-07-01",
      amount: 500,
      currency: "USD",
      exchange_rate: 40,
      amount_usd: 500,
      amount_uyu: 20000,
    });

    // Precio inicial en UYU
    const first = await admin.rpc("set_listing_price", {
      p_product_id: productId,
      p_amount: 17000,
      p_currency: "UYU",
      p_exchange_rate: 40.5,
    });
    expect(first.error).toBeNull();

    const afterFirst = await admin
      .from("products")
      .select("listing_price_amount, listing_price_currency, listing_price_usd, listing_price_uyu")
      .eq("id", productId)
      .single();
    expect(afterFirst.data?.listing_price_currency).toBe("UYU");
    expect(afterFirst.data?.listing_price_usd).toBe(419.75);
    expect(afterFirst.data?.listing_price_uyu).toBe(17000);

    // Cambio a USD
    const second = await admin.rpc("set_listing_price", {
      p_product_id: productId,
      p_amount: 450,
      p_currency: "USD",
      p_exchange_rate: 42,
    });
    expect(second.error).toBeNull();

    const { data: history } = await admin
      .from("product_price_history")
      .select("old_amount, old_currency, new_amount, new_currency")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    expect(history).toHaveLength(2);
    expect(history![0]?.old_amount).toBeNull();
    expect(history![1]?.old_amount).toBe(17000);
    expect(history![1]?.old_currency).toBe("UYU");
    expect(history![1]?.new_amount).toBe(450);

    // La compra histórica NO cambió.
    const { data: purchase } = await admin
      .from("purchases")
      .select("amount_usd, exchange_rate")
      .eq("product_id", productId)
      .single();
    expect(purchase?.amount_usd).toBe(500);
    expect(purchase?.exchange_rate).toBe(40);
  });

  it.skipIf(() => !available)("rechaza precio negativo y cotización inválida", async () => {
    const productId = await createTestProduct();
    const negative = await admin.rpc("set_listing_price", {
      p_product_id: productId,
      p_amount: -1,
      p_currency: "USD",
      p_exchange_rate: 40,
    });
    expect(negative.error).toBeTruthy();

    const badRate = await admin.rpc("set_listing_price", {
      p_product_id: productId,
      p_amount: 100,
      p_currency: "USD",
      p_exchange_rate: 0,
    });
    expect(badRate.error).toBeTruthy();
  });
});

describe("venta atómica (mark_product_sold)", () => {
  async function productWithPurchase(): Promise<string> {
    const productId = await createTestProduct();
    await admin.from("purchases").insert({
      product_id: productId,
      purchase_date: "2026-06-01",
      amount: 200,
      currency: "USD",
      exchange_rate: 40,
      amount_usd: 200,
      amount_uyu: 8000,
    });
    await admin.rpc("set_listing_price", {
      p_product_id: productId,
      p_amount: 300,
      p_currency: "USD",
      p_exchange_rate: 40.5,
    });
    await admin.from("products").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", productId);
    return productId;
  }

  it.skipIf(() => !available)("crea la venta, despublica y registra historial + auditoría", async () => {
    const productId = await productWithPurchase();

    const { data: saleId, error } = await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-08-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
      p_amount_received: 100,
    });
    expect(error).toBeNull();
    expect(saleId).toBeTruthy();

    const { data: product } = await admin
      .from("products")
      .select("status, is_published")
      .eq("id", productId)
      .single();
    expect(product?.status).toBe("vendido");
    expect(product?.is_published).toBe(false);

    const { data: sale } = await admin
      .from("sales")
      .select("amount, amount_usd, listing_price_usd_at_sale, payment_status, amount_paid")
      .eq("id", saleId as string)
      .single();
    expect(sale?.amount).toBe(280);
    expect(sale?.listing_price_usd_at_sale).toBe(300); // snapshot preservado
    expect(sale?.payment_status).toBe("parcial"); // cobro inicial 100/280
    expect(sale?.amount_paid).toBe(100);

    const { data: statusHistory } = await admin
      .from("product_status_history")
      .select("new_status")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(statusHistory?.[0]?.new_status).toBe("vendido");

    const { data: audit } = await admin
      .from("audit_logs")
      .select("action")
      .eq("entity_id", productId)
      .eq("action", "vender");
    expect(audit!.length).toBeGreaterThan(0);
  });

  it.skipIf(() => !available)("no permite vender dos veces", async () => {
    const productId = await productWithPurchase();
    await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-08-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
    });

    const second = await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-08-02",
      p_amount: 300,
      p_currency: "USD",
      p_exchange_rate: 40.5,
    });
    expect(second.error).toBeTruthy();
    expect(second.error!.message).toMatch(/ya fue vendido/i);
  });

  it.skipIf(() => !available)("ROLLBACK: un gasto de venta inválido revierte TODO", async () => {
    const productId = await productWithPurchase();

    const { error } = await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-08-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
      p_expenses: [
        {
          category_id: "00000000-0000-4000-8000-00000000dead", // categoría inexistente -> FK falla
          description: "inválido",
          amount: 10,
          currency: "USD",
          exchange_rate: 40.5,
        },
      ] as unknown as Json,
    });
    expect(error).toBeTruthy();

    // Nada quedó a medias: sin venta y el producto sigue disponible y publicado.
    const { data: sales } = await admin.from("sales").select("id").eq("product_id", productId);
    expect(sales ?? []).toHaveLength(0);

    const { data: product } = await admin
      .from("products")
      .select("status, is_published")
      .eq("id", productId)
      .single();
    expect(product?.status).toBe("disponible");
    expect(product?.is_published).toBe(true);
  });

  it.skipIf(() => !available)("fecha de venta anterior a la compra exige confirmación", async () => {
    const productId = await productWithPurchase(); // comprado 2026-06-01

    const withoutFlag = await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-05-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
    });
    expect(withoutFlag.error).toBeTruthy();
    expect(withoutFlag.error!.message).toMatch(/CONFIRM_REQUIRED|anterior/i);

    const withFlag = await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-05-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
      p_allow_date_before_purchase: true,
    });
    expect(withFlag.error).toBeNull();
  });

  it.skipIf(() => !available)("un producto vendido no puede eliminarse", async () => {
    const productId = await productWithPurchase();
    await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-08-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
    });

    const { error } = await admin.from("products").delete().eq("id", productId);
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/no puede eliminarse/i);
  });

  it.skipIf(() => !available)("cancel_sale revierte el producto a disponible sin publicar", async () => {
    const productId = await productWithPurchase();
    const { data: saleId } = await admin.rpc("mark_product_sold", {
      p_product_id: productId,
      p_sale_date: "2026-08-01",
      p_amount: 280,
      p_currency: "USD",
      p_exchange_rate: 40.5,
    });

    const { error } = await admin.rpc("cancel_sale", {
      p_sale_id: saleId as string,
      p_reason: "Prueba de integración",
    });
    expect(error).toBeNull();

    const { data: product } = await admin
      .from("products")
      .select("status, is_published")
      .eq("id", productId)
      .single();
    expect(product?.status).toBe("disponible");
    expect(product?.is_published).toBe(false);
  });
});

describe("pagos parciales (register_payment)", () => {
  it.skipIf(() => !available)("acumula pagos, actualiza estado y evita sobrepago", async () => {
    const productId = await createTestProduct();
    const { data: cost } = await admin
      .from("product_costs")
      .insert({
        product_id: productId,
        category_id: CATEGORY_REPAIR,
        description: "Reparación de prueba",
        cost_date: "2026-08-01",
        amount: 1000,
        currency: "UYU",
        exchange_rate: 40,
        amount_usd: 25,
        amount_uyu: 1000,
      })
      .select("id")
      .single();

    // Pago parcial 1: 400 UYU
    const first = await admin.rpc("register_payment", {
      p_transaction_type: "costo_producto",
      p_transaction_id: cost!.id,
      p_payment_date: "2026-08-02",
      p_amount: 400,
      p_currency: "UYU",
      p_exchange_rate: 40,
    });
    expect(first.error).toBeNull();

    let { data: after } = await admin
      .from("product_costs")
      .select("payment_status, amount_paid")
      .eq("id", cost!.id)
      .single();
    expect(after?.payment_status).toBe("parcial");
    expect(after?.amount_paid).toBe(400);

    // Sobrepago: 700 > 600 restantes -> rechazado
    const overpay = await admin.rpc("register_payment", {
      p_transaction_type: "costo_producto",
      p_transaction_id: cost!.id,
      p_payment_date: "2026-08-03",
      p_amount: 700,
      p_currency: "UYU",
      p_exchange_rate: 40,
    });
    expect(overpay.error).toBeTruthy();

    // Pago exacto del saldo: 600 -> pagado
    const second = await admin.rpc("register_payment", {
      p_transaction_type: "costo_producto",
      p_transaction_id: cost!.id,
      p_payment_date: "2026-08-03",
      p_amount: 600,
      p_currency: "UYU",
      p_exchange_rate: 40.5, // cotización distinta, preservada en el pago
    });
    expect(second.error).toBeNull();

    ({ data: after } = await admin
      .from("product_costs")
      .select("payment_status, amount_paid")
      .eq("id", cost!.id)
      .single());
    expect(after?.payment_status).toBe("pagado");
    expect(after?.amount_paid).toBe(1000);

    // Cada pago conserva su propia cotización histórica.
    const { data: payments } = await admin
      .from("payments")
      .select("amount, exchange_rate")
      .eq("transaction_id", cost!.id)
      .order("payment_date");
    expect(payments![0]?.exchange_rate).toBe(40);
    expect(payments![1]?.exchange_rate).toBe(40.5);
  });
});

describe("cotizaciones históricas inmutables", () => {
  it.skipIf(() => !available)("no se puede modificar el valor de una cotización", async () => {
    const { error } = await admin
      .from("exchange_rates")
      .update({ is_active: true })
      .eq("id", "e0000000-0000-4000-8000-000000000001");
    // Cambiar solo is_active está permitido…
    expect(error).toBeNull();

    // …pero cambiar el valor histórico está bloqueado por trigger.
    const forbidden = await admin
      .from("exchange_rates")
      // @ts-expect-error — el tipo Update no permite `rate` a propósito; se fuerza para probar el trigger
      .update({ rate: 99.99 })
      .eq("id", "e0000000-0000-4000-8000-000000000001");
    expect(forbidden.error).toBeTruthy();
    expect(forbidden.error!.message).toMatch(/no pueden modificarse/i);
  });

  it.skipIf(() => !available)("no se pueden borrar cotizaciones", async () => {
    const { data, error } = await admin
      .from("exchange_rates")
      .delete()
      .eq("id", "e0000000-0000-4000-8000-000000000001")
      .select("id");
    if (error) expect(error).toBeTruthy();
    else expect(data ?? []).toHaveLength(0); // RLS sin política de DELETE
  });
});
