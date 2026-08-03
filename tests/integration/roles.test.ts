import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ANON_KEY,
  SUPABASE_URL,
  VIEWER_EMAIL,
  VIEWER_PASSWORD,
  supabaseAvailable,
} from "./setup";

/**
 * Autorización por roles contra la base real:
 * - viewer: solo lectura interna
 * - admin: gestión completa
 * - nadie modifica su propio rol
 */

let available = false;
let admin: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;
let adminId = "";
let viewerId = "";

beforeAll(async () => {
  available = await supabaseAvailable();
  if (!available) return;

  admin = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  viewer = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  const adminAuth = await admin.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const viewerAuth = await viewer.auth.signInWithPassword({
    email: VIEWER_EMAIL,
    password: VIEWER_PASSWORD,
  });
  adminId = adminAuth.data.user?.id ?? "";
  viewerId = viewerAuth.data.user?.id ?? "";
  if (!adminId || !viewerId) available = false;
});

describe("rol viewer (solo consulta)", () => {
  it.skipIf(() => !available)("puede leer productos e información interna", async () => {
    const { data, error } = await viewer
      .from("products")
      .select("id, name, listing_price_usd")
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it.skipIf(() => !available)("puede leer ventas y gastos (reportes)", async () => {
    const sales = await viewer.from("sales").select("id").limit(1);
    const expenses = await viewer.from("general_expenses").select("id").limit(1);
    expect(sales.error).toBeNull();
    expect(expenses.error).toBeNull();
  });

  it.skipIf(() => !available)("NO puede crear productos", async () => {
    const { error } = await viewer.from("products").insert({
      name: "Viewer intruso",
      brand: "X",
      slug: `viewer-intruso-${Date.now()}`,
    });
    expect(error).toBeTruthy();
  });

  it.skipIf(() => !available)("NO puede modificar productos", async () => {
    const { data } = await viewer
      .from("products")
      .update({ name: "Cambiado por viewer" })
      .eq("id", "10000000-0000-4000-8000-000000000001")
      .select("id");
    // RLS: la actualización no afecta ninguna fila.
    expect(data ?? []).toHaveLength(0);
  });

  it.skipIf(() => !available)("NO puede crear gastos, pagos ni cotizaciones", async () => {
    const expense = await viewer.from("general_expenses").insert({
      expense_date: "2026-08-01",
      category_id: "c2000000-0000-4000-8000-000000000001",
      description: "Intrusión",
      amount: 1,
      currency: "USD",
      exchange_rate: 40,
      amount_usd: 1,
      amount_uyu: 40,
    });
    expect(expense.error).toBeTruthy();

    const rate = await viewer.from("exchange_rates").insert({
      rate: 99,
      rate_date: "2026-08-02",
      source: "viewer",
    });
    expect(rate.error).toBeTruthy();
  });

  it.skipIf(() => !available)("NO puede ejecutar la venta atómica", async () => {
    const { error } = await viewer.rpc("mark_product_sold", {
      p_product_id: "10000000-0000-4000-8000-000000000003",
      p_sale_date: "2026-08-01",
      p_amount: 100,
      p_currency: "USD",
      p_exchange_rate: 40,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/FORBIDDEN|administrador/i);
  });

  it.skipIf(() => !available)("NO puede leer la auditoría", async () => {
    const { data, error } = await viewer.from("audit_logs").select("id").limit(1);
    if (error) expect(error).toBeTruthy();
    else expect(data ?? []).toHaveLength(0);
  });

  it.skipIf(() => !available)("NO puede cambiar su propio rol", async () => {
    const { data, error } = await viewer
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", viewerId)
      .select("role");
    // El trigger lanza excepción o la actualización no ocurre.
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data ?? []).toHaveLength(0);
    }
    // Verificación final: el rol sigue siendo viewer.
    const { data: profile } = await viewer
      .from("profiles")
      .select("role")
      .eq("id", viewerId)
      .single();
    expect(profile?.role).toBe("viewer");
  });
});

describe("rol admin", () => {
  it.skipIf(() => !available)("puede crear y modificar productos", async () => {
    const slug = `test-admin-${Date.now()}`;
    const { data, error } = await admin
      .from("products")
      .insert({ name: "Reloj de prueba admin", brand: "Test", slug })
      .select("id")
      .single();
    expect(error).toBeNull();

    const update = await admin
      .from("products")
      .update({ model: "Editado" })
      .eq("id", data!.id)
      .select("model")
      .single();
    expect(update.data?.model).toBe("Editado");

    // limpieza (borrado físico permitido: sin venta)
    await admin.from("products").delete().eq("id", data!.id);
  });

  it.skipIf(() => !available)("NO puede cambiar su propio rol (trigger)", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ role: "viewer" })
      .eq("id", adminId);
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/propio rol/i);
  });

  it.skipIf(() => !available)("NO puede desactivar su propia cuenta (trigger)", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", adminId);
    expect(error).toBeTruthy();
  });

  it.skipIf(() => !available)("puede leer la auditoría (solo lectura)", async () => {
    const { data, error } = await admin.from("audit_logs").select("id, action").limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    // Pero NO puede modificarla ni borrarla.
    const firstId = data![0]!.id;
    const update = await admin
      .from("audit_logs")
      .update({ action: "falsificado" })
      .eq("id", firstId)
      .select("id");
    if (update.error) expect(update.error).toBeTruthy();
    else expect(update.data ?? []).toHaveLength(0);

    const del = await admin.from("audit_logs").delete().eq("id", firstId).select("id");
    if (del.error) expect(del.error).toBeTruthy();
    else expect(del.data ?? []).toHaveLength(0);
  });
});
