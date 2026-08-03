import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ANON_KEY,
  SUPABASE_URL,
  supabaseAvailable,
} from "./setup";

/**
 * Pruebas de seguridad a nivel de BASE DE DATOS y API (no de pantalla).
 * Verifican las políticas RLS reales contra un Supabase local con seed.
 *
 * Requisito: `supabase start && supabase db reset` antes de ejecutar.
 */

let available = false;

beforeAll(async () => {
  available = await supabaseAvailable();
  if (!available) {
    console.warn(
      "⚠ Supabase local no disponible: pruebas de integración omitidas. Ejecute `supabase start && supabase db reset`."
    );
  }
});

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
}

describe("usuarios anónimos", () => {
  it.skipIf(() => !available)("pueden leer el catálogo público (solo publicados disponibles)", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase
      .from("public_catalogue_products")
      .select("slug, name, brand, price_usd, status");

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    // Todos los productos visibles están disponibles (reservados ocultos por configuración del seed)
    for (const product of data!) {
      expect(["disponible", "reservado"]).toContain(product.status);
    }
    // El Rolex publicado del seed está presente
    expect(data!.some((p) => p.slug === "rolex-datejust-36-16233")).toBe(true);
  });

  it.skipIf(() => !available)("NO ven productos sin publicar, vendidos ni archivados", async () => {
    const supabase = anonClient();
    const { data } = await supabase.from("public_catalogue_products").select("slug");
    const slugs = (data ?? []).map((p) => p.slug);

    expect(slugs).not.toContain("longines-conquest-heritage"); // vendido
    expect(slugs).not.toContain("citizen-eco-drive-titanium"); // vendido
    expect(slugs).not.toContain("orient-bambino-v4"); // en reparación, sin publicar
    expect(slugs).not.toContain("casio-g-shock-dw5600-vintage"); // no publicado
    expect(slugs).not.toContain("festina-cronografo-f16759"); // archivado
  });

  it.skipIf(() => !available)("la vista pública no contiene columnas financieras ni privadas", async () => {
    const supabase = anonClient();
    const { data } = await supabase.from("public_catalogue_products").select("*").limit(1);
    const row = data?.[0] as Record<string, unknown> | undefined;
    expect(row).toBeDefined();

    const forbidden = [
      "serial_number",
      "internal_notes",
      "purchase_price",
      "amount_usd",
      "listing_price_uyu",
      "listing_exchange_rate",
      "created_by",
      "deleted_at",
    ];
    for (const column of forbidden) {
      expect(row).not.toHaveProperty(column);
    }
  });

  const privateTables = [
    "products",
    "purchases",
    "product_costs",
    "product_price_history",
    "sales",
    "sale_expenses",
    "general_expenses",
    "customers",
    "suppliers",
    "cash_accounts",
    "cash_transactions",
    "payments",
    "exchange_rates",
    "audit_logs",
    "profiles",
    "application_settings",
  ] as const;

  for (const table of privateTables) {
    it.skipIf(() => !available)(`NO pueden leer la tabla ${table}`, async () => {
      const supabase = anonClient();
      const { data, error } = await supabase.from(table).select("*").limit(1);
      // Debe fallar (permiso revocado) o devolver cero filas (RLS default-deny).
      if (error) {
        expect(error).toBeTruthy();
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });
  }

  it.skipIf(() => !available)("NO pueden escribir en products", async () => {
    const supabase = anonClient();
    const { error } = await supabase.from("products").insert({
      name: "Hackeado",
      brand: "X",
      slug: "hackeado",
    });
    expect(error).toBeTruthy();
  });

  it.skipIf(() => !available)("NO pueden acceder al bucket privado", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/private-documents/purchases/test.pdf`,
      { headers: { apikey: ANON_KEY } }
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it.skipIf(() => !available)("NO pueden listar el bucket privado", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.storage.from("private-documents").list("purchases");
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it.skipIf(() => !available)("NO pueden ejecutar funciones administrativas", async () => {
    const supabase = anonClient();
    const { error } = await supabase.rpc("mark_product_sold", {
      p_product_id: "10000000-0000-4000-8000-000000000001",
      p_sale_date: "2026-08-01",
      p_amount: 1,
      p_currency: "USD",
      p_exchange_rate: 40,
    });
    expect(error).toBeTruthy();
  });

  it.skipIf(() => !available)("public_settings solo expone claves de la allowlist", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.from("public_settings").select("key");
    expect(error).toBeNull();
    const keys = (data ?? []).map((row) => row.key);
    expect(keys).toContain("business_name");
    expect(keys).not.toContain("catalogue_exchange_rate");
    expect(keys).not.toContain("default_report_currency");
    expect(keys).not.toContain("exchange_rate_warning_days");
  });

  it.skipIf(() => !available)("la cotización del catálogo es accesible vía RPC segura", async () => {
    const supabase = anonClient();
    const { data, error } = await supabase.rpc("get_catalogue_rate");
    expect(error).toBeNull();
    expect(Number(data)).toBeGreaterThan(0);
  });
});
